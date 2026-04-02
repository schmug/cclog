"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartDataPoint } from "@cc-timetravel/shared";

interface UsageChartProps {
  data: ChartDataPoint[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function UsageChart({ data }: UsageChartProps) {
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
        Sessions per Day
      </div>
      {data.length === 0 ? (
        <div
          style={{
            height: "160px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-dim)",
            fontSize: "11px",
          }}
        >
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: "var(--color-text-dim)", fontSize: 9 }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--color-text-dim)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-raised)",
                border: "1px solid var(--color-border-bright)",
                borderRadius: "3px",
                fontSize: "11px",
                color: "var(--color-text-bright)",
              }}
              labelStyle={{ color: "var(--color-text-muted)" }}
              cursor={{ fill: "var(--color-bg-hover)" }}
            />
            <Bar dataKey="sessions" fill="var(--color-green)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
