import type { Metadata } from "next";
import Link from "next/link";
import { Anton, Work_Sans } from "next/font/google";
import { BrandMark } from "@/components/brand-mark";
import { ShortHex } from "@/components/ui/address";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { NavLink } from "@/components/ui/nav-link";
import { WalletButton } from "@/components/wallet-button";
import { WalletProvider } from "@/components/wallet-provider";
import { CHAIN_ID, EXPLORER, VAULT_ADDRESS } from "@/lib/config";
import "./globals.css";

const anton = Anton({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-anton" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", variable: "--font-work-sans" });

// 151 characters: the problem (a deposit) and the fix (lines plus one sealed offer picked).
const description =
  "Rental deposits locked in USDG on Arbitrum. Every move-out deduction is a photo-backed line, and disputes end with an arbiter picking one sealed offer.";
const title = "Cautio: rental deposits neither side can touch alone";

export const metadata: Metadata = {
  title: { default: title, template: "%s | Cautio" },
  description,
  metadataBase: new URL("https://cautio-beta.vercel.app"),
  openGraph: { title, description, url: "/", siteName: "Cautio", type: "website" },
  twitter: { card: "summary_large_image" },
};

const SOURCE_URL = "https://github.com/mericcintosun/cautio";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${workSans.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <WalletProvider>
        <header className="sticky top-0 z-40 border-b-2 border-border bg-background">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 lg:px-8">
            <NavLink
              href="/"
              aria-label="Cautio, lease desk"
              className="flex min-h-11 items-center gap-2.5 font-display text-2xl uppercase tracking-wide decoration-2 underline-offset-8"
              activeClassName="underline decoration-secondary"
            >
              <BrandMark size={30} />
              <span className="sr-only sm:not-sr-only">Cautio</span>
            </NavLink>
            <nav className="flex items-center gap-2 sm:gap-4">
              <NavLink
                href="/about"
                className="hidden text-sm font-semibold underline decoration-primary decoration-2 underline-offset-4 hover:decoration-secondary md:inline-flex"
                activeClassName="decoration-secondary decoration-4"
              >
                How it works
              </NavLink>
              <MobileMenu />
              <WalletButton />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t-2 border-border">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground lg:px-8">
            <p>Deposits held by DepositVault on Arbitrum Sepolia, denominated in USDG.</p>
            <p>Built for Arbitrum Open House São Paulo.</p>
          </div>
          <div
            aria-label="About and security"
            className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-dashed border-border px-4 py-3 text-xs text-muted-foreground lg:px-8"
          >
            <p className="font-semibold uppercase tracking-wider text-foreground">About and security</p>
            <p className="flex min-w-0 items-center gap-1">
              <span>DepositVault</span>
              {VAULT_ADDRESS ? (
                <ShortHex value={VAULT_ADDRESS} href={`${EXPLORER}/address/${VAULT_ADDRESS}`} />
              ) : (
                <span>not deployed in this build</span>
              )}
            </p>
            <p>Arbitrum Sepolia, chain id {CHAIN_ID}</p>
            <p>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:decoration-secondary"
              >
                Source on GitHub
              </a>
            </p>
            <p>
              <Link href="/about" className="underline decoration-primary decoration-2 underline-offset-2 hover:decoration-secondary">
                How it works
              </Link>
            </p>
          </div>
        </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
