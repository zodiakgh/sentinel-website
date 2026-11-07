import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYPERGAMY",
  description: "You should not have clicked.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
