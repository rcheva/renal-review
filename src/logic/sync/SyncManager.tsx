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
import { addSyncLog } from "./syncLogStore";

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
  const initialCheckDoneRef = useRef(false);

  useEffect(() => {
    if (initialCheckDoneRef.current) return;
    initialCheckDoneRef.current = true;

    // 1. Initial Check on Startup
    const checkAndRestore = async () => {
      try {
        setIsSyncing(true);
        addSyncLog("Checking Supabase for cloud deck backups...", "info");
        let query = supabase
          .from("user_backups")
          .select("created_at, data")
          .order("created_at", { ascending: false })
          .limit(1);

        if (session?.user?.id) {
          query = query.eq("user_id", session.user.id);
        }

        const { data: backups, error } = await query;
        if (error) {
          addSyncLog(`Cloud check warning: ${error.message}`, "warn");
          return;
        }
        if (!backups || backups.length === 0) {
          addSyncLog("No existing cloud backups found in Supabase.", "info");
          return;
        }

        const backup = backups[0];
        const backupTime = new Date(backup.created_at).getTime();
        const localTime = lastSyncedAt ? Number(lastSyncedAt) : 0;

        addSyncLog(`Cloud backup date: ${new Date(backupTime).toLocaleString()}`, "info");

        if (backupTime > localTime + 10000) {
          addSyncLog("Newer cloud backup detected! Restoring decks...", "info");
          const text = JSON.stringify(backup.data);
          const blob = new Blob([text], { type: "application/json" });
          await importInto(db, blob, {
            clearTablesBeforeImport: true,
            overwriteValues: true,
          });
          await setSetting("#cloud_lastSyncedAt", backupTime);
          addSyncLog("✅ Cloud decks successfully restored to local database.", "success");
        } else {
          addSyncLog("Local database is up to date with cloud.", "success");
        }
      } catch (err: any) {
        addSyncLog(`Sync check error: ${err?.message || err}`, "warn");
      } finally {
        setIsSyncing(false);
      }
    };

    checkAndRestore();
  }, [session?.user]);

  // 2. Setup Automatic Backup Tracking
  useEffect(() => {
    const markDirty = () => {
      dirtyRef.current = true;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      // Debounce backup for 15 seconds after last modification
      syncTimeoutRef.current = setTimeout(performAutoBackup, 15000);
    };

    const performAutoBackup = async () => {
      if (!dirtyRef.current) return;
      try {
        setIsSyncing(true);
        addSyncLog("Auto-backing up local database to Supabase cloud...", "info");
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
          addSyncLog(`Auto-backup warning: ${error.message}`, "warn");
          return;
        }

        if (newBackup) {
          const newTime = new Date(newBackup.created_at).getTime();
          await setSetting("#cloud_lastSyncedAt", newTime);
          addSyncLog("✅ Database snapshot backed up to Supabase cloud.", "success");
        }

        dirtyRef.current = false;
      } catch (err: any) {
        addSyncLog(`Auto-backup error: ${err?.message || err}`, "warn");
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
