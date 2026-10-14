import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useLiveQuery } from "@tanstack/react-db"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronLeft, ListFilter, Plus, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "../../../@/components/ui/alert"
import { Button } from "../../../@/components/ui/button"
import FxEstimatedIndicator from "@/components/FxEstimatedIndicator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../@/components/ui/dialog"
import { QUERY_KEYS } from "@/constants/queryKeys"
import { budgetsCollection } from "@/collections/budgets"
import { DatePicker } from "@/components/ui/date-picker"
import { isUnresolvedForeignCurrency } from "@/utils/resolvePhp"
import { useAuth } from "@/context/AuthContext"
import { useAccountBalances } from "@/hooks/useAccountBalances"
import { useCCAccounts } from "@/hooks/useCCAccounts"
import { useCurrencies } from "@/hooks/useCurrencies"
import { useTxnCatSub } from "@/hooks/useTxnCatSub"
import { createInstallment, createRecurring } from "@/services/installmentService"
import type { NewInstallmentInput, NewRecurringInput } from "@/types/installments"
import { formatCurrency } from "@/utils/currency"
import { parseAmount } from "./buildInstallmentMonths"
import { useInstallmentsRecurring } from "./useInstallmentsRecurring"
import type { InstallmentActivityItem } from './InstallmentsViewerCard'

interface InstallmentsViewerProps {
  privacyMode: boolean
  onClose?: () => void
  fixture?: { items: readonly InstallmentActivityItem[] }
  readOnly?: boolean
}

type AlertState = { title: string; description: string } | null
type ItemTypeFilter = "any" | "installment" | "recurring"
type SortOrder = "newest" | "oldest"
type InstallmentForm = {
  name: string
  totalAmount: string
  terms: string
  startDate?: Date
  account: string
  currency: string
  budget: string
}
type RecurringForm = {
  name: string
  amount: string
  frequency: string
  startDate?: Date
  endDate?: Date
  account: string
  category: string
  subcategory: string
  currency: string
}

