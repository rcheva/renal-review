import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { QRCodeSVG } from "qrcode.react";
import { IconCopy, IconBrandWhatsapp, IconQrcode, IconExternalLink, IconSettings } from "@tabler/icons-react";

interface StudentQrModalProps {
  opened: boolean;
  onClose: () => void;
  pollId: string;
  pollTitle: string;
  groupName?: string;
  currentPublicDomain: string;
  onUpdateDomain: (newDomain: string) => void;
}

export function StudentQrModal({
  opened,
  onClose,
  pollId,
  pollTitle,
  groupName,
  currentPublicDomain,
  onUpdateDomain,
}: StudentQrModalProps) {
  const [domainInput, setDomainInput] = useState(currentPublicDomain);
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const cleanDomain = (domainInput || "https://rcheva.github.io/renal-review").replace(/\/$/, "");
  const livePollUrl = `${cleanDomain}/#/poll/${pollId}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Join live Renal Review poll: ${pollTitle}\n\n${livePollUrl}`)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(livePollUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleSaveDomain = () => {
    onUpdateDomain(domainInput.trim());
    setIsEditingDomain(false);
  };

  if (!opened) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 800, fontSize: "1.2rem" }}>
          <IconQrcode size={26} color="#2563eb" />
          <span>Student Mobile Polling Access & QR Code</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", padding: "1rem 0" }}>
        {/* Banner Title */}
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#0f172a" }}>{pollTitle}</h2>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
            Category: {groupName || "Renal"} • Scan QR Code to Vote Live
          </span>
        </div>

        {/* High-Resolution Lecture Hall QR Code Frame */}
        <div
          style={{
            background: "white",
            padding: "1.25rem",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
            border: "3px solid #2563eb",
          }}
        >
          <QRCodeSVG value={livePollUrl} size={280} level="H" includeMargin />
        </div>

        {/* Live URL Bar */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
              Live Student Poll Web URL:
            </label>
            <button
              onClick={() => setIsEditingDomain(!isEditingDomain)}
              style={{
                border: "none",
                background: "none",
                color: "#2563eb",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconSettings size={14} />
              {isEditingDomain ? "Cancel Domain Edit" : "Change Domain"}
            </button>
          </div>

          {isEditingDomain ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <TextInput
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="https://rcheva.github.io/renal-review"
                style={{ flex: 1 }}
              />
              <Button variant="default" onClick={handleSaveDomain}>
                Save Domain
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <TextInput value={livePollUrl} readOnly style={{ flex: 1, fontWeight: 700, color: "#2563eb" }} />
              <Button
                variant={copySuccess ? "subtle" : "default"}
                onClick={handleCopyUrl}
                leftSection={<IconCopy size={16} />}
              >
                {copySuccess ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
          <Button
            variant="default"
            leftSection={<IconBrandWhatsapp size={18} color="#25D366" />}
            onClick={() => window.open(whatsappUrl, "_blank")}
          >
            Share on WhatsApp
          </Button>

          <Button
            variant="subtle"
            leftSection={<IconExternalLink size={18} />}
            onClick={() => window.open(livePollUrl, "_blank")}
          >
            Open Student View
          </Button>

          <Button variant="subtle" onClick={onClose}>
            Close QR Display
          </Button>
        </div>
      </div>
    </Modal>
  );
}
