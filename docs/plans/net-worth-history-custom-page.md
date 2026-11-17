# Implementation plan: Net-worth history chart for custom pages

## Goal

Enable a custom-page `chart` widget with `chartType: "line"` to plot reconstructed net worth for all eligible accounts over time, without adding a balance-snapshot table.

This works by treating each account's latest stored balance as an anchor, then reversing its balance-affecting transactions to calculate earlier balances. It is not possible to reconstruct dates earlier than the available transaction history with confidence; the query/UI must make that limitation visible rather than imply complete history.

## Current state

- `src/core/page-schema.ts` defines the custom-page query union. It includes transaction `trend` and current `balances`, but no historical balance/net-worth query.
- `src/services/query.ts` implements `trend` by aggregating transactions and `balances` by returning current account data. Neither reconstructs historical balances.
- `src/web/app/components/custom-page/custom-page-renderer.tsx` gathers widget queries and resolves batch data; query results are passed to registered widgets.
- `src/web/app/components/custom-page/builder/query-inspector.tsx` exposes query types and controls.
- `src/web/app/components/custom-page/widget-reference.tsx` documents widgets and query shapes.
- Accounts have `balance`, `currency`, and `excluded`; transactions have signed `charged_amount`, `date`, and `status`. The transaction query helper applies report filters, including default classification exclusions, and must not be blindly reused for ledger reconstruction.
- The chart widget already supports a line chart in the schema and property inspector. Confirm the widget implementation actually renders the proposed result shape and currency formatting before assuming no renderer work is needed.

## Decisions to make before implementation

1. **Meaning of net worth:** Decide which accounts count and the sign convention for each. A useful default is bank balances as assets and credit-card outstanding amounts as liabilities. Confirm the scraper's balance semantics for each provider; do not assume every card provider reports debt with the same sign.
2. **Currency:** The database stores a currency per account, but there is no exchange-rate model in this feature plan. Either restrict a single total line to ILS accounts and clearly identify/exclude other currencies, or show separate currency totals/series. Do not sum unlike currencies.
3. **Account scope:** Specify whether excluded accounts are omitted (recommended default), and how unknown/null balances affect totals. Report which accounts were included and whether the total is partial.
4. **Ledger completeness:** Define the earliest reconstructable date per account from transaction history. Handle provider scrape start/end metadata and partial syncs so the UI does not claim older dates are complete.
5. **Transaction inclusion:** Decide whether only completed transactions count. The recommended first implementation uses completed transactions; pending items are not posted to balances. Confirm this matches account balance timing at each provider.
6. **Transfers and card billing:** Define internal transfers and credit-card bill payments to avoid double counting or omitting economic activity. Net-worth reconstruction should follow account ledger movements; categories/reports' default exclusions are not suitable here. Reconcile sample bank/card pairs and confirm that summing asset and liability account balances does not double-count a payment.
7. **Anchor date:** Establish the effective date/time of each stored account balance. `accounts.balance` can be refreshed during provider sync, while transaction rows are keyed by transaction date. Define a consistent cutoff from sync metadata (or add a dedicated per-account balance-as-of field if existing metadata is insufficient). Never silently treat a stale balance as current.

## Proposed query contract

Add a dedicated query type rather than overloading `trend`, because transaction activity and account valuation have different semantics. Suggested JSON:

```json
{
  "type": "net_worth",
  "interval": "month",
  "from": "2025-01-01",
  "to": "2026-11-17",
  "accounts": ["12345"]
}
```

`accounts` is optional and defaults to all eligible accounts. `interval` may be `day`, `week`, or `month`; define a reasonable maximum number of points/range to keep query cost and chart density bounded. `from`/`to` are optional ISO dates with validated ordering. An alternative is to reuse the existing period syntax, but document and validate it explicitly; the current period parser does not define every intuitive shorthand such as `12m`.

Return a stable result shape such as:

```json
{
  "points": [
    { "date": "2026-01", "value": 12345.67, "complete": true }
  ],
  "currency": "ILS",
  "coverage": {
    "from": "2025-01-01",
    "through": "2026-11-17",
    "partialAccounts": []
  }
}
```

For a chart requiring only `date` and `value`, keep those fields at the top level of each point. Include coverage/partial-data information separately so it does not break chart data mapping. If per-account transparency is desired, add optional account breakdown only after the combined total and its sign/currency semantics are well-defined.

## Reconstruction approach

For each eligible account `a`, let `B(a)` be its stored balance at its verified anchor cutoff `C(a)`. Let `T(a, x, y)` be the sum of signed, balance-affecting posted transaction amounts for that account in the interval `(x, y]`, using the same amount/currency basis as the account balance. Then reconstruct:

`balance(a, d) = B(a) - T(a, d, C(a))` for dates `d <= C(a)`.

This relies on transaction signs matching account-ledger movement. If the stored balance or transaction amount uses a different convention (especially for credit cards), normalize to an asset-positive/liability-negative net-worth contribution before summing. Do not apply `ABS()` to amounts. Do not apply category, merchant, spending-direction, or `DEFAULT_REPORT_EXCLUDES` filters to this ledger calculation unless an explicitly justified balance-impact rule requires it.

Implementation should avoid one database query per chart point/account. Fetch eligible accounts and relevant transactions in a bounded query (or aggregate by account/date), build chronological per-account running sums, and emit the requested interval points. Use a single inclusive/exclusive boundary convention consistently, and test transactions exactly on bucket boundaries. Include a point for the current/end date using the anchor balances; avoid fabricating earlier values where transaction history is incomplete.

## Work breakdown

