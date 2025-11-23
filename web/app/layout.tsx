import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Use Geist as body font (similar serif alternative to Crimson Pro)
const bodyFont = Geist({
  variable: "--font-crimson",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Agent - Your Personal AI Assistant",
  description: "Intelligent conversation agent powered by Claude AI. Natural interactions with meaningful context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${bodyFont.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
