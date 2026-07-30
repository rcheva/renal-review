import React from "react";

interface KidneyMedalProps {
  rank: 1 | 2 | 3;
  size?: number;
}

export const KidneyMedal: React.FC<KidneyMedalProps> = ({ rank, size = 54 }) => {
  const gradientId = `kidney-gradient-${rank}`;

  // Color profiles
  const config = {
    1: {
      stop1: "#fef08a",
      stop2: "#eab308",
      stop3: "#ca8a04",
      stroke: "#854d0e",
      text: "#854d0e",
      glow: "rgba(234, 179, 8, 0.4)",
      label: "GOLD KIDNEY",
    },
    2: {
      stop1: "#f8fafc",
      stop2: "#cbd5e1",
      stop3: "#64748b",
      stroke: "#334155",
      text: "#334155",
      glow: "rgba(148, 163, 184, 0.4)",
      label: "SILVER KIDNEY",
    },
    3: {
      stop1: "#ffedd5",
      stop2: "#d97706",
      stop3: "#78350f",
      stroke: "#451a03",
      text: "#451a03",
      glow: "rgba(217, 119, 6, 0.4)",
      label: "BRONZE KIDNEY",
    },
  }[rank];

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: `drop-shadow(0 6px 12px ${config.glow})`,
          transition: "transform 0.3s ease",
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.stop1} />
            <stop offset="50%" stopColor={config.stop2} />
            <stop offset="100%" stopColor={config.stop3} />
          </linearGradient>
          <filter id={`shadow-${rank}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Shiny Circle / Medal Rim */}
        <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} stroke={config.stroke} strokeWidth="3" />
        <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="4 2" />

        {/* Anatomical Kidney Contour Silhouette */}
        <path
          d="M 50 24 
             C 68 24, 78 36, 78 52 
             C 78 68, 66 78, 52 78 
             C 42 78, 36 72, 36 64 
             C 36 58, 44 54, 44 48 
             C 44 42, 34 38, 34 32 
             C 34 26, 42 24, 50 24 Z"
          fill="rgba(255, 255, 255, 0.3)"
          stroke={config.stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Renal Hilum Core Accent */}
        <path
          d="M 44 46 C 41 49, 41 53, 44 56 C 47 53, 47 49, 44 46 Z"
          fill={config.stroke}
        />

        {/* Rank Number Overlay */}
        <text
          x="52"
          y="56"
          textAnchor="middle"
          fontSize="24"
          fontWeight="900"
          fill={config.stroke}
          fontFamily="system-ui, sans-serif"
          filter={`url(#shadow-${rank})`}
        >
          #{rank}
        </text>
      </svg>
    </div>
  );
};