### 1. Confirm assumptions and inspect current sync behavior

- Trace where `accounts.balance` is written and when it is refreshed relative to transaction upserts and sync-log completion.
- Confirm whether `charged_amount` sign and currency represent account-ledger movement for bank and credit-card providers.
- Determine whether transaction history is complete from each provider's scrape start date and how initial fetches/partial failures are represented.
- Document the chosen account eligibility, card liability sign, transfer/billing, pending-transaction, currency, and stale-anchor policies.
- If there is no reliable per-account balance cutoff, add the smallest necessary metadata to establish it. This need not be a historical snapshot table; it is anchor freshness metadata.

### 2. Add the ledger calculation at the data/service layer

- Prefer a focused repository/service function for reconstructed net worth, keeping SQL/data access out of `src/core/`.
- Query current account rows joined to providers, including account ID, currency, provider type, excluded status, balance, and anchor metadata.
- Query completed signed transactions needed for the requested time range and each account's anchor cutoff. Do not reuse the existing transaction trend resolver's absolute-value aggregation or its report classification exclusions.
- Apply account-specific sign normalization and the selected same-currency aggregation policy.
- Produce chronological points, with explicit coverage/partial-data metadata. Handle null balances, no transactions, accounts whose history starts after the requested range, and stale/missing anchors deterministically.
- Bound date range/point count and use indexed fields (`account_id`, `date`, status) to keep SQLite work predictable.

### 3. Extend the custom-page query contract

- Add a strict `net_worth` query schema to `src/core/page-schema.ts`, then include it in `querySchema` and inferred `WidgetQuery`.
- Validate interval, date formats/range, optional account identifiers, and any maximum history/range limits.
- Add `executeNetWorthQuery` in `src/services/query.ts` and dispatch it in `executeQuery`. Keep it independent of ordinary transaction filters unless a clearly defined net-worth filter is added.
- Ensure batch execution returns the query result/error through the existing envelope unchanged.
- Decide whether the global custom-page filter bar's date-range filter should control net-worth history. If yes, explicitly map its state to `from`/`to`; otherwise document that this query's own dates control its range.

### 4. Verify chart rendering and builder support

- Locate the chart component registered by `src/web/app/components/widgets/widget-registry.tsx` and verify how it interprets query data for line charts (date key, value key, chart height, currency labels, empty/error states).
- If it handles generic `{ points: [{ date, value }] }`, add a net-worth query example and no special chart code may be needed. If it expects the transaction trend shape/series-specific fields, update it to support the net-worth result explicitly without changing existing chart behavior.
- Update `QueryObject` and query-type selection/initialization in `query-inspector.tsx`; add relevant controls for interval and date range if the builder should configure them. Ensure query filter UI is not incorrectly shown for `net_worth` if the new query does not use transaction filters.
- Update `widget-reference.tsx` with the query description, properties, and a valid line-chart example. Update custom-page skill/docs/examples if they duplicate the supported query list.
- Add a sensible builder default in `tree-utils.ts` only if the chart builder's default should favor the new query; do not replace the current spending chart default without product intent.

### 5. Tests

- **Unit/repository tests:** known anchor plus signed transactions reconstructs expected daily/monthly values; credits and debits reverse correctly; account isolation; correct bucket boundaries; current point equals normalized anchor total.
- **Eligibility/sign tests:** excluded accounts; null balances; bank vs card normalization; multiple account IDs/numbers; currencies; internal transfer/card billing policy.
- **Data quality tests:** no transactions, incomplete history, start date after earliest history, stale/missing anchor, partial sync and pending transactions. Confirm partial results are marked or rejected per policy.
- **Schema tests:** valid query parses; invalid interval/date/range/account shapes fail; page definition accepts a chart using the query.
- **Service/batch tests:** query dispatch, filtering/scope, output shape, bounded range, and error behavior.
- **UI tests:** query inspector selection/configuration, chart maps date/value, ILS formatting, empty/loading/error/partial-history display, and existing trend charts remain unchanged.
- Seed realistic bank + credit-card fixture histories, including a card purchase and its bank payment, and assert the resulting net worth is not double-counted.

### 6. Documentation and acceptance criteria

- Document the calculation, date boundaries, eligible-account defaults, currency/sign conventions, and history-coverage limitations in the widget reference and custom-page guide.
- Provide an example page definition with a `chartType: "line"` widget querying `net_worth`.
- Acceptance criteria:
  1. A custom page validates and renders an ILS net-worth line chart for the selected range.
  2. For every fully covered point, the total equals the independently calculated sum of eligible account values at that date.
  3. Existing transaction trend charts and all other query types preserve current behavior.
  4. Missing/stale balances, incomplete history, excluded accounts, card liabilities, and non-ILS accounts follow documented behavior and are not silently presented as a complete comparable total.
  5. Query date range and result volume are bounded, and tests run via the repository's normal test/typecheck commands.

## Suggested implementation order

1. Resolve the assumptions in section 1 and write test fixtures for real-world sign/cutoff cases.
2. Implement and test the reconstruction function in isolation.
3. Add query schema, resolver, and batch tests.
4. Inspect/adapt the registered chart component and query inspector.
5. Update widget reference, custom-page docs, and example JSON.
6. Run `npm test` and `npm run typecheck`; then manually verify with a small local DB containing bank and card accounts.

## Explicit non-goals for the first version

- Persisting daily/monthly balance snapshots.
- Estimating values before available transaction history.
- Foreign-exchange conversion without an exchange-rate source.
- Claiming a total is complete when any included account lacks a valid anchor/history range.
