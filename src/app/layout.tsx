import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "CYBERDESK — Security Operations Workspace",
    template: "%s · CYBERDESK",
  },
  description:
    "A portfolio-grade security operations workspace demonstrating full-stack application architecture, incident management, persistence, authentication, and security-focused UX. All data is fictional demo data.",
  keywords: ["security operations", "incident management", "portfolio project", "demo data"],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `(function(){try{var t=localStorage.getItem("cd-theme");var r=localStorage.getItem("cd-reduce-motion")=="1";var l=t=="light";document.documentElement.classList.toggle("light",l);document.documentElement.classList.toggle("dark",!l);if(r)document.documentElement.classList.add("reduce-motion");}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Stylesheet font loading: works offline-safe with system fallbacks in the App Router root layout. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
