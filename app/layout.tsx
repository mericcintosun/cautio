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
const HACKATHON_URL = "https://www.hackquest.io/hackathons/Arbitrum-Open-House-Sao-Paulo-Online-Buildathon";
const FOOT_LINK = "font-semibold underline decoration-primary decoration-2 underline-offset-2 hover:decoration-secondary";

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
              className="flex min-h-11 shrink-0 items-center gap-2 font-display uppercase tracking-wide decoration-2 underline-offset-8 sm:gap-2.5"
              activeClassName="underline decoration-secondary"
            >
              <BrandMark size={30} />
              <span className="text-xl sm:text-2xl">Cautio</span>
            </NavLink>
            <nav className="flex min-w-0 items-center gap-2 sm:gap-4">
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
        <footer className="border-t-2 border-border bg-card">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-5 text-xs text-foreground lg:px-8">
            <ul aria-label="About and security" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <li>
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
                  Source on GitHub
                </a>
              </li>
              <li>
                <a href={HACKATHON_URL} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
                  Hackathon page
                </a>
              </li>
              <li>
                <Link href="/about" className={FOOT_LINK}>
                  How it works
                </Link>
              </li>
              <li className="flex min-w-0 items-center gap-1">
                <span>DepositVault</span>
                {VAULT_ADDRESS ? (
                  <ShortHex value={VAULT_ADDRESS} href={`${EXPLORER}/address/${VAULT_ADDRESS}`} />
                ) : (
                  <span>not deployed in this build</span>
                )}
              </li>
              <li>Chain id {CHAIN_ID}</li>
            </ul>
            <p className="text-muted-foreground">Built for Arbitrum Open House São Paulo.</p>
          </div>
        </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
