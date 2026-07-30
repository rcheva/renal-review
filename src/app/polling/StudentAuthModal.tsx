import React, { useState, useEffect } from "react";
import { Button, Modal, TextInput } from "@/components/ui";
import { Student, PollGroup } from "./types";
import {
  findStudentByCode,
  registerStudent,
  setCurrentSessionStudent,
  getPollGroups,
} from "./pollingStore";
import { IconLock, IconUserCheck, IconUserPlus, IconId } from "@tabler/icons-react";

interface StudentAuthModalProps {
  isOpen: boolean;
  onAuthenticated: (student: Student) => void;
}

export default function StudentAuthModal({
  isOpen,
  onAuthenticated,
}: StudentAuthModalProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [groups, setGroups] = useState<PollGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login form state
  const [loginCode, setLoginCode] = useState("");
  const [loginPin, setLoginPin] = useState("");

  // Register form state
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regGroup, setRegGroup] = useState("Renal");

  useEffect(() => {
    getPollGroups().then(setGroups);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginCode.trim()) {
      setError("Please enter your Student ID.");
      return;
    }
    if (!loginPin.trim() || loginPin.length !== 4) {
      setError("Please enter your 4-digit PIN.");
      return;
    }

    setLoading(true);
    try {
      const student = await findStudentByCode(loginCode);
      if (!student) {
        setError("Student ID not found. Please check your ID or register as a new student.");
        setLoading(false);
        return;
      }

      if (student.pin !== loginPin.trim()) {
        setError("Incorrect 4-digit PIN. Please try again.");
        setLoading(false);
        return;
      }

      setCurrentSessionStudent(student);
      onAuthenticated(student);
    } catch (err) {
      setError("Authentication error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regCode.trim()) {
      setError("Please enter a Student ID (e.g. STU101).");
      return;
    }
    if (!regName.trim()) {
      setError("Please enter your Full Name.");
      return;
    }
    if (!regPin.trim() || regPin.length !== 4 || !/^\d{4}$/.test(regPin.trim())) {
      setError("Please enter a valid 4-digit numeric PIN (e.g. 1234).");
      return;
    }

    setLoading(true);
    try {
      const existing = await findStudentByCode(regCode);
      if (existing) {
        setError(`Student ID '${regCode}' is already registered. Please log in instead.`);
        setLoading(false);
        return;
      }

      const newStudent = await registerStudent({
        student_code: regCode,
        name: regName,
        pin: regPin,
        group_name: regGroup,
        rotation_start: new Date().toISOString(),
      });

      setCurrentSessionStudent(newStudent);
      onAuthenticated(newStudent);
    } catch (err) {
      setError("Error creating student profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={() => {}} // Cannot dismiss until authenticated
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "1.2rem" }}>
          {isRegisterMode ? <IconUserPlus size={22} color="var(--color-accent-teal, #0d9488)" /> : <IconLock size={22} color="var(--color-primary, #2563eb)" />}
          {isRegisterMode ? "Student Registration" : "Student Login"}
        </div>
      }
      showCloseButton={false}
      exitOnEscape={false}
    >
      <div style={{ padding: "8px 0" }}>
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
          {isRegisterMode
            ? "Create your student ID and 4-digit PIN to record your poll responses and rotation performance."
            : "Enter your Student ID and 4-digit PIN to continue with this poll."}
        </p>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              color: "#dc2626",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {!isRegisterMode ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              label="Student ID"
              placeholder="e.g. STU101 or your student code"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              leftSection={<IconId size={18} />}
              required
            />
            <TextInput
              label="4-Digit PIN"
              type="password"
              placeholder="••••"
              maxLength={4}
              value={loginPin}
              onChange={(e) => setLoginPin(e.target.value)}
              leftSection={<IconLock size={18} />}
              required
            />

            <Button type="submit" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Authenticating..." : "Authenticate & Begin Poll"}
            </Button>

            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>
              First time taking a poll?{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsRegisterMode(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary, #2563eb)",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Create Student ID & PIN
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              label="Student ID / Code"
              placeholder="e.g. STU101 or your assigned ID"
              value={regCode}
              onChange={(e) => setRegCode(e.target.value)}
              leftSection={<IconId size={18} />}
              required
            />
            <TextInput
              label="Full Name"
              placeholder="Dr. Jane Doe"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              leftSection={<IconUserCheck size={18} />}
              required
            />
            <TextInput
              label="Create 4-Digit Security PIN"
              type="password"
              placeholder="4 numeric digits (e.g. 1234)"
              maxLength={4}
              value={regPin}
              onChange={(e) => setRegPin(e.target.value)}
              leftSection={<IconLock size={18} />}
              required
            />

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Group / Hospital Rotation
              </label>
              <select
                value={regGroup}
                onChange={(e) => setRegGroup(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #d1d5db)",
                  background: "var(--color-bg-card, white)",
                  color: "var(--color-text-main, #111827)",
                  fontSize: "0.9rem",
                }}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name} {g.description ? `(${g.description})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Registering..." : "Register & Start Poll"}
            </Button>

            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsRegisterMode(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary, #2563eb)",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Log in with ID & PIN
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
