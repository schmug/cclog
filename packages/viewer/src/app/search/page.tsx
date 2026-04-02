"use client";

import { useState, useCallback } from "react";
import SearchResults from "@/components/search-results";
import type { SearchResult } from "@cclog/shared";

type Mode = "keyword" | "semantic";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("keyword");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ q, mode, limit: "20" });
      const res = await fetch(`/api/search?${params}`);
      const json = await res.json();
      setResults(json.results ?? []);
      if (json.message) setMessage(json.message);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, mode]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") doSearch();
  }

  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "12px",
        }}
      >
        Search
      </div>

      {/* Search bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search sessions..."
          style={{
            flex: 1,
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-border-bright)",
            borderRadius: "4px",
            padding: "7px 12px",
            fontSize: "12px",
            color: "var(--color-text-bright)",
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--color-blue)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--color-border-bright)";
          }}
        />

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            border: "1px solid var(--color-border-bright)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          {(["keyword", "semantic"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? "var(--color-bg-hover)" : "var(--color-bg-raised)",
                border: "none",
                borderRight: m === "keyword" ? "1px solid var(--color-border-bright)" : "none",
                color:
                  mode === m ? "var(--color-text-bright)" : "var(--color-text-muted)",
                cursor: "pointer",
                padding: "7px 12px",
                fontSize: "11px",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-border-bright)",
            borderRadius: "4px",
            color: query.trim() ? "var(--color-text-bright)" : "var(--color-text-dim)",
            cursor: query.trim() ? "pointer" : "default",
            padding: "7px 16px",
            fontSize: "11px",
            fontFamily: "inherit",
          }}
        >
          {loading ? "searching..." : "Search"}
        </button>
      </div>

      {/* Message / error */}
      {message && (
        <div
          style={{
            backgroundColor: "var(--color-bg-raised)",
            border: "1px solid var(--color-border)",
            borderLeft: "3px solid var(--color-purple)",
            borderRadius: "4px",
            padding: "10px 14px",
            marginBottom: "12px",
            fontSize: "11px",
            color: "var(--color-text-muted)",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            color: "var(--color-red)",
            fontSize: "11px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <div>
          {results.length > 0 && (
            <div
              style={{
                fontSize: "9px",
                color: "var(--color-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
          )}
          <SearchResults results={results} />
        </div>
      )}
    </div>
  );
}
