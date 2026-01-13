import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CaseDevFooter } from "@/components/case-dev-footer";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-sans" 
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Evidence Triage - AI-Powered Legal Document Classification",
  description: "Upload, classify, and organize legal evidence with AI-powered document classification. Supports 10 evidence categories with automatic tagging and relevance scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-white dark:bg-neutral-950">
        <main className="flex-1 flex flex-col">{children}</main>
        <CaseDevFooter />
      </body>
    </html>
  );
}
