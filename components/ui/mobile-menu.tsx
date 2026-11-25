import Link from "next/link";

const ENTRIES = [
  { href: "/", label: "Lease desk" },
  { href: "/?view=open", label: "Open a deposit" },
  { href: "/about", label: "How it works" },
] as const;

/**
 * Below md the header's one link becomes this disclosure. A native <details>, so it opens
 * and closes with JavaScript off. It lists the three demo entry points.
 */
function MobileMenu() {
  return (
    <details className="relative md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm border-2 border-border bg-background px-3 text-xs font-semibold uppercase tracking-wide [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <nav
        aria-label="Demo entry points"
        className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-sm border-2 border-border bg-background shadow-[3px_3px_0_0_var(--secondary)]"
      >
        <ul>
          {ENTRIES.map((e) => (
            <li key={e.href} className="border-b-2 border-border last:border-b-0">
              <Link href={e.href} className="flex min-h-11 items-center px-3 text-sm font-semibold hover:bg-muted">
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

export { MobileMenu };
