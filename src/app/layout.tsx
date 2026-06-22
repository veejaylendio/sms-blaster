import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/supabase-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SMS Blaster | NexusCore",
  description: "A modern web application for sending bulk SMS blasts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-accent/30">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="relative z-10 flex-grow flex flex-col">
          <SupabaseProvider>
            {children}
          </SupabaseProvider>
        </div>
        <Toaster theme="dark" closeButton richColors />
      </body>
    </html>
  );
}
