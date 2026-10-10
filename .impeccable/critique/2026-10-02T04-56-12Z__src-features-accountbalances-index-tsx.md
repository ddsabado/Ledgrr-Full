---
target: account balances card and card viewer in the dashboard
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/AccountBalances/index.tsx"
target_fingerprint: "sha256:9c86cd8dc8e8062fbaaf875ebd598ceedd468613b0a53c52aeabe3e6af36fa3e"
target_path: /Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/AccountBalances/index.tsx
timestamp: 2026-10-02T04-56-12Z
slug: src-features-accountbalances-index-tsx
---
## Account balances card and account viewer

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | No feedback for filter/selection changes or successful adjustment; no freshness indicator. |
| 2 | Match System / Real World | 3 | Financial language is natural, but key icon-only controls are ambiguous. |
| 3 | User Control and Freedom | 3 | Clear filters and dialog exit exist; reselecting an account closes the viewer and adjustments offer no undo. |
| 4 | Consistency and Standards | 3 | Shared card and focus patterns are consistent; viewer controls lack clear visible meaning. |
| 5 | Error Prevention | 2 | No inline range validation for transaction filters or impact review for adjustments. |
| 6 | Recognition Rather Than Recall | 2 | Primary controls are icon-only and active filtering is indicated only by a dot. |
| 7 | Flexibility and Efficiency | 2 | Filtering works, but no sorting, saved views, shortcuts, or fast account navigation. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm panels, but the donut and full legend duplicate the list at a high vertical cost. |
| 9 | Error Recovery | 2 | Generic error/empty states lack retry or in-context reset. |
| 10 | Help and Documentation | 1 | No contextual explanation of adjustments, chart colours, or filters. |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

### Design Specificity Verdict

The dual PHP/native display, privacy mask, categories, and account drill-in are clearly finance-specific. The core composition is nevertheless category-interchangeable: a generic donut/list card opens a generic transaction drawer, without showing liquidity, risk, change, or recency. The deterministic detector found no issues in `src/features/AccountBalances/index.tsx` or `src/features/AccountBalances/AccountViewer.tsx`; that clean result does not catch the product-level hierarchy and discoverability gaps below.

### Overall Impression

The surface is restrained and technically coherent, but it reports an inventory instead of answering the higher-value question: what money is available, changing, or needs attention today. The single biggest opportunity is replacing the chart-led hierarchy with action-oriented financial insight.

### What's Working

- Tabular numbers, PHP equivalent plus native currency, and privacy masking make balance comparison reliable.
- Collapsible categories and selected-row state make account drill-in understandable; focus styling and keyboard Enter/Space on rows are present.
- Loading, error, and empty baseline states prevent a blank, unexplained panel.

### Priority Issues

- **[P1] Ambiguous control and action model.** Filter, viewer, and balance-adjustment controls are icon-only; the panel-open icon does not say whether it opens details, expands the layout, or navigates. **Why it matters:** new and returning users must guess before a high-value action. **Fix:** label the primary action “View account activity”; give Adjust balance and filters visible labels or tooltips, and show readable active-filter chips. **Suggested command:** `$impeccable clarify`.
- **[P1] Financial hierarchy stops at a total.** The donut with arbitrary golden-angle colours asks users to parse allocation but gives no liquidity, largest movement, risk, foreign-currency exposure, or freshness signal. **Why it matters:** it expends space without helping a user decide what matters. **Fix:** replace or precede the donut with two or three insight rows; link legend/list selection and reserve colour for meaningful categories. **Suggested command:** `$impeccable layout`.
- **[P1] Balance adjustment lacks safety and reassurance.** It exposes no current-to-proposed delta, impact preview, confirmation, or success acknowledgement; transaction min/max filters also permit contradictory ranges. **Why it matters:** balance correction is financially sensitive and feels irreversible. **Fix:** validate inline, preview the adjustment transaction and delta, confirm success, and expose Undo or an audit link when possible. **Suggested command:** `$impeccable harden`.
- **[P2] Viewer lacks a summary and wayfinding.** It opens straight into transaction rows; the empty result does not explain active filters or offer an immediate reset. **Why it matters:** the user loses context just when selecting an account. **Fix:** add a compact balance/currency/count summary and a contextual empty state with Clear filters. **Suggested command:** `$impeccable onboard`.
- **[P2] Density breaks down at scale and on mobile.** A full legend and unbounded account list compete for a 192px chart; viewer hides the overview on mobile; p-1 icon buttons are too small for comfortable touch. **Why it matters:** scanning and tapping degrade as account count grows. **Fix:** show top categories plus “N more,” make the chart optional or insight-driven, and guarantee 44px targets. **Suggested command:** `$impeccable adapt`.

### Persona Red Flags

- **Alex (power user):** no sorting, saved filters, shortcuts, or jump-to-account. Opening the viewer chooses the first filtered account automatically, creating a context switch before Alex has selected one.
- **Sam (accessibility-dependent):** account rows are `role=option` inside separate listboxes but do not implement roving tabindex or arrow-key behaviour; the active-filter dot is hidden from assistive technology. Visible focus rings and button labels are good foundations.
- **Casey (distracted mobile user):** critical controls are small, top-aligned icons; viewing an account removes the overview chart on small screens, while filters are multi-field and do not persist across refresh.

### Minor Observations

Native/PHP values need an exchange-rate or freshness cue; category order is incidental first appearance rather than task priority; generic errors need Retry; the selected-row fill can compete with its semantic chart colour.

### Questions to Consider

- Is the primary job auditing every account, or answering what is available and needs attention today?
- What should a user know in five seconds that the donut cannot currently tell them?
- Should adjustment be an exception workflow with a durable audit trail instead of a peer action to filtering?
