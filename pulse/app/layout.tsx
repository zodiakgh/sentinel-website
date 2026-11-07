import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sentinel Pulse — Infrastructure monitoring",
    template: "%s · Sentinel Pulse"
  },
  description: "Monitor uptime, understand incidents and keep your web services reliable.",
  applicationName: "Sentinel Pulse",
  metadataBase: new URL("https://pulse.example.com")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
