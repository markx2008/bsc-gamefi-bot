import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSC GameFi Bot",
  description: "GameFi and DeFi Telegram Mini App on BSC",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
