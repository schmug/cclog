"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Dashboard", href: "/" },
  { label: "Sessions", href: "/sessions" },
  { label: "Search", href: "/search" },
  { label: "Insights", href: "/insights" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        backgroundColor: "var(--color-bg-raised)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        height: "40px",
        gap: "24px",
      }}
    >
      <span
        style={{
          color: "var(--color-green)",
          fontWeight: 700,
          fontSize: "13px",
          letterSpacing: "0.05em",
          marginRight: "8px",
        }}
      >
        ▣ cclog
      </span>
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              color: isActive
                ? "var(--color-text-bright)"
                : "var(--color-text)",
              fontSize: "13px",
              textDecoration: "none",
              borderBottom: isActive
                ? "2px solid var(--color-green)"
                : "2px solid transparent",
              paddingBottom: "2px",
              lineHeight: "38px",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
