import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Riso button: flat ink fill, 2px ink border, and the blue plate printed 3px off
// (the offset shadow). Pressing closes the misregistration.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border-2 border-foreground text-sm font-semibold uppercase tracking-wide shadow-[3px_3px_0_0_var(--secondary)] transition-[translate,box-shadow,background-color] duration-150 hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--secondary)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 disabled:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-background text-foreground hover:bg-card",
        ghost: "border-transparent bg-transparent shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-muted hover:shadow-none",
        destructive: "bg-destructive text-destructive-foreground",
        link: "border-transparent bg-transparent px-0 normal-case tracking-normal text-foreground underline decoration-2 decoration-primary underline-offset-4 shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none hover:decoration-secondary",
      },
      size: {
        // Every size reaches the 44px touch target (min-h-11 = 2.75rem).
        default: "min-h-11 px-4",
        sm: "min-h-11 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
