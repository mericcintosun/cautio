import * as React from "react";
import { cn } from "@/lib/utils";

// Riso card: flat surface fill, ink border, and a blue outline plate printed 3px off
// (riso-plate, multiplied). Square corners per RADIUS sharp.
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("riso-plate rounded-sm border-2 border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-display text-2xl uppercase leading-none", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center border-t-2 border-border p-5", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
