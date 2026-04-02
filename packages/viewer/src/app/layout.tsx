import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/layout/nav";

export const metadata: Metadata = {
  title: "cclog",
  description: "Claude Code session explorer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Nav />
        <main style={{ padding: "16px" }}>{children}</main>
      </body>
    </html>
  );
}
