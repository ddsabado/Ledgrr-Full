import { useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, Split, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../@/components/ui/dialog";
import { Button } from "../../../@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { budgetsCollection } from "@/collections/budgets";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useCCAccounts } from "@/hooks/useCCAccounts";
import { useCurrencies } from "@/hooks/useCurrencies";
import { useAuth } from "@/context/AuthContext";
import { useTxnCatSub } from "@/hooks/useTxnCatSub";
import { useSubmitDebtReceivable } from "@/hooks/useDebtReceivableMutations";
import type { NewDebtReceivableInput } from "@/types/debtsReceivables";

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
type Direction = "Receivable" | "Payable";
type SplitBy = "Exact" | "Percent";
type Participant = { name: string; share: string };

function today() {
  const date = new Date();
  return date;
}
function sheetDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export default function SplitBillDialog({
  open,
  onOpenChange,
}: SplitBillDialogProps) {
  const reduceMotion = useReducedMotion();
  const { session } = useAuth();
  const { data: debitAccounts } = useAccountBalances();
  const { data: creditAccounts } = useCCAccounts();
  const { data: currencies } = useCurrencies();
  const { data: budgetRows } = useLiveQuery((q) =>
    session ? q.from({ budget: budgetsCollection }) : null,
  );
  const { categories: txnCategories } = useTxnCatSub();
  const [category, setCategory] = useState("");
  const accounts = useMemo(
    () =>
      [...debitAccounts, ...creditAccounts]
        .map((account) => account.name)
        .sort(),
    [creditAccounts, debitAccounts],
  );
  const currencyOptions = useMemo(
    () => Object.keys(currencies).sort(),
    [currencies],
  );
  const budgetOptions = useMemo(
    () =>
      Array.from(
        new Set((budgetRows ?? []).map((row) => row.name).filter(Boolean)),
      ).sort(),
    [budgetRows],
  );
  const categoryOptions = useMemo(
    () => txnCategories.map((item) => item.category).sort(),
    [txnCategories],
  );
  const subcategoryOptions = useMemo(
    () => txnCategories.find((item) => item.category === category)?.subcategories ?? [],
    [category, txnCategories],
  );

  const [step, setStep] = useState<"menu" | "form">("menu");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [date, setDate] = useState<Date | undefined>(today);
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [direction, setDirection] = useState<Direction>("Receivable");
  const [subcategory, setSubcategory] = useState("");
  const [budget, setBudget] = useState("");
  const [splitBy, setSplitBy] = useState<SplitBy>("Exact");
  const [participants, setParticipants] = useState<Participant[]>([
    { name: "Me", share: "" },
    { name: "", share: "" },
  ]);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("menu");
    setName("");
    setAccount("");
    setDate(today());
    setTotalAmount("");
    setCurrency("PHP");
    setDirection("Receivable");
    setCategory("");
    setSubcategory("");
    setBudget("");
    setSplitBy("Exact");
    setParticipants([
      { name: "Me", share: "" },
      { name: "", share: "" },
    ]);
    setError("");
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };
  const mutation = useSubmitDebtReceivable();
  const submitMutation = (input: NewDebtReceivableInput) => {
    mutation.mutate(input, {
      onSuccess: close,
      onError: (cause) => setError(cause instanceof Error ? cause.message : "Failed to add split bill"),
    });
  };

  const total = Number(totalAmount) || 0;
  const shareTotal = participants.reduce(
    (sum, participant) => sum + (Number(participant.share) || 0),
    0,
  );
  const expected = splitBy === "Percent" ? 100 : total;
  const balanced = Math.abs(shareTotal - expected) <= 0.01;
  const updateParticipant = (
    index: number,
    field: keyof Participant,
    value: string,
  ) =>
    setParticipants((current) =>
      current.map((participant, i) =>
        i === index ? { ...participant, [field]: value } : participant,
      ),
    );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const validParticipants = participants.filter((participant) =>
      participant.name.trim(),
    );
    if (
      !name.trim() ||
      (direction === "Receivable" && !account) ||
      !date ||
      total <= 0 ||
      !category ||
      validParticipants.length < 2 ||
      validParticipants.some((participant) => Number(participant.share) <= 0) ||
      !balanced
    ) {
      setError(
        !balanced
          ? `Shares must equal ${splitBy === "Percent" ? "100%" : total.toFixed(2)}`
          : "Complete all required fields and participant shares",
      );
      return;
    }
    setError("");
    submitMutation({
      name: name.trim(),
      account: direction === "Receivable" ? account : "",
      date: sheetDate(date),
      totalAmount: total,
      participants: validParticipants.map((participant) => ({
        name: participant.name.trim(),
        share: Number(participant.share),
      })),
      splitBy,
      category,
      subcategory,
      budget,
      direction,
      currency,
    });
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 30 };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent className={step === "form" ? "max-w-2xl" : "max-w-sm"}>
        <AnimatePresence mode="wait" initial={false}>
          {step === "menu" ? (
            <motion.div
              key="menu"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <DialogHeader>
                <DialogTitle>New</DialogTitle>
              </DialogHeader>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="mt-5 flex w-full items-center gap-3 rounded-xl border border-border bg-surface2 p-4 text-left transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
                  <Split aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text">
                    Split Bill
                  </span>
                  <span className="block text-xs text-muted">
                    Track shared expenses and repayments
                  </span>
                </span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <DialogHeader>
                <DialogTitle>Split Bill</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={submit}
                className="mt-4 max-h-[75vh] space-y-4 overflow-y-auto overscroll-contain pr-1"
              >
                <label className="grid gap-1 text-xs text-muted">
                  Transaction name
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Dinner at restaurant"
                    className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </label>
                <div className={`grid gap-3 ${direction === "Receivable" ? "sm:grid-cols-2" : ""}`}>
                  {direction === "Receivable" && <label className="grid gap-1 text-xs text-muted">
                    Source account
                    <select required value={account} onChange={(event) => setAccount(event.target.value)} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      <option value="">Select account</option>
                      {accounts.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>}
                  <label className="grid gap-1 text-xs text-muted">
                    Transaction date
                    <DatePicker value={date} onChange={setDate} />
                  </label>
                </div>
                <div className="grid grid-cols-[7fr_3fr] gap-3">
                  <label className="grid gap-1 text-xs text-muted">
                    Total amount
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                      className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Currency
                    <select
                      required
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {currencyOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted">
                    Who paid?
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">
                    {(
                      [
                        ["Receivable", "I Paid"],
                        ["Payable", "They Paid"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDirection(value)}
                        className={`rounded-md px-3 py-2 text-sm ${direction === value ? "bg-accent text-text" : "text-muted hover:text-text"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs text-muted">
                    Category
                    <select
                      required
                      value={category}
                      onChange={(event) => {
                        setCategory(event.target.value);
                        setSubcategory("");
                      }}
                      className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Subcategory
                    <select
                      value={subcategory}
                      onChange={(event) => setSubcategory(event.target.value)}
                      className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      disabled={!category}
                    >
                      <option value="">None</option>
                      {subcategoryOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs text-muted">
                  Budget
                  <select
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="">No budget</option>
                    {budgetOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="mb-1 block text-xs text-muted">
                    Split by
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">
                    {(["Exact", "Percent"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSplitBy(value)}
                        className={`rounded-md px-3 py-2 text-sm ${splitBy === value ? "bg-accent text-text" : "text-muted hover:text-text"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Participants</span>
                    <button
                      type="button"
                      onClick={() =>
                        setParticipants((current) => [
                          ...current,
                          { name: "", share: "" },
                        ])
                      }
                      className="flex items-center gap-1 rounded-md bg-surface2 px-2 py-1 text-xs text-text"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  {participants.map((participant, index) => (
                    <div key={index} className="flex min-w-0 gap-2">
                      {index > 0 ? (
                        <button
                          type="button"
                          aria-label={`Remove participant ${index + 1}`}
                          onClick={() =>
                            setParticipants((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-md bg-danger/15 px-2 text-danger"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="w-8 shrink-0" />
                      )}
                      <input
                        value={participant.name}
                        disabled={index === 0}
                        onChange={(event) =>
                          updateParticipant(index, "name", event.target.value)
                        }
                        placeholder={index === 0 ? "Me" : "Person"}
                        className="min-w-0 flex-1 rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={participant.share}
                        onChange={(event) =>
                          updateParticipant(index, "share", event.target.value)
                        }
                        placeholder={splitBy === "Percent" ? "50" : "500"}
                        className="w-24 shrink-0 rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>
                  ))}
                  <div
                    className={`rounded-lg border p-3 text-xs ${balanced ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}
                  >
                    Total:{" "}
                    {splitBy === "Percent"
                      ? `${shareTotal.toFixed(2)}%`
                      : shareTotal.toFixed(2)}{" "}
                    / Expected:{" "}
                    {splitBy === "Percent" ? "100%" : total.toFixed(2)}
                  </div>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-md bg-danger/10 p-3 text-sm text-danger"
                  >
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={close}
                    disabled={mutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Adding..." : "Add Split Bill"}
                  </Button>
                </DialogFooter>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
