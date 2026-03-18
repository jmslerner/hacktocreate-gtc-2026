import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackToCreate — AI Production Panel",
  description: "GPU-powered AI production company agents for video creators and short film makers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="film-grain bg-cinema-black min-h-screen text-cinema-text antialiased">
        {/* Top bar */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-cinema-border bg-cinema-black/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cinema-accent animate-pulse-slow" />
              <span className="font-mono text-sm tracking-widest uppercase text-cinema-accent font-medium">
                HackToCreate
              </span>
              <span className="text-cinema-border text-xs font-mono">|</span>
              <span className="text-cinema-muted text-xs font-mono">GTC 2026</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cinema-green animate-pulse" />
              <span className="text-cinema-muted text-xs font-mono">GB10 GPU ONLINE</span>
            </div>
          </div>
        </header>
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
