import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Student, PollGroup } from "./types";
import { updateStudent, getPollGroups } from "./pollingStore";
import { IconEdit } from "@tabler/icons-react";

interface EditStudentModalProps {
  student: Student | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditStudentModal({ student, opened, onClose, onSaved }: EditStudentModalProps) {
  const [name, setName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [pin, setPin] = useState("");
  const [groupName, setGroupName] = useState("Renal");
  const [rotationStart, setRotationStart] = useState("");
  const [groups, setGroups] = useState<PollGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getPollGroups().then(setGroups);
  }, []);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setStudentCode(student.student_code);
      setPin(student.pin || "");
      setGroupName(student.group_name || "Renal");
      setRotationStart(student.rotation_start ? student.rotation_start.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setErrorMsg("");
    }
  }, [student]);

  if (!student || !opened) return null;

  const handleSave = async () => {
    if (!name.trim() || !studentCode.trim() || !pin.trim()) {
      setErrorMsg("Name, Student ID, and 4-digit PIN are required.");
      return;
    }

    if (pin.trim().length < 4) {
      setErrorMsg("PIN must be at least 4 digits.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const updated: Student = {
      ...student,
      name: name.trim(),
      student_code: studentCode.trim().toUpperCase(),
      pin: pin.trim(),
      group_name: groupName.trim(),
      rotation_start: new Date(rotationStart).toISOString(),
    };

    await updateStudent(updated);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 700 }}>
          <IconEdit size={22} color="#2563eb" />
          <span>Edit Student Details</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0.5rem 0" }}>
        {errorMsg && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: "6px",
              fontSize: "0.85rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "6px" }}>
            Student Full Name
          </label>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dr. Sarah Jenkins"
          />
        </div>

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "6px" }}>
            Student ID / Code
          </label>
          <TextInput
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            placeholder="e.g. STU101"
          />
        </div>

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "6px" }}>
            Security PIN (4 digits)
          </label>
          <TextInput
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="e.g. 1001"
            type="password"
          />
        </div>

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "6px" }}>
            Group / Hospital
          </label>
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--theme-neutral-300)",
              background: "var(--theme-card-bg)",
              fontSize: "0.95rem",
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
            {!groups.some((g) => g.name === groupName) && (
              <option value={groupName}>{groupName}</option>
            )}
          </select>
        </div>

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "6px" }}>
            Rotation Start Date
          </label>
          <input
            type="date"
            value={rotationStart}
            onChange={(e) => setRotationStart(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--theme-neutral-300)",
              background: "var(--theme-card-bg)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1rem" }}>
          <Button variant="subtle" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
