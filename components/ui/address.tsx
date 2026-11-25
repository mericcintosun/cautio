"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A long hex value (address, hash, commit) shown as its first 6 and last 4 characters.
 * The full value sits in `title` and one click copies it. With `href`, the short form
 * links to the explorer in a new tab.
 */
function ShortHex({ value, href, className }: { value: string; href?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const short = value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context or permissions): the value is still in the title.
    }
  }

  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1 align-middle tabular-nums", className)}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={value}
          className="truncate underline decoration-primary decoration-2 underline-offset-2 hover:decoration-secondary"
        >
          {short}
        </a>
      ) : (
        <span title={value} className="truncate">
          {short}
        </span>
      )}
      <Button type="button" size="icon" variant="ghost" aria-label="Copy full value" title="Copy full value" onClick={() => void copy()}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </span>
  );
}

export { ShortHex };
