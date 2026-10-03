---
target: transactions by period card
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/Transactions/index.tsx"
target_fingerprint: "sha256:1c631ea37aa8f4c30e7abd5249ef00c3a489433e689e441928a106c06737e7d4"
target_path: /Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/Transactions/index.tsx
timestamp: 2026-10-03T01-41-58Z
slug: src-features-transactions-index-tsx
---
## Transactions by Period

### Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | No count/freshness and no meaningful empty-period rationale. |
| 2 | Match System / Real World | 3 | Time/flow language is familiar; total scope and exclusions are hidden. |
| 3 | User Control and Freedom | 2 | Back works, but no current-period jump or direct date selection. |
| 4 | Consistency and Standards | 3 | Shared card, colour, motion, and list patterns are cohesive. |
| 5 | Error Prevention | 2 | Navigation is bounded, but flow exclusions are silent. |
| 6 | Recognition Rather Than Recall | 3 | Labels are visible but period comparison requires memory. |
| 7 | Flexibility and Efficiency | 2 | Arrow-only historic navigation does not scale, especially daily. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm single-scroll layout, but controls/chart/legend duplicate and crowd. |
| 9 | Error Recovery | 1 | Generic failure has no Retry; empty state lacks explanation. |
| 10 | Help and Documentation | 1 | No explanation of included flows, offsets, or PHP/FX treatment. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

### Design Specificity Verdict

The data model is strongly personal-finance-specific: income/expense grouping, period rollups, category drill-down, PHP conversion, native amounts, split offsets, and FX markers all fit the product. The visual/interaction pattern is still a generic donut-above-ranked-list analytics card: it makes users browse a ledger rather than understand change or take action. The detector found zero issues in `src/features/Transactions/index.tsx` and `PeriodNavigator.tsx`; it does not detect the clarity and analytical-priority gaps below.

### Overall Impression

The audit trail is sound, but the card never states what the total means, whether it is unusual, or what data is intentionally absent. The strongest improvement is a concise context cue that turns a category report into a financial insight.

### What's Working

- Switching period granularity preserves analytical intent and correctly returns to the appropriate current period.
- Category → subcategory → transaction drill-down offers genuine progressive disclosure; direct transactions are retained.
- PHP aggregation, native values, privacy masking, and FX-estimated markers suit multi-currency personal finance.

### Priority Issues

- **[P1] The card reports a total, not a conclusion.** Allocation alone does not reveal whether spending/income changed or what drove it. **Fix:** add one compact comparator near the total—prior comparable period, transaction count, or largest category change—then retain categories as detail. **Suggested command:** `$impeccable layout`.
- **[P1] Total scope and exclusions are invisible.** Transfers, adjustments, receivables, blanks, and unknown types are excluded; split offsets net down expenses. **Fix:** name the total Expense total/Income total and add an unobtrusive scope disclosure for exclusions, offsets, and estimated FX. **Suggested command:** `$impeccable clarify`.
- **[P1] Historical navigation does not scale.** Arrow-only navigation becomes impractical in daily view and forces empty-day traversal. **Fix:** make the period label open a picker/menu; add Current period; give Day an activity-aware jump/list. **Suggested command:** `$impeccable adapt`.
- **[P2] Chart/list duplication crowds the card.** The legend repeats each ranked-list category after an already-tall control stack. **Fix:** link donut selection to the list and suppress/restrict legend to top categories plus N more, or remove it. **Suggested command:** `$impeccable distill`.
- **[P2] Empty/error states are passive.** Users cannot tell no applicable flow from a failure and cannot recover. **Fix:** expose safe Retry, name the empty flow/period, offer switch-flow, and explain exclusions. **Suggested command:** `$impeccable harden`.

### Persona Red Flags

- **Alex:** March-vs-February comparison requires manual navigation and remembering totals; daily review means many arrow presses across empty days.
- **Sam:** tabs lack panel associations; period/flow/drill changes are not live-announced; 28px circular navigator buttons are undersized; colour has no programmatic donut/list relationship.
- **Casey:** heading, two tab bars, navigator, donut, and wrapping legend consume the viewport before drill items; the back control is small and non-sticky.

### Minor Observations

The truncated period label has no full accessible title; Back + Total looks like a breadcrumb but only shows a category label; category percentage can confuse when offsets make net totals low/negative; all aggregates are PHP without a visible denomination label.

### Questions to Consider

- Is this card for classifying the ledger or answering what changed in money?
- If one visual must go, is the full legend more expendable than the donut?
- Should omitted ledger types remain excluded from the insight, or be visible/controllable?
