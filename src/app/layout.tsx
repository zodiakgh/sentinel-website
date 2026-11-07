import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sentinel Pulse — Know when it matters",
    template: "%s | Sentinel Pulse"
  },
  description: "Monitor websites and APIs, understand incidents, and keep your services reliable.",
  applicationName: "Sentinel Pulse"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
