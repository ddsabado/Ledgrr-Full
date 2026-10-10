import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A local shadcn-style pagination primitive. The `text` prop follows the
 * shadcn icons-only example while retaining a useful accessible name.
 */
export function Pagination({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({
  className,
  ...props
}: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

export function PaginationItem(props: HTMLAttributes<HTMLLIElement>) {
  return <li {...props} />;
}

type PaginationControlProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  text?: boolean;
};

const controlClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50";

export function PaginationPrevious({
  className,
  text = true,
  type = "button",
  "aria-label": ariaLabel = "Go to previous page",
  title = "Go to previous page",
  ...props
}: PaginationControlProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={cn(controlClassName, className)}
      {...props}
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      {text && <span>Previous</span>}
    </button>
  );
}

export function PaginationNext({
  className,
  text = true,
  type = "button",
  "aria-label": ariaLabel = "Go to next page",
  title = "Go to next page",
  ...props
}: PaginationControlProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={cn(controlClassName, className)}
      {...props}
    >
      {text && <span>Next</span>}
      <ChevronRight aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
