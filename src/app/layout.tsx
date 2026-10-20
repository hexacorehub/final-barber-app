import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mister Bigode", template: "%s · Mister Bigode" },
  description: "Agende, assine o Mister Club e acompanhe seus cortes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
