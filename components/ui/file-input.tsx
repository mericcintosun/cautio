"use client";

import * as React from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Text on the riso button that opens the picker. */
  buttonLabel?: string;
  /** Shown beside the button until a file is chosen. */
  emptyText?: string;
};

// Riso file picker: the native input stays in the DOM (sr-only) so keyboard, forms and
// screen readers keep working; a label styled as the outline Button opens it, and the
// chosen file name prints beside it. Focus on the hidden input rings the label (peer).
const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { className, id, onChange, disabled, buttonLabel = "Choose photo", emptyText = "No photo yet", ...props },
  ref
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const [name, setName] = React.useState<string | null>(null);

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <input
        ref={ref}
        id={inputId}
        type="file"
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          setName(e.target.files?.[0]?.name ?? null);
          onChange?.(e);
        }}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "riso-plate cursor-pointer shadow-none hover:shadow-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:pointer-events-none peer-disabled:opacity-60"
        )}
      >
        {buttonLabel}
      </label>
      <span className="min-w-0 max-w-full truncate text-xs text-foreground">{name ?? emptyText}</span>
    </div>
  );
});

export { FileInput };
