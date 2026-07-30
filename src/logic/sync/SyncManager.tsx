import { exportDB, importInto } from "dexie-export-import";
import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { useAuthSession } from "../../app/auth/useAuthSession";
import { db } from "../db";
import { useSetting } from "../settings/hooks/useSetting";
import { setSetting } from "../settings/setSetting";
import { supabase } from "../supabase";

interface SyncContextType {
  isSyncing: boolean;
  lastSyncedAt: number;
}

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  lastSyncedAt: 0,
});

export const useSyncManager = () => useContext(SyncContext);

export const SyncManagerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { session } = useAuthSession();
  const [lastSyncedAt] = useSetting("#cloud_lastSyncedAt");
  const [isSyncing, setIsSyncing] = useState(false);

  const dirtyRef = useRef(false);
  const syncTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // 1. Initial Auto-Restore Check on Startup
    const checkAndRestore = async () => {
      try {
        setIsSyncing(true);
        let query = supabase
          .from("user_backups")
          .select("created_at, data")
          .order("created_at", { ascending: false })
          .limit(1);

        if (session?.user?.id) {
          query = query.eq("user_id", session.user.id);
        }

        const { data: backups, error } = await query;
        if (error || !backups || backups.length === 0) return;

        const backup = backups[0];
        const backupTime = new Date(backup.created_at).getTime();
        const localTime = lastSyncedAt ? Number(lastSyncedAt) : 0;

        if (backupTime > localTime + 3000) {
          console.log("Cloud deck backup is newer. Restoring automatically...");
          const text = JSON.stringify(backup.data);
          const blob = new Blob([text], { type: "application/json" });
          await importInto(db, blob, {
            clearTablesBeforeImport: true,
            overwriteValues: true,
          });
          await setSetting("#cloud_lastSyncedAt", backupTime);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err) {
        console.error("Auto-restore error:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    checkAndRestore();
  }, [session?.user, lastSyncedAt]);

  // 2. Setup Automatic Backup Tracking
  useEffect(() => {
    const markDirty = () => {
      dirtyRef.current = true;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      // Debounce backup for 5 seconds after last modification
      syncTimeoutRef.current = setTimeout(performAutoBackup, 5000);
    };

    const performAutoBackup = async () => {
      if (!dirtyRef.current) return;
      try {
        setIsSyncing(true);
        console.log("Performing auto-backup of decks to Supabase...");
        const blob = await exportDB(db);
        const text = await blob.text();
        const data = JSON.parse(text);
        const userId = session?.user?.id || "global_master";

        const { error, data: newBackup } = await supabase
          .from("user_backups")
          .insert({ user_id: userId, data })
          .select()
          .single();

        if (error) {
          console.warn("Auto-backup insert error", error);
          return;
        }

        if (newBackup) {
          const newTime = new Date(newBackup.created_at).getTime();
          await setSetting("#cloud_lastSyncedAt", newTime);
        }

        dirtyRef.current = false;
      } catch (err) {
        console.error("Auto-backup error:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Attach hooks to relevant tables (excluding settings to avoid infinite loop)
    const tables = [db.cards, db.decks, db.notes, db.statistics];

    tables.forEach((table) => {
      table.hook("creating", markDirty);
      table.hook("updating", markDirty);
      table.hook("deleting", markDirty);
    });

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      tables.forEach((table) => {
        table.hook("creating").unsubscribe(markDirty);
        table.hook("updating").unsubscribe(markDirty);
        table.hook("deleting").unsubscribe(markDirty);
      });
    };
  }, [session?.user]);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSyncedAt }}>
      {children}
    </SyncContext.Provider>
  );
};
