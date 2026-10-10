import { createContext, useContext, useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
};

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelect() {
  const context = useContext(SelectContext);
  if (!context) throw new Error("Select components must be used within Select.");
  return context;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const selectedValue = value ?? uncontrolledValue;

  return (
    <SelectContext.Provider value={{
      value: selectedValue,
      onValueChange: (next) => {
        setUncontrolledValue(next);
        onValueChange?.(next);
      },
      open,
      setOpen,
      triggerId,
    }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, id, children, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, triggerId } = useSelect();
  return (
    <button
      type="button"
      id={id ?? triggerId}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn("inline-flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-surface2 px-3 text-sm text-text transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)}
      {...props}
    >
      {children}
      <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted" />
    </button>
  );
}

export function SelectValue() {
  const { value } = useSelect();
  return <span>{value}</span>;
}

export function SelectContent({ className, align: _align, ...props }: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  const { open } = useSelect();
  if (!open) return null;
  return <div role="listbox" className={cn("absolute bottom-full left-0 z-20 mb-1 min-w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg", className)} {...props} />;
}

export function SelectGroup(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function SelectItem({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const { value: selectedValue, onValueChange, setOpen } = useSelect();
  const selected = selectedValue === value;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        onValueChange?.(value);
        setOpen(false);
      }}
      className={cn("flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm text-text hover:bg-surface2 focus:outline-none focus-visible:bg-surface2", className)}
    >
      {children}
      {selected && <Check aria-hidden="true" className="h-4 w-4 text-accent" />}
    </button>
  );
}
