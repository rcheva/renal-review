import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Paper } from "@/components/ui/Paper";
import { Stack } from "@/components/ui/Stack";
import { useTranslation } from "react-i18next";
import Section from "./Section";
import SettingsInput from "./SettingsInput";
import { sendTestNotification } from "@/logic/notification/NotificationManager";
import { saveIcsToOneDrive } from "@/logic/notification/IcsGenerator";
import { IconBell, IconCalendar, IconBellRinging } from "@tabler/icons-react";

export default function LearnSettingsView() {
  const [t] = useTranslation();
  const [testResult, setTestResult] = useState("");
  const [icsResult, setIcsResult] = useState("");

  const handleTestNotification = async () => {
    setTestResult("Sending notification...");
    const res = await sendTestNotification();
    setTestResult(res.message);
  };

  const handleExportIcs = async () => {
    setIcsResult("Exporting calendar file...");
    const res = await saveIcsToOneDrive("21:00");
    setIcsResult(res.message);
  };

  return (
    <Stack gap="xl" align="start" style={{ width: "100%", maxWidth: "800px" }}>
      {/* Spaced Repetition Notifications & 9:00 PM Reminders */}
      <Section title="Spaced Repetition & Daily Reminders (9:00 PM)">
        <Paper withBorder style={{ padding: "1.25rem", width: "100%", borderRadius: "10px" }}>
          <Stack gap="md" align="start">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <IconBellRinging size={24} color="#2563eb" />
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Daily Review Reminders (Default: 9:00 PM)</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  Receive background macOS desktop notifications and mobile calendar alerts for FSRS due cards.
                </p>
              </div>
            </div>

            <SettingsInput
              label="Enable Background OS Desktop Notifications"
              description="Alerts you on your Mac/PC at 9:00 PM if flashcards are due for review tonight."
              settingsKey="#notification_enabled"
              inputType="checkbox"
            />

            <SettingsInput
              label="Daily Reminder Time (24h format)"
              description="Default is 21:00 (9:00 PM every evening)."
              settingsKey="#notification_dailyReminderTime"
              inputType="text"
            />

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <Button variant="default" onClick={handleTestNotification} leftSection={<IconBell size={16} />}>
                Send Test Notification
              </Button>
              <Button variant="default" onClick={handleExportIcs} leftSection={<IconCalendar size={16} />}>
                Export Calendar Reminder (.ics)
              </Button>
            </div>

            {testResult && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: testResult.includes("successfully") ? "#16a34a" : "#dc2626",
                  background: testResult.includes("successfully") ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                }}
              >
                {testResult}
              </div>
            )}

            {icsResult && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#2563eb",
                  background: "rgba(37, 99, 235, 0.1)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                }}
              >
                {icsResult}
              </div>
            )}
          </Stack>
        </Paper>
      </Section>

      <SettingsInput
        label={t("settings.learn.enable-visual-feedback")}
        description={t("settings.learn.enable-visual-feedback-description")}
        settingsKey="#useVisualFeedback"
        inputType="checkbox"
      />
      <SettingsInput
        label={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
            }}
          >
            {t("settings.learn.show-cognitive-prompts")}
            <Badge color="primary" size="sm">
              Beta
            </Badge>
          </div>
        }
        description={t("settings.learn.show-cognitive-prompts-description")}
        settingsKey="#showCognitivePrompts"
        inputType="checkbox"
      />
      <SettingsInput
        label={t("settings.learn.enableHardAndEasy")}
        description={t("settings.learn.enableHardAndEasyDescription")}
        settingsKey="#learn_enableHardAndEasy"
        inputType="checkbox"
      />
      <SettingsInput
        label="Tags to Ignore"
        description="Comma separated tags to hide from your study session (e.g. Student)"
        settingsKey="#learn_ignoreTags"
        inputType="text"
      />
      <Section title={t("settings.learn.scheduler-options")}>
        <SettingsInput
          label={t("settings.learn.requestRetention")}
          description={t("settings.learn.requestRetentionDescription")}
          settingsKey="#globalScheduler_requestRetention"
          inputType="number"
        />
        <SettingsInput
          label={t("settings.learn.maximumInterval")}
          description={t("settings.learn.maximumIntervalDescription")}
          settingsKey="#globalScheduler_maximumInterval"
          inputType="number"
        />
        <SettingsInput
          label={t("settings.learn.newToReviewRatio")}
          description={t("settings.learn.newToReviewRatioDescription")}
          settingsKey="#learn_newToReviewRatio"
          inputType="number"
        />
        <SettingsInput
          label={t("settings.learn.schedulerWeights")}
          description={t("settings.learn.schedulerWeightsDescription")}
          settingsKey="#globalScheduler_w"
          inputType="text"
        />
      </Section>
    </Stack>
  );
}
