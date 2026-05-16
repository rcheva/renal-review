import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import { supabase } from '../supabase';
import { db } from '../db';
import { exportDB, importInto } from 'dexie-export-import';
import { useAuthSession } from '../../app/auth/useAuthSession';
import { useSetting } from '../settings/hooks/useSetting';
import { setSetting } from '../settings/setSetting';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncedAt: number;
}

const SyncContext = createContext<SyncContextType>({ isSyncing: false, lastSyncedAt: 0 });

export const useSyncManager = () => useContext(SyncContext);

export const SyncManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuthSession();
  const [lastSyncedAt] = useSetting("#cloud_lastSyncedAt");
  const [autoSyncEnabled] = useSetting("#cloud_autoSyncEnabled");
  const [isSyncing, setIsSyncing] = useState(false);
  
  const dirtyRef = useRef(false);
  const syncTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!session?.user || !autoSyncEnabled) return;
    
    // 1. Initial Auto-Restore Check
    const checkAndRestore = async () => {
      try {
        setIsSyncing(true);
        const { data: backup, error } = await supabase
          .from("user_backups")
          .select("created_at, data")
          .eq('user_id', session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
           if (error.code === 'PGRST116') {
              // No rows found, this is fine
              return;
           }
           throw error;
        }
        if (!backup) return;

        const backupTime = new Date(backup.created_at).getTime();
        
        // If the cloud backup is newer than local last synced time (with 5 sec buffer)
        if (backupTime > (lastSyncedAt || 0) + 5000) {
          console.log("Cloud backup is newer. Restoring...");
          const text = JSON.stringify(backup.data);
          const blob = new Blob([text], { type: "application/json" });
          await importInto(db, blob, { 
            clearTablesBeforeImport: true,
            overwriteValues: true 
          });
          await setSetting("#cloud_lastSyncedAt", backupTime);
          
          // Force a reload so UI picks up new data if we were already loaded
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err) {
        console.error("Auto-restore failed:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    checkAndRestore();
  }, [session?.user, autoSyncEnabled]);

  // 2. Setup Dirty Tracking
  useEffect(() => {
    if (!session?.user || !autoSyncEnabled) return;

    const markDirty = () => {
      dirtyRef.current = true;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      
      // Debounce backup for 10 seconds after last modification
      syncTimeoutRef.current = setTimeout(performAutoBackup, 10000);
    };

    const performAutoBackup = async () => {
      if (!dirtyRef.current) return;
      try {
        setIsSyncing(true);
        console.log("Performing auto-backup...");
        const blob = await exportDB(db);
        const text = await blob.text();
        const data = JSON.parse(text);

        const { error, data: newBackup } = await supabase
          .from("user_backups")
          .insert({ user_id: session.user.id, data })
          .select()
          .single();

        if (error) throw error;
        
        if (newBackup) {
          const newTime = new Date(newBackup.created_at).getTime();
          await setSetting("#cloud_lastSyncedAt", newTime);
        }
        
        dirtyRef.current = false;
      } catch (err) {
        console.error("Auto-backup failed:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Attach hooks to relevant tables (excluding settings to avoid infinite loop)
    const tables = [db.cards, db.decks, db.notes, db.statistics];
    
    tables.forEach(table => {
      table.hook('creating', markDirty);
      table.hook('updating', markDirty);
      table.hook('deleting', markDirty);
    });

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      tables.forEach(table => {
        table.hook('creating').unsubscribe(markDirty);
        table.hook('updating').unsubscribe(markDirty);
        table.hook('deleting').unsubscribe(markDirty);
      });
    };
  }, [session?.user, autoSyncEnabled]);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSyncedAt }}>
      {children}
    </SyncContext.Provider>
  );
};
