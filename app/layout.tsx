import type { Metadata } from "next";
import Link from "next/link";
import { Anton, Work_Sans } from "next/font/google";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { DEFAULT_LEASE_ID } from "@/lib/data";
import "./globals.css";

const anton = Anton({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-anton" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", variable: "--font-work-sans" });

export const metadata: Metadata = {
  title: { default: "Cautio: rental deposits neither side can touch alone", template: "%s | Cautio" },
  description:
    "Cautio holds a rental deposit in USDG on Arbitrum, splits every move-out deduction into photo-backed items, and settles disputes by having an arbiter pick one of two sealed final offers.",
  metadataBase: new URL("https://cautio.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${workSans.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <header className="sticky top-0 z-40 border-b-2 border-border bg-background">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
            <NavLink
              href="/"
              className="flex items-center gap-2.5 font-display text-2xl uppercase tracking-wide decoration-2 underline-offset-8"
              activeClassName="underline decoration-secondary"
            >
              <BrandMark size={30} />
              Cautio
            </NavLink>
            <nav className="flex items-center gap-4">
              <NavLink
                href="/about"
                className="text-sm font-semibold underline decoration-primary decoration-2 underline-offset-4 hover:decoration-secondary"
                activeClassName="decoration-secondary decoration-4"
              >
                How it works
              </NavLink>
              <Button asChild size="sm">
                <Link href={`/?lease=${DEFAULT_LEASE_ID}`}>Walk the disputed move-out</Link>
              </Button>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t-2 border-border">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground lg:px-8">
            <p>Deposits held by DepositVault on Arbitrum Sepolia, denominated in USDG.</p>
            <p>Built for Arbitrum Open House São Paulo.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
