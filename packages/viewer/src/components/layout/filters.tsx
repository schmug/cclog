"use client";

interface FiltersProps {
  timeRange: string;
  project: string;
  userId: string;
  projects: string[];
  users: string[];
  onTimeRange: (v: string) => void;
  onProject: (v: string) => void;
  onUser: (v: string) => void;
}

const TIME_RANGES = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "" },
];

export default function Filters({
  timeRange,
  project,
  userId,
  projects,
  users,
  onTimeRange,
  onProject,
  onUser,
}: FiltersProps) {
  const buttonBase: React.CSSProperties = {
    fontSize: "11px",
    padding: "2px 8px",
    border: "1px solid var(--color-border-bright)",
    borderRadius: "3px",
    cursor: "pointer",
    background: "transparent",
    fontFamily: "inherit",
    transition: "all 0.15s",
  };

  const selectStyle: React.CSSProperties = {
    fontSize: "11px",
    padding: "2px 8px",
    border: "1px solid var(--color-border-bright)",
    borderRadius: "3px",
    background: "var(--color-bg-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: "10px", color: "var(--color-text-dim)" }}>
        RANGE:
      </span>
      {TIME_RANGES.map((r) => {
        const isActive = timeRange === r.value;
        return (
          <button
            key={r.value}
            onClick={() => onTimeRange(r.value)}
            style={{
              ...buttonBase,
              color: isActive ? "var(--color-green)" : "var(--color-text)",
              borderColor: isActive
                ? "var(--color-green)"
                : "var(--color-border-bright)",
            }}
          >
            {r.label}
          </button>
        );
      })}

      <span
        style={{
          fontSize: "10px",
          color: "var(--color-text-dim)",
          marginLeft: "8px",
        }}
      >
        PROJECT:
      </span>
      <select
        value={project}
        onChange={(e) => onProject(e.target.value)}
        style={selectStyle}
      >
        <option value="">All</option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <span style={{ fontSize: "10px", color: "var(--color-text-dim)" }}>
        USER:
      </span>
      <select
        value={userId}
        onChange={(e) => onUser(e.target.value)}
        style={selectStyle}
      >
        <option value="">All</option>
        {users.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}
