"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Header link that knows where it is. usePathname needs no Suspense boundary.
// Active state: aria-current="page" plus a blue-plate underline.
function NavLink({
  href,
  className,
  activeClassName,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string; activeClassName?: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && (activeClassName ?? "decoration-secondary"))}
      {...props}
    >
      {children}
    </Link>
  );
}

export { NavLink };
