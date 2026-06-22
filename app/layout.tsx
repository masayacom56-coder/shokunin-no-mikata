import type { Metadata, Viewport } from "next";
import { AdminTelemetryListener } from "@/components/admin-telemetry-listener";
import { StyleLoadWatchdog } from "@/components/style-load-watchdog";
import "./globals.css";

export const metadata: Metadata = {
  title: "職人の味方",
  description: "現場で見積作成、PDF生成、顧客送付まで完結する職人向けPWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "職人の味方",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#2f5d50",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <StyleLoadWatchdog />
        <AdminTelemetryListener />
        {children}
      </body>
    </html>
  );
}
