import DangerousConfirmModal from "@/components/DangerousConfirmModal";
import { Button } from "@/components/ui/Button";
import {
  IconDatabaseExport,
  IconDatabaseImport,
  IconCloudUpload,
  IconTrash,
} from "@tabler/icons-react";
import { exportDB, importInto } from "dexie-export-import";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../logic/db";
import { supabase } from "../../../logic/supabase";
import "./DatabaseSettingsView.css";
import Section from "../Section";
import StorageSection from "./StorageSection";
import { useNotifications } from "@/components/Notification";

const BASE = "database-settings-view";

export default function DatabaseSettingsView() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [deleteAllDataModalOpened, setDeleteAllDataModalOpened] =
    useState<boolean>(false);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);

  const handleRestoreFromCloud = async () => {
    setIsRestoringCloud(true);
    showNotification({ title: "Restoring...", message: "Pulling latest database from Supabase cloud...", type: "info" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
         throw new Error("You must be logged in to restore from cloud.");
      }

      // Fetch the latest backup for this user
      const { data: backups, error } = await supabase
        .from("user_backups")
        .select("data")
        .eq("user_id", sessionData.session.user.id)
        .order("id", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!backups || backups.length === 0) {
        throw new Error("No cloud backups found for your account.");
      }

      const latestBackupData = backups[0].data;
      const blob = new Blob([JSON.stringify(latestBackupData)], { type: "application/json" });
      
      await importInto(db, blob, { overwriteValues: true });
      showNotification({ title: "Success", message: "Database successfully restored from Supabase! Reloading...", type: "success" });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showNotification({ title: "Cloud Restore Failed", message: err.message || "Unknown error", type: "error" });
    } finally {
      setIsRestoringCloud(false);
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    showNotification({ title: "Syncing...", message: "Pushing local database to Supabase cloud...", type: "info" });
    try {
      const blob = await exportDB(db);
      const text = await blob.text();
      const data = JSON.parse(text);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
         throw new Error("You must be logged in to sync to cloud.");
      }

      const { error } = await supabase
        .from("user_backups")
        .insert({ user_id: sessionData.session.user.id, data })
        .select()
        .single();

      if (error) throw error;
      showNotification({ title: "Success", message: "Database successfully backed up to Supabase!", type: "success" });
    } catch (err: any) {
      console.error(err);
      showNotification({ title: "Cloud Sync Failed", message: err.message || "Unknown error", type: "error" });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <>
      <div>
        <StorageSection />
        <Button
          leftSection={<IconDatabaseExport />}
          onClick={async () => {
            const now = new Date(Date.now());
            const blob = await exportDB(db);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `skola-export-${now.toLocaleDateString()}-${now.toLocaleTimeString()}.json`;
            a.click();
          }}
        >
          Save all in PC
        </Button>

        <Button
          style={{ marginLeft: 10 }}
          leftSection={<IconCloudUpload />}
          onClick={handleManualCloudSync}
          disabled={isSyncingCloud}
        >
          {isSyncingCloud ? "Syncing..." : "Sync current full"}
        </Button>
        <Button
          style={{ marginLeft: 10 }}
          leftSection={<IconDatabaseImport />}
          variant="default"
          onClick={handleRestoreFromCloud}
          disabled={isRestoringCloud}
        >
          {isRestoringCloud ? "Restoring..." : "Restore from last full"}
        </Button>
        <Section title="Danger Zone" className={`${BASE}__danger-zone`}>
          <p className={`${BASE}__danger-text`}>
            This section contains potentially dangerous settings. Proceed with
            utmost caution!
          </p>

          <Button
            leftSection={<IconTrash />}
            variant="destructive"
            onClick={() => setDeleteAllDataModalOpened(true)}
          >
            Delete all Data
          </Button>
        </Section>
      </div>
      <DangerousConfirmModal
        dangerousAction={() => {
          db.delete();
          navigate("/home");
          window.location.reload();
        }}
        dangerousDependencies={[]}
        dangerousTitle="Delete all Data"
        dangerousDescription="This will delete all of your data including your cards, decks and settings. There is absolutely no way to recover. Are you sure you want to continue?"
        opened={deleteAllDataModalOpened}
        setOpened={setDeleteAllDataModalOpened}
      />
    </>
  );
}
