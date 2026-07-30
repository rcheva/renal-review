import { db } from "@/logic/db";

const LAST_NOTIF_KEY = "renal_review_last_notification_date";

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if ("Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      }
    }
  } catch (e) {
    console.warn("Could not request web notification permission", e);
  }

  return false;
}

export async function countTotalDueCards(): Promise<number> {
  try {
    const cards = await db.cards.toArray();
    const now = new Date();
    let dueCount = 0;

    cards.forEach((card) => {
      if (card.model && card.model.due) {
        const dueDate = new Date(card.model.due);
        if (dueDate <= now) {
          dueCount++;
        }
      }
    });

    return dueCount;
  } catch (e) {
    console.warn("Error counting due cards", e);
    return 0;
  }
}

export async function sendDesktopNotification(title: string, body: string): Promise<boolean> {
  try {
    // Check Notification API support (works natively in Web & Tauri macOS Webview)
    if ("Notification" in window) {
      let permission = Notification.permission;
      if (permission !== "granted" && permission !== "denied") {
        permission = await Notification.requestPermission();
      }

      if (permission === "granted") {
        const notif = new Notification(title, {
          body,
          icon: "/logo.svg",
          tag: "renal-review-due",
        });
        notif.onclick = () => {
          window.focus();
          window.location.hash = "#/learn";
        };
        return true;
      }
    }
  } catch (e) {
    console.warn("Failed to send desktop notification", e);
  }

  return false;
}

export async function checkDailyReminderSchedule(reminderTimeStr: string = "21:00"): Promise<void> {
  const [targetHour] = reminderTimeStr.split(":").map((v) => parseInt(v, 10));
  const now = new Date();
  const currentHour = now.getHours();

  // Trigger if current time is at or past target hour (default 21:00 / 9:00 PM)
  if (currentHour < (targetHour || 21)) {
    return;
  }

  const todayStr = now.toISOString().slice(0, 10);
  const lastSent = localStorage.getItem(LAST_NOTIF_KEY);
  if (lastSent === todayStr) {
    return; // Already notified today
  }

  const dueCards = await countTotalDueCards();
  if (dueCards > 0) {
    const title = `Renal Review - 9:00 PM Spaced Repetition Reminder`;
    const body = `You have ${dueCards} flashcard(s) due for review tonight. Click to complete your FSRS session!`;

    const sent = await sendDesktopNotification(title, body);
    if (sent) {
      localStorage.setItem(LAST_NOTIF_KEY, todayStr);
    }
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission && typeof Notification !== "undefined" && Notification.permission === "denied") {
    return {
      success: false,
      message: "Notification permission was denied in your system/browser settings.",
    };
  }

  const dueCount = await countTotalDueCards();
  const success = await sendDesktopNotification(
    "Renal Review Test Notification",
    `Test notification active! You currently have ${dueCount} card(s) due for review.`
  );

  if (success) {
    return { success: true, message: "Test notification sent successfully to macOS system desktop!" };
  } else {
    return { success: false, message: "Could not send notification. Please check system notification settings." };
  }
}
