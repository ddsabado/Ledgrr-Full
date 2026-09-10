import * as React from "react"
import { cn } from "cn"

function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="alert" className={cn("relative w-full rounded-lg border border-border bg-surface p-4 text-sm text-text", className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-medium leading-none", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted", className)} {...props} />
}

export { Alert, AlertDescription, AlertTitle }
