import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Goosle",
  description: "Your subscriptions, in order. No ads on the site, no algorithm, no slop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Header />
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
