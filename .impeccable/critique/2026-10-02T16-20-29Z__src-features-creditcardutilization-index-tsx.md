---
target: credit cards and credit cards viewer
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/CreditCardUtilization/index.tsx"
target_fingerprint: "sha256:dc77c822c954a0a2960287c32c97238275cca396cc2b8f931c887609a297c153"
target_path: /Users/dwightsabado/Desktop/Dev/Ledgrr-Full/src/features/CreditCardUtilization/index.tsx
timestamp: 2026-10-02T16-20-29Z
slug: src-features-creditcardutilization-index-tsx
---
## Credit cards and credit-card viewer

### Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | No freshness, filter summary, success feedback, or result count. |
| 2 | Match System / Real World | 3 | Due dates, statements, utilization, and available credit are familiar. |
| 3 | User Control and Freedom | 2 | Filters persist across cards; viewer lacks an internal close/back control. |
| 4 | Consistency and Standards | 3 | Card, transaction, and status patterns are cohesive. |
| 5 | Error Prevention | 2 | New-card input constraints exist, but relational validation and preview are absent. |
| 6 | Recognition Rather Than Recall | 2 | Add, viewer, filter, and card actions require icon/whole-card inference. |
| 7 | Flexibility and Efficiency | 2 | Cycle browsing/filtering exists; no cross-card search, quick payment route, or saved filter behavior. |
| 8 | Aesthetic and Minimalist Design | 3 | Compact cards, but dense metadata has no stated priority. |
| 9 | Error Recovery | 2 | Generic errors and filtered-empty states provide no immediate recovery. |
| 10 | Help and Documentation | 1 | No explanation of utilization, statement total, or FX differences. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

### Design Specificity Verdict

The overview is recognizably credit-card-specific: utilization, available limit, due urgency, statement cycles, card art, payment-aware transfers, and multi-currency handling are domain-grounded. The viewer becomes a generic filtered ledger, however, without a persistent answer to what needs attention on the selected card. The detector found zero issues in `src/features/CreditCardUtilization/index.tsx` and `CreditCardViewer.tsx`; that clean mechanical result does not resolve the hierarchy and clarity gaps below.

### Overall Impression

Due badges and utilization create a reassuring first scan, but the unlabeled dominant number makes users work out whether they are seeing balance, statement balance, or payment due. The biggest opportunity is a card hierarchy that clearly distinguishes “what I owe,” “when it matters,” and “what activity explains it.”

### What's Working

- Due-date ordering and semantic badges surface urgency without over-alarming.
- PHP/native values, privacy masking, and FX treatment reflect a real multi-currency finance setting.
- Collapsed-card detail and the dedicated viewer offer both scan and drill-in paths.

### Priority Issues

- **[P1] Primary balance and next action are ambiguous.** The dominant PHP amount has no label while Amount due is visually secondary. **Fix:** label it Current balance (or confirmed domain equivalent); promote amount due and due date only where payment is imminent; add a visible View activity affordance. **Suggested command:** `$impeccable clarify`.
- **[P1] The viewer lacks card-level decision context.** It begins with card name and filters but no balance, due status, utilization, or amount due. **Fix:** add a compact persistent summary with current balance, amount due, due date/status, and utilization; retain masking and use one/two mobile lines. **Suggested command:** `$impeccable onboard`.
- **[P1] Filters are opaque and hard to recover from.** An active dot is the only status, empty filtered results do not reset, and filters carry across cards. **Fix:** show filter/result count and Clear action near the header; reset filters per card or clearly label them shared; add Clear filters in empty state. **Suggested command:** `$impeccable clarify`.
- **[P2] Statement periods and controls lack clarity.** By Statement, cycle label, and Total do not identify current/closed period or date bounds; cycle arrows are too small. **Fix:** name the statement period/status and balance precisely, include dates, grow controls to 44px, and give an accessible period label. **Suggested command:** `$impeccable adapt`.
- **[P2] Loading/error recovery is passive.** Panels only say to try later. **Fix:** provide Retry where hooks support refetch, distinguish card vs transaction failure, and retain/add useful form-specific errors. **Suggested command:** `$impeccable harden`.

### Persona Red Flags

- **Alex:** current balance versus amount due cannot be identified at a glance; no cross-card search/sort and complex filters can follow into another card.
- **Sam:** visible meaning relies on icon-only controls; tabs lack expected arrow-key/panel relationship; selection, filtering, and async changes are not live-announced.
- **Casey:** header controls/cycle arrows are visually around 28px, dense metadata wraps, and the only exit from detail is the external rotating panel icon.

### Minor Observations

Settings is misleading for Add credit card; use an add/card icon or label. Empty cards should lead to Add credit card. Avoid nested interactives inside the full-card button. Revisit due-date-only ordering at high card counts, and verify Amount due semantics against the cycle calculation.

### Questions to Consider

- On a card, is the primary answer “what do I owe now?” or “how close am I to the limit?”
- Is Amount due actually payable, a latest statement balance, or an informative historical total?
- Do users enter the viewer primarily after noticing risk, or as a regular card ledger?
