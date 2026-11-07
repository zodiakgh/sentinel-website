import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sentinel Analytics — Understand your traffic", template: "%s · Sentinel Analytics" },
  description: "Clear, privacy-conscious website analytics for teams that build for the web.",
  metadataBase: new URL("https://sentineldashboard.site"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
