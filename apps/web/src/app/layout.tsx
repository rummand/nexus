import type { Metadata } from "next";
import "./globals.css";
import { FontLoader } from "@/components/FontLoader";

export const metadata: Metadata = {
  title: "Nexus",
  description: "AI-native enterprise architecture canvas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full">
        <FontLoader />
        {children}
      </body>
    </html>
  );
}
