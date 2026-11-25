import * as React from "react";
import { cn } from "@/lib/utils";

// Riso field: stock fill, 2px ink border; focus prints the blue plate off-register.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-sm border-2 border-input bg-background px-3 py-1 text-sm tabular-nums transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[3px_3px_0_0_var(--secondary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 file:mr-3 file:h-full file:border-0 file:border-r-2 file:border-foreground file:bg-muted file:px-3 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Input };
