import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "JobLink", description: "Share opportunities. Grow together." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