function toSheetDate(value: Date): string {
  return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`
}

function toMonthDate(value: Date): string {
  return `${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`
}

function startDateTimestamp(value: string): number {
  const parts = value.split('/').map(Number)
  if (parts.length === 3) return new Date(parts[2], parts[0] - 1, parts[1]).getTime()
  if (parts.length === 2) return new Date(parts[1], parts[0] - 1, 1).getTime()
  return 0
}

export default function InstallmentsViewer(props: InstallmentsViewerProps) {
  if (props.fixture) return <FixtureInstallmentsViewer {...props} fixture={props.fixture} />
  return <LiveInstallmentsViewer {...props} />
}

function LiveInstallmentsViewer({ privacyMode, onClose }: InstallmentsViewerProps) {
  const reduceMotion = useReducedMotion()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { installments, recurring, isLoading, isError } = useInstallmentsRecurring()
  const { data: debitAccounts } = useAccountBalances()
  const { data: creditAccounts } = useCCAccounts()
  const { data: currencies } = useCurrencies()
  const { categories: txnCategories } = useTxnCatSub()
  const { data: budgetRows } = useLiveQuery((q) =>
    session !== null ? q.from({ budget: budgetsCollection }) : null,
  )
  const allAccounts = useMemo(
    () => [...debitAccounts, ...creditAccounts]
      .sort((a, b) => a.name.localeCompare(b.name)),
    [creditAccounts, debitAccounts],
  )
  const installmentAccounts = useMemo(
    () => allAccounts
      .filter((account) => Number.isInteger(account.statementDay) && account.statementDay! >= 1 && account.statementDay! <= 31)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allAccounts],
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [entryType, setEntryType] = useState<"installment" | "recurring">("installment")
  const [alert, setAlert] = useState<AlertState>(null)
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("any")
  const [nameFilter, setNameFilter] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [idempotencyError, setIdempotencyError] = useState("")
  const filterActive = itemTypeFilter !== "any" || Boolean(nameFilter.trim()) || sortOrder !== "newest"
  const [form, setForm] = useState<InstallmentForm>({ name: "", totalAmount: "", terms: "", account: "", currency: "", budget: "" })
  const [recurringForm, setRecurringForm] = useState<RecurringForm>({ name: "", amount: "", frequency: "Monthly", account: "", category: "", subcategory: "", currency: "" })
  const currencyOptions = useMemo(() => Object.keys(currencies).sort(), [currencies])
  const budgetOptions = useMemo(
    () => Array.from(new Set((budgetRows ?? []).map((row) => row.name).filter(Boolean))).sort(),
    [budgetRows],
  )
  const categoryOptions = useMemo(
    () => txnCategories.map((item) => item.category).filter(Boolean).sort(),
    [txnCategories],
  )
  const subcategoryOptions = useMemo(
    () => txnCategories.find((item) => item.category === recurringForm.category)?.subcategories ?? [],
    [recurringForm.category, txnCategories],
  )

  useEffect(() => {
    if (!alert) return
    const timeout = window.setTimeout(() => setAlert(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [alert])

  const mutation = useMutation({
    mutationFn: (input: NewInstallmentInput | NewRecurringInput) => input.kind === "installment" ? createInstallment(input) : createRecurring(input),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.installments] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.recurring] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] }),
      ])
      setDialogOpen(false)
      setForm({ name: "", totalAmount: "", terms: "", account: "", currency: "", budget: "" })
      setRecurringForm({ name: "", amount: "", frequency: "Monthly", account: "", category: "", subcategory: "", currency: "" })
      setAlert(input.kind === "installment"
        ? { title: "Installment added", description: "Monthly transactions have been added to your ledger." }
        : { title: "Recurring payment added", description: "The recurring payment has been added to your ledger." })
    },
  })

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (entryType === "recurring") {
      const account = allAccounts.find((item) => item.name === recurringForm.account)
      if (!account || !recurringForm.startDate || !recurringForm.currency) return
      const name = recurringForm.name.trim()
      if (recurring.some((item) => item.name === name)) {
        setIdempotencyError("A recurring payment with this exact name already exists.")
        return
      }
      setIdempotencyError("")
      mutation.mutate({ kind: "recurring", name, amount: Number(recurringForm.amount), frequency: recurringForm.frequency.trim(), startDate: toMonthDate(recurringForm.startDate), endDate: recurringForm.endDate ? toMonthDate(recurringForm.endDate) : "", account: account.name, category: recurringForm.category.trim(), subcategory: recurringForm.subcategory.trim(), currency: recurringForm.currency })
      return
    }
    const account = installmentAccounts.find((item) => item.name === form.account)
    if (!account || !form.startDate || !form.currency) return
    const name = form.name.trim()
    const terms = Number(form.terms)
    if (installments.some((item) => item.name === name && item.account === account.name)) {
      setIdempotencyError("An installment with this exact name and account already exists.")
      return
    }
    setIdempotencyError("")
    const input: NewInstallmentInput = {
      kind: "installment", name, totalAmount: Number(form.totalAmount), terms,
      startDate: toSheetDate(form.startDate), account: account.name, budget: form.budget.trim(),
      currency: form.currency, statementDay: account.statementDay!, transactionTime: "00:00:00",
    }
    mutation.mutate(input)
  }

  const allItems = useMemo(() => [
    ...installments.map((item) => ({ key: `installment-${item.name}-${item.account}-${item.startDate}`, kind: "Installment", name: item.name, account: item.account, amount: parseAmount(item.termPayment), totalAmount: parseAmount(item.totalAmount), currency: item.currency, startDate: item.startDate, terms: `${item.terms} months`, budget: item.budget })),
    ...recurring.map((item) => ({ key: `recurring-${item.name}-${item.account}-${item.startDate}`, kind: "Recurring", name: item.name, account: item.account, amount: parseAmount(item.amount), totalAmount: undefined, currency: item.currency, startDate: item.startDate, terms: item.frequency || "Monthly", budget: item.category })),
  ], [installments, recurring])
  const filteredItems = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase()
    const direction = sortOrder === "newest" ? -1 : 1
    return allItems
      .filter((item) => itemTypeFilter === "any" || item.kind.toLowerCase() === itemTypeFilter)
      .filter((item) => !normalizedName || item.name.toLowerCase().includes(normalizedName))
      .sort((a, b) => direction * (startDateTimestamp(a.startDate) - startDateTimestamp(b.startDate)))
  }, [allItems, itemTypeFilter, nameFilter, sortOrder])

  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 30 }
  const formTransition = reduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeInOut" as const }

  return (
    <motion.section layout transition={transition} className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-text">Installments</h2>
            <p className="mt-1 text-sm text-muted">Installments and recurring payments</p>
          </div>
          <div className="flex items-center gap-2">
            {onClose && <button type="button" aria-label="Back to installments and recurring payments" onClick={onClose} className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span>Payments</span></button>}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Filter installments and recurring payments" className="relative rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ListFilter aria-hidden="true" className="h-4 w-4" />{filterActive && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />}</button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-64 flex-col gap-3 bg-surface p-3">
                <div className="flex items-center justify-between"><span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Filters</span>{filterActive && <button type="button" onClick={() => { setItemTypeFilter("any"); setNameFilter(""); setSortOrder("newest") }} className="flex items-center gap-1 rounded text-xs text-muted transition-colors hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-3 w-3" /> Clear</button>}</div>
                <label className="grid gap-1 text-xs text-muted">Type<select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as ItemTypeFilter)} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="any">Any</option><option value="installment">Installments</option><option value="recurring">Recurring</option></select></label>
                <label className="grid gap-1 text-xs text-muted">Name<input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Search name" className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>
                <label className="grid gap-1 text-xs text-muted">Sort by transaction date<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="newest">Most recent</option><option value="oldest">Oldest</option></select></label>
              </PopoverContent>
            </Popover>
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)} disabled={allAccounts.length === 0}>
              <Plus aria-hidden="true" /> New
            </Button>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {alert && (
            <motion.div layout initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }} transition={transition} className="overflow-hidden">
              <Alert className="border-success/40 bg-success/10 pr-10">
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
                <button type="button" aria-label="Dismiss notification" onClick={() => setAlert(null)} className="absolute right-3 top-3 rounded p-1 text-muted hover:bg-surface hover:text-text"><X className="h-4 w-4" /></button>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {isError && <p role="alert" className="shrink-0 text-sm text-danger">Some installment data could not be loaded.</p>}
        <motion.div layout transition={transition} className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
          {isLoading && <p className="py-8 text-center text-sm text-muted">Loading installments…</p>}
          {!isLoading && filteredItems.length === 0 && <p className="py-8 text-center text-sm text-muted">No matching installments or recurring payments.</p>}
          {!isLoading && filteredItems.length > 0 && <div className="divide-y divide-border">
            {filteredItems.map((item) => <article key={item.key} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-text">{item.name}</p><span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-muted">{item.kind}</span></div><p className="mt-1 truncate text-xs text-muted">Transaction date: {item.startDate}</p><p className="mt-0.5 truncate text-xs text-muted">{item.account} · {item.terms}</p><p className="mt-0.5 truncate text-xs text-muted">Budget: {item.budget || "—"}</p></div>
              <div className="flex shrink-0 flex-col items-end text-right"><div className="flex items-center gap-1">{isUnresolvedForeignCurrency(item.currency, null) && <FxEstimatedIndicator />}<span className="text-sm font-semibold tabular-nums text-text">{privacyMode ? "••••••" : formatCurrency(item.amount, item.currency)}</span></div>{item.totalAmount !== undefined && <span className="mt-0.5 text-xs tabular-nums text-muted">Total: {privacyMode ? "••••••" : formatCurrency(item.totalAmount, item.currency)}</span>}</div>
            </article>)}
          </div>}
        </motion.div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New payment</DialogTitle></DialogHeader>
          <div role="tablist" aria-label="Payment type" className="grid grid-cols-2 rounded-lg bg-surface2 p-1">
            {(["installment", "recurring"] as const).map((type) => <button key={type} type="button" role="tab" aria-selected={entryType === type} onClick={() => { setEntryType(type); setIdempotencyError("") }} className={`relative rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${entryType === type ? "text-text" : "text-muted hover:text-text"}`}>{entryType === type && <motion.span layoutId="new-payment-type" className="absolute inset-0 rounded-md bg-accent" transition={transition} />}<span className="relative">{type === "installment" ? "Installment" : "Recurring"}</span></button>)}
          </div>
          <form className="grid gap-3" onSubmit={submit}>
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={entryType} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={formTransition} className="grid gap-3">
            {entryType === "installment" ? <>
              <label className="grid gap-1 text-xs text-muted">Name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text" /></label>
              <div className="grid grid-cols-[7fr_3fr] gap-3"><label className="grid gap-1 text-xs text-muted">Total amount<input required min="0.01" step="0.01" type="number" value={form.totalAmount} onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text" /></label><label className="grid gap-1 text-xs text-muted">Currency<select required value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option value="">Select</option>{currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label></div>
              <label className="grid gap-1 text-xs text-muted">Terms (months)<input required min="1" step="1" type="number" value={form.terms} onChange={(event) => setForm((current) => ({ ...current, terms: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text" /></label>
              <label className="grid gap-1 text-xs text-muted">Transaction date<DatePicker value={form.startDate} onChange={(startDate) => setForm((current) => ({ ...current, startDate }))} placeholder="Select transaction date" /></label>
              <label className="grid gap-1 text-xs text-muted">Account<select required value={form.account} onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option value="">Select account</option>{installmentAccounts.map((account) => <option key={account.name} value={account.name}>{account.name} · statement day {account.statementDay}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted">Budget<select required value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option value="">Select budget</option>{budgetOptions.map((budget) => <option key={budget} value={budget}>{budget}</option>)}</select></label>
              {installmentAccounts.length === 0 && <p role="alert" className="text-sm text-danger">Add a statement day to an account before creating an installment.</p>}
            </> : <>
              <label className="grid gap-1 text-xs text-muted">Name<input required value={recurringForm.name} onChange={(event) => setRecurringForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text" /></label>
              <div className="grid grid-cols-[7fr_3fr] gap-3"><label className="grid gap-1 text-xs text-muted">Amount<input required min="0.01" step="0.01" type="number" value={recurringForm.amount} onChange={(event) => setRecurringForm((current) => ({ ...current, amount: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text" /></label><label className="grid gap-1 text-xs text-muted">Currency<select required value={recurringForm.currency} onChange={(event) => setRecurringForm((current) => ({ ...current, currency: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option value="">Select</option>{currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label></div>
              <label className="grid gap-1 text-xs text-muted">Frequency<select value={recurringForm.frequency} onChange={(event) => setRecurringForm((current) => ({ ...current, frequency: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option>Monthly</option></select></label>
              <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs text-muted">Start month<DatePicker value={recurringForm.startDate} onChange={(startDate) => setRecurringForm((current) => ({ ...current, startDate }))} placeholder="Select month" /></label><label className="grid gap-1 text-xs text-muted">End month (optional)<DatePicker value={recurringForm.endDate} onChange={(endDate) => setRecurringForm((current) => ({ ...current, endDate }))} placeholder="No end month" /></label></div>
              <label className="grid gap-1 text-xs text-muted">Account<select required value={recurringForm.account} onChange={(event) => setRecurringForm((current) => ({ ...current, account: event.target.value }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text"><option value="">Select account</option>{allAccounts.map((account) => <option key={account.name} value={account.name}>{account.name}</option>)}</select></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-muted">Category<select required value={recurringForm.category} onChange={(event) => setRecurringForm((current) => ({ ...current, category: event.target.value, subcategory: "" }))} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="">Select category</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label className="grid gap-1 text-xs text-muted">Subcategory<select value={recurringForm.subcategory} onChange={(event) => setRecurringForm((current) => ({ ...current, subcategory: event.target.value }))} disabled={!recurringForm.category} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="">{recurringForm.category ? "Select subcategory" : "Select category first"}</option>{subcategoryOptions.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}</select></label></div>
            </>}
            </motion.div>
            </AnimatePresence>
            {idempotencyError && <p role="alert" className="text-sm text-danger">{idempotencyError}</p>}
            {mutation.isError && <p role="alert" className="text-sm text-danger">Could not add the installment. Please try again.</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Adding…" : "Add installment"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.section>
  )
}

/** Fixture branch retains the production viewer's header and filters without live collections. */
function FixtureInstallmentsViewer({ privacyMode, onClose, fixture }: InstallmentsViewerProps & { fixture: { items: readonly InstallmentActivityItem[] } }) {
  const [type, setType] = useState<ItemTypeFilter>('any')
  const [name, setName] = useState('')
  const items = fixture.items.filter((item) => (type === 'any' || item.kind.toLowerCase() === type) && (!name || item.name.toLowerCase().includes(name.toLowerCase())))
  return <motion.section className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5"><div className="flex h-full min-h-0 flex-col gap-4"><header className="flex shrink-0 items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold tracking-tight text-text">Installments</h2><p className="mt-1 text-sm text-muted">Installments and recurring payments</p></div><div className="flex items-center gap-2">{onClose && <button type="button" aria-label="Back to installments and recurring payments" onClick={onClose} className="min-h-11 px-2 text-xs text-muted">Payments</button>}<Popover><PopoverTrigger asChild><button type="button" aria-label="Filter installments and recurring payments" className="min-h-11 px-2 text-xs text-muted">Filters</button></PopoverTrigger><PopoverContent className="grid gap-3"><label className="text-xs text-muted">Type<select value={type} onChange={(event) => setType(event.target.value as ItemTypeFilter)}><option value="any">Any</option><option value="installment">Installments</option><option value="recurring">Recurring</option></select></label><label className="text-xs text-muted">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Search name" /></label></PopoverContent></Popover><Button type="button" size="sm" disabled title="Demo mode — new payments are unavailable"><Plus aria-hidden="true" /> New</Button></div></header><p role="status" className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Demo mode — activity is read-only and changes are not saved.</p><div className="min-h-0 flex-1 overflow-y-auto">{items.length === 0 ? <p className="py-8 text-center text-sm text-muted">No matching installments or recurring payments.</p> : <div className="divide-y divide-border">{items.map((item) => <article key={item.key} className="flex items-start justify-between gap-3 py-3"><div><div className="flex gap-2"><p className="text-sm font-medium text-text">{item.name}</p><span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-muted">{item.kind}</span></div><p className="mt-1 text-xs text-muted">Transaction date: {item.startDate}</p><p className="text-xs text-muted">{item.account} · {item.terms}</p><p className="text-xs text-muted">Budget: {item.budget || '—'}</p></div><span className="text-sm font-semibold tabular-nums text-text">{privacyMode ? '••••••' : formatCurrency(item.amount, item.currency)}</span></article>)}</div>}</div></div></motion.section>
}
