import type { ToolBreakdown } from "@cclog/shared";

interface ToolBreakdownProps {
  data: ToolBreakdown[];
}

function toolColor(name: string): string {
  if (name === "Edit" || name === "MultiEdit") return "var(--color-green)";
  if (name === "Read") return "var(--color-blue)";
  if (name === "Bash") return "var(--color-amber)";
  if (name === "Grep" || name === "Glob") return "var(--color-purple)";
  return "var(--color-text-muted)";
}

export default function ToolBreakdownChart({ data }: ToolBreakdownProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "12px",
        }}
      >
        Tool Breakdown
      </div>
      {data.length === 0 ? (
        <div
          style={{
            color: "var(--color-text-dim)",
            fontSize: "11px",
            padding: "8px 0",
          }}
        >
          No data
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.map((t) => {
            const color = toolColor(t.tool_name);
            return (
              <div key={t.tool_name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "3px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--color-text)" }}>
                    {t.tool_name}
                  </span>
                  <span style={{ fontSize: "11px", color }}>
                    {t.percentage.toFixed(1)}%{" "}
                    <span style={{ color: "var(--color-text-dim)" }}>
                      ({t.count.toLocaleString()})
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: "4px",
                    backgroundColor: "var(--color-border-bright)",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${t.percentage}%`,
                      backgroundColor: color,
                      borderRadius: "2px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
