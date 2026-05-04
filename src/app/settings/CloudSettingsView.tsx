import { useState } from "react";
import { useNotifications } from "@/components/Notification";
import { supabase } from "@/logic/supabase";
import { db } from "@/logic/db";
import { exportDB, importInto } from "dexie-export-import";
import { useAuthSession } from "@/app/auth/useAuthSession";
import Section from "./Section";
import "./CloudSettingsView.css";

export default function CloudSettingsView() {
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotifications();
  const { session } = useAuthSession();

  const handleBackup = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      showNotification({ title: "Backup Started", message: "Exporting local database...", type: "info" });
      const blob = await exportDB(db);
      const text = await blob.text();
      const data = JSON.parse(text);

      const { error } = await supabase
        .from("user_backups")
        .insert({ user_id: session.user.id, data });

      if (error) throw error;

      showNotification({ title: "Backup Complete", message: "Successfully backed up to the cloud.", type: "success" });
    } catch (err: any) {
      showNotification({ title: "Backup Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!session?.user) return;
    
    if (!window.confirm("WARNING: This will overwrite your current local flashcards with the cloud backup. Are you sure?")) {
      return;
    }

    setLoading(true);
    try {
      showNotification({ title: "Restore Started", message: "Downloading from cloud...", type: "info" });
      
      const { data: backup, error } = await supabase
        .from("user_backups")
        .select("data")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (!backup) throw new Error("No backups found in the cloud.");

      const text = JSON.stringify(backup.data);
      const blob = new Blob([text], { type: "application/json" });

      await importInto(db, blob, { 
        clearTablesBeforeImport: true,
        overwriteValues: true 
      });

      showNotification({ title: "Restore Complete", message: "Successfully restored from the cloud! Please refresh the page.", type: "success" });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      showNotification({ title: "Restore Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!session) {
    return <p>Please sign in to use Cloud Sync.</p>;
  }

  return (
    <Section title="Cloud Sync">
      <div className="cloud-settings">
        <p className="cloud-settings__desc">
          Logged in as <strong>{session.user.email}</strong>. Use these buttons to manually sync your decks to and from the cloud.
        </p>
        <div className="cloud-settings__actions">
          <button 
            className="cloud-settings__btn cloud-settings__btn--primary" 
            onClick={handleBackup}
            disabled={loading}
          >
            {loading ? "Processing..." : "Backup to Cloud"}
          </button>
          <button 
            className="cloud-settings__btn cloud-settings__btn--secondary" 
            onClick={handleRestore}
            disabled={loading}
          >
            {loading ? "Processing..." : "Restore from Cloud"}
          </button>
        </div>
        <button 
            className="cloud-settings__btn cloud-settings__btn--danger" 
            onClick={handleSignOut}
            disabled={loading}
            style={{ marginTop: '1rem' }}
          >
            Sign Out
        </button>
      </div>
    </Section>
  );
}
