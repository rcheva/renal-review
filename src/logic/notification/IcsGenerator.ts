import { isTauri } from "@/lib/isTauri";

export function generateIcsContent(reminderTime: string = "21:00"): string {
  const [hourStr, minStr] = reminderTime.split(":");
  const hour = parseInt(hourStr || "21", 10);
  const min = parseInt(minStr || "00", 10);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const startDt = `${year}${month}${day}T${String(hour).padStart(2, "0")}${String(min).padStart(2, "0")}00`;
  const endHour = (hour + 1) % 24;
  const endDt = `${year}${month}${day}T${String(endHour).padStart(2, "0")}${String(min).padStart(2, "0")}00`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Renal Review//Spaced Repetition Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Renal Review 9 PM Study Sessions
X-WR-TIMEZONE:Europe/Dublin
BEGIN:VEVENT
UID:renal_review_daily_${hour}${min}@renalreview.org
DTSTAMP:${year}${month}${day}T120000Z
SUMMARY:Renal Review - Spaced Repetition Study (9:00 PM)
DESCRIPTION:FSRS Spaced Repetition review session. Open Renal Review to complete due flashcards.
RRULE:FREQ=DAILY
DTSTART;TZID=Europe/Dublin:${startDt}
DTEND;TZID=Europe/Dublin:${endDt}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Renal Review Study Session in 15 Minutes!
TRIGGER:-PT15M
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Time to review your Renal Review Flashcards!
TRIGGER:PT0M
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

export async function saveIcsToOneDrive(reminderTime: string = "21:00"): Promise<{ success: boolean; path?: string; message: string }> {
  const cs = generateIcsContent(reminderTime);

  try {
    if (isTauri()) {
      const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

      const oneDriveBase = "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";
      const targetPath = `${oneDriveBase}/renal_review_schedule.ics`;

      const dirExists = await exists(oneDriveBase);
      if (!dirExists) {
        await mkdir(oneDriveBase, { recursive: true });
      }

      await writeTextFile(targetPath, cs);
      return { success: true, path: targetPath, message: `Calendar reminder saved to OneDrive at ${targetPath}` };
    }
  } catch (err) {
    console.warn("Could not save .ics directly via Tauri, offering browser download fallback", err);
  }

  // Browser download fallback
  try {
    const blob = new Blob([cs], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renal_review_schedule.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, message: "Calendar .ics downloaded successfully." };
  } catch (e) {
    return { success: false, message: "Failed to export .ics file." };
  }
}
