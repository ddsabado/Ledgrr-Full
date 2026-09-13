import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../@/components/ui/dialog";
import type { NewCreditCardInput } from "@/types/accounts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAccountImageUrl } from "./utils";

interface Props {
  open: boolean;
  currencies: string[];
  images: string[];
  imagesLoading: boolean;
  imageError: string | null;
  isSubmitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: NewCreditCardInput) => void;
}

const initialForm = {
  name: "",
  creditLimit: "",
  initialBalance: "0",
  currency: "PHP",
  image: "",
  statementDay: "",
  dueDay: "",
  metadata: "",
};

/** Form for a complete Accounts-sheet credit-card row. */
export default function NewCreditCardDialog({
  open,
  currencies,
  images,
  imagesLoading,
  imageError,
  isSubmitting,
  error,
  onOpenChange,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      currency: currencies.includes(current.currency)
        ? current.currency
        : currencies[0] || "PHP",
    }));
  }, [open, currencies]);

  const set = (field: keyof typeof initialForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: form.name,
      creditLimit: Number(form.creditLimit),
      initialBalance: Number(form.initialBalance),
      currency: form.currency,
      image: form.image,
      statementDay: Number(form.statementDay),
      dueDay: Number(form.dueDay),
      metadata: form.metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New credit card</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Account">
              <input
                required
                autoFocus
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Account Currency">
              <select
                required
                value={form.currency}
                onChange={(event) => set("currency", event.target.value)}
                className={inputClass}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <NumberField
              label="Credit Limit"
              value={form.creditLimit}
              onChange={(value) => set("creditLimit", value)}
              min="0"
              required
            />
            <NumberField
              label="Initial Balance"
              value={form.initialBalance}
              onChange={(value) => set("initialBalance", value)}
            />
            <NumberField
              label="Statement Day"
              value={form.statementDay}
              onChange={(value) => set("statementDay", value)}
              min="1"
              max="31"
              step="1"
              required
            />
            <NumberField
              label="Due Day"
              value={form.dueDay}
              onChange={(value) => set("dueDay", value)}
              min="1"
              max="31"
              step="1"
              required
            />
          </div>
          <div className="grid gap-1 text-xs text-muted">
            <span>Image</span>
            <ImagePicker
              value={form.image}
              images={images}
              loading={imagesLoading}
              onChange={(image) => set("image", image)}
            />
            {imageError && (
              <span className="text-danger">
                Could not load account images.
              </span>
            )}
          </div>
          <Field label="Metadata (optional)">
            <textarea
              value={form.metadata}
              onChange={(event) => set("metadata", event.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm text-muted hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-text disabled:opacity-50"
            >
              {isSubmitting ? "Adding…" : "Add credit card"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = "0.01",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        required={required}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

function ImagePicker({
  value,
  images,
  loading,
  onChange,
}: {
  value: string;
  images: string[];
  loading: boolean;
  onChange: (image: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedUrl = value ? getAccountImageUrl(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className={`${inputClass} flex h-10 items-center gap-2 text-left disabled:opacity-50`}
        >
          {selectedUrl ? (
            <img
              src={selectedUrl}
              alt=""
              className="h-6 w-10 rounded object-contain"
            />
          ) : null}
          {!selectedUrl && <span className="truncate">{loading ? "Loading images…" : "No image"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`flex aspect-[1.6] items-center justify-center rounded-md border text-xs text-muted hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${value === "" ? "border-accent" : "border-border"}`}
          >
            None
          </button>
          {images.map((image) => {
            const url = getAccountImageUrl(image);
            return (
              <button
                key={image}
                type="button"
                title={image}
                aria-label={`Select ${image}`}
                onClick={() => {
                  onChange(image);
                  setOpen(false);
                }}
                className={`aspect-[1.6] overflow-hidden rounded-md border bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${value === image ? "border-accent" : "border-border hover:border-muted"}`}
              >
                {url && (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
