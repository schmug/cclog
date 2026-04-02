import Link from "next/link";
import { formatCost, formatRelativeTime } from "@/lib/format";
import type { SearchResult } from "@cc-timetravel/shared";

interface SearchResultsProps {
  results: SearchResult[];
}

function renderSnippet(snippet: string) {
  // Replace »...« markers with highlighted spans
  const parts = snippet.split(/(»[^«]*«)/g);
  return parts.map((part, i) => {
    if (part.startsWith("»") && part.endsWith("«")) {
      const text = part.slice(1, -1);
      return (
        <mark
          key={i}
          style={{
            backgroundColor: "var(--color-green-dim)",
            color: "var(--color-green)",
            borderRadius: "2px",
            padding: "0 2px",
          }}
        >
          {text}
        </mark>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div
        style={{
          padding: "24px",
          color: "var(--color-text-dim)",
          fontSize: "11px",
          textAlign: "center",
        }}
      >
        No results found
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {results.map((result) => (
        <div
          key={result.sessionId}
          style={{
            backgroundColor: "var(--color-bg-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            padding: "10px 14px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-bright)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "6px",
            }}
          >
            <Link
              href={`/sessions/${result.sessionId}`}
              style={{
                color: "var(--color-blue)",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {result.slug || result.sessionId.slice(0, 8)}
            </Link>
            <span style={{ fontSize: "10px", color: "var(--color-red)", flexShrink: 0 }}>
              {formatCost(result.totalCost)}
            </span>
          </div>

          {result.snippet && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
                marginBottom: "8px",
                fontStyle: "italic",
              }}
            >
              {renderSnippet(result.snippet)}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "10px",
              color: "var(--color-text-dim)",
            }}
          >
            <span>{result.projectName}</span>
            <span>{result.messageCount} msgs</span>
            <span>{formatRelativeTime(result.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
