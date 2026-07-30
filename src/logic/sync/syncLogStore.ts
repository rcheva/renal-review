// Sync logger utility for tracking cloud sync, backup, and restore events

export interface SyncLogEntry {
  timestamp: string;
  type: "info" | "warn" | "error" | "success";
  message: string;
}

const LOGS_KEY = "renal_review_sync_logs";

export function getSyncLogs(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSyncLog(message: string, type: "info" | "warn" | "error" | "success" = "info") {
  const time = new Date().toLocaleTimeString();
  const entry: SyncLogEntry = { timestamp: time, type, message };
  const existing = getSyncLogs();
  const updated = [entry, ...existing].slice(0, 100); // keep last 100 logs
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  console.log(`[SyncLog ${type.toUpperCase()}] ${message}`);
}

export function clearSyncLogs() {
  localStorage.removeItem(LOGS_KEY);
}
