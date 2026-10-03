---
target: budgets cards
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/Budgets/index.tsx"
target_fingerprint: "sha256:294fb037e39400bc3fe3cd38e53a64519d3f0066140f429aec9fc77561289499"
target_path: /Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/Budgets/index.tsx
timestamp: 2026-10-03T01-52-31Z
slug: src-features-budgets-index-tsx
---
## Budgets

### Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Row progress is visible; no overall health, loading label, or retry. |
| 2 | Match System / Real World | 4 | Spent, allotted, left, and overage language is natural. |
| 3 | User Control and Freedom | 2 | Arrow-only month navigation; expansion resets on month change. |
| 4 | Consistency and Standards | 3 | Cohesive card/row pattern, but small month controls. |
| 5 | Error Prevention | 2 | Zero-allotment spending becomes unexplained 999.9%. |
| 6 | Recognition Rather Than Recall | 3 | Row state is legible; comparison relies on memory. |
| 7 | Flexibility and Efficiency | 2 | No current-month jump, picker, sorting, filtering, or at-risk view. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm rows, but equal-weight ordering hinders scanability. |
| 9 | Error Recovery | 1 | Error has no retry; empty state has no route forward. |
| 10 | Help and Documentation | 1 | No explanation of thresholds, counted transactions, offsets, or FX. |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

### Design Specificity Verdict

The card is genuinely budget-specific: monthly allotted versus spent, remaining/overage, threshold colours, and transaction drill-down represent a credible budgeting workflow. Its weakness is not genericness but prioritization: every budget gets the same visual weight, so urgency must be discovered row by row. The deterministic scan returned zero findings in `src/features/Budgets/index.tsx`; this clean result does not assess exception prioritization or recovery.

### Overall Impression

The card begins calm and accountable, then turns into work as lists grow. Its biggest opportunity is becoming an exception-review surface that makes overspending impossible to miss.

### What's Working

- “Over by” and remaining balance are immediately understandable and semantically colour-coded.
- One-at-a-time expansion contains the transaction detail.
- Privacy masking, native currency, and FX estimates respect real financial context.

### Priority Issues

- **[P1] Urgency is buried in an equal-weight list.** **Fix:** sort overspent, then near-limit, then healthy budgets with stable secondary order; add a compact conditional summary such as “1 over budget · 2 nearing limit.” **Suggested command:** `$impeccable layout`.
- **[P1] Month navigation does not scale.** **Fix:** make month label a period picker, add a current-month shortcut, retain adjacent arrows, and make controls 44px. **Suggested command:** `$impeccable adapt`.
- **[P1] Empty/error states stop the task.** **Fix:** explain next steps in empty state with Add budget if supported; add Retry and distinguish data-source failure where possible. **Suggested command:** `$impeccable harden`.
- **[P2] Progress relies on unexplained colour/thresholds.** **Fix:** pair colour with semantic status (On track/Near limit/Over budget); show spent zero-allotment as No limit set, not 999.9%. **Suggested command:** `$impeccable clarify`.
- **[P2] Expanded transactions lose budget context.** **Fix:** add “X transactions in [Month]” and clarify primary vs secondary transaction metadata. **Suggested command:** `$impeccable typeset`.

### Persona Red Flags

- **Alex:** no fast way to find problematic budgets, jump to current month, compare months, or sort a long list.
- **Sam:** state meaning is colour-led; month targets are undersized; expanded region is not associated with its control; loading lacks live status.
- **Casey:** 28px arrows are hard to tap; long names/currencies can crowd columns; nested scrolling is hard to manage on small screens.

### Minor Observations

Use `aria-controls` on expansion; include selected month in empty copy; test focus visibility after expanding a late row; duplicate budget names create ambiguous keys/state; explain cross-currency relationship between configured budget and PHP-led transaction amount.

### Questions to Consider

- Is the surface an inventory or an exception-review tool?
- Should spend against no limit be an error-state budget rather than 999.9% progress?
- Would “one budget needs attention” be more useful than another line of generic progress detail?
