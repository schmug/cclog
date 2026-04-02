interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  trend?: string;
  trendColor?: string;
}

export default function StatCard({
  label,
  value,
  color = "var(--color-text-bright)",
  trend,
  trendColor = "var(--color-text-muted)",
}: StatCardProps) {
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
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "22px",
          color,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {trend && (
        <div
          style={{
            fontSize: "10px",
            color: trendColor,
            marginTop: "4px",
          }}
        >
          {trend}
        </div>
      )}
    </div>
  );
}
