import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sentinel Analytics — Website intelligence",
    template: "%s | Sentinel Analytics",
  },
  description:
    "Understand your website with real-time analytics, privacy-conscious tracking and clear, actionable insights.",
  metadataBase: new URL("https://sentineldashboard.site"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
