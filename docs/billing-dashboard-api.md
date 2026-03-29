# Billing dashboard API (analytics)

Base path: `/billing/analytics` (NestJS; same host as your API).

## Auth

Global `JwtAuthGuard` + `AccessGuard` apply unless a route is marked public. Send `Authorization: Bearer <token>` like other protected routes.

## Query parameters (all GET routes)

| Param    | Required | Description |
|----------|----------|-------------|
| `period` | Yes      | `today` \| `week` \| `month` \| `quarter` \| `year` |
| `asOf`   | No       | ISO 8601 instant used as “now” for boundaries (tests / backdated dashboards). Defaults to server time. |

### Period semantics

Boundaries use the **server’s local timezone** (Node `Date`).

| `period`  | Current window | Previous window (comparison) |
|-----------|------------------|------------------------------|
| `today`   | Calendar today 00:00–23:59:59 | Yesterday |
| `week`    | ISO week **Mon–Sun** containing `asOf` | Prior ISO week |
| `month`   | Calendar month | Previous calendar month |
| `quarter` | Calendar quarter (Q1–Q4) | Previous quarter |
| `year`    | Calendar year | Previous calendar year |

### Revenue cash definition

**Cash in** = sum of:

- `InvoicePayment.amount` where `createdAt` is in the window (wallet / simple `recordPayment` path).
- `TransactionPayment.amount` where `paidAt` is in the window (allocation path + any other billing payments).

---

## GET `/billing/analytics/revenue-summary`

Compares total cash in the **current** vs **previous** period.

### Example

`GET /billing/analytics/revenue-summary?period=month`

### Response (shape)

```json
{
  "period": "month",
  "window": { "start": "2026-03-01T00:00:00.000Z", "end": "2026-03-31T23:59:59.999Z" },
  "previousWindow": { "start": "2026-02-01T00:00:00.000Z", "end": "2026-02-28T23:59:59.999Z" },
  "current": 125000.5,
  "previous": 118000,
  "percentChange": 5.93,
  "direction": "up"
}
```

- `direction`: `up` \| `down` \| `flat`
- If `previous === 0` and `current > 0`, `percentChange` is **100** and direction **up**. If both zero, `percentChange` **0** and **flat**.

---

## GET `/billing/analytics/unpaid-summary`

### Semantics

- **Flow (comparison metrics)**: invoice line items on invoices that are still `PENDING` or `PARTIALLY_PAID` and whose **`Invoice.createdAt`** falls in the current or previous **period window**. Outstanding per line matches billing (recurring daily lines, etc.).
- **`openStock`**: snapshot of **all** open invoices at query time: `invoiceCount`, `lineItemCount`, `quantitySum`, `outstandingTotal`.

### Example

`GET /billing/analytics/unpaid-summary?period=week`

### Response (shape)

```json
{
  "period": "week",
  "semantics": "Unpaid flow: line items on invoices ...",
  "windows": {
    "current": { "start": "...", "end": "..." },
    "previous": { "start": "...", "end": "..." }
  },
  "openStock": {
    "invoiceCount": 12,
    "lineItemCount": 34,
    "quantitySum": 40,
    "outstandingTotal": 450000.25
  },
  "lineItems": { "current": 10, "previous": 8, "percentChange": 25, "direction": "up" },
  "quantities": { "current": 15, "previous": 12, "percentChange": 25, "direction": "up" },
  "outstandingAmount": { "current": 90000, "previous": 70000, "percentChange": 28.57, "direction": "up" }
}
```

---

## GET `/billing/analytics/overdue-summary`

### Semantics

- **Overdue**: open invoice (`PENDING` or `PARTIALLY_PAID`) with `Invoice.createdAt` **more than 30 days** before `asOf` (there is no separate due date field).
- **`overdueStock`**: all such invoices now: `invoiceCount`, `outstandingTotal`.
- **Trend (`newOverdueInPeriod`)**: compares invoices that **first became overdue** during each window: `createdAt ∈ [windowStart − 30d, windowEnd − 30d]`, still open. Percent changes apply to `invoiceCount` and `outstandingTotal` between current and previous windows.

---

## GET `/billing/analytics/revenue-series`

Buckets for a **line chart** over the **current** period only.

| `period`  | Buckets |
|-----------|---------|
| `today`   | 6 segments × **4 hours** |
| `week`    | **7** days (Mon–Sun labels) |
| `month`   | **4** day-ranges (split month into four parts) |
| `quarter` | **3** months in the quarter |
| `year`    | **6** pairs of calendar months |

### Example

`GET /billing/analytics/revenue-series?period=today`

### Response (shape)

```json
{
  "period": "today",
  "window": { "start": "...", "end": "..." },
  "points": [
    { "label": "00:00–03:59", "revenue": 1200, "start": "...", "end": "..." }
  ],
  "maxRevenue": 5000
}
```

### fl_chart `LineChart`

- X: `points.map((p) => p.label)` or index 0..n−1.
- Y: `points.map((p) => p.revenue)`.
- Use `maxRevenue` (or `max(points.map(...))`) for `maxY` / grid intervals so the axis reaches the highest value.

---

## GET `/billing/analytics/revenue-by-department`

Invoice-based revenue only (no standalone non-invoice transactions).

- Sums **`InvoiceItemPayment`** rows with `createdAt` in the window, grouped by `Service.departmentId` (via `InvoiceItem` → `Service` → `Department`).
- Splits each **`InvoicePayment`** in the window **proportionally** by computed line totals (same recurring logic as billing) across departments.

### Example

`GET /billing/analytics/revenue-by-department?period=month`

### Response (shape)

```json
{
  "period": "month",
  "window": { "start": "...", "end": "..." },
  "total": 200000,
  "slices": [
    { "departmentId": "uuid", "name": "Laboratory", "amount": 80000, "percent": 40 }
  ]
}
```

`departmentId` may be `null` for an **Unknown** slice (e.g. drug lines without a service department).

### fl_chart `PieChart` / `PieChartSectionData`

- `value`: `amount` (or `percent` if you prefer normalized values).
- `title` / legend: `name`.
- Colors: assign in the app by index or by `departmentId`.

---

## GET `/billing/analytics/recent-invoices`

| Param   | Required | Default |
|---------|----------|---------|
| `period`| Yes      | —       |
| `asOf`  | No       | now     |
| `take`  | No       | 20 (max 100) |

Returns the latest invoices (newest first) for a dashboard table. `period` is echoed for UI context; the list is **not** filtered by period.

### Example

`GET /billing/analytics/recent-invoices?period=today&take=10`

### Response (shape)

```json
{
  "period": "today",
  "asOf": "2026-03-29T12:00:00.000Z",
  "take": 10,
  "items": [
    {
      "invoiceId": "uuid",
      "status": "PENDING",
      "patientName": "Jane Doe",
      "date": "2026-03-29T10:00:00.000Z",
      "amount": 15000.5
    }
  ]
}
```

`amount` is `Invoice.totalAmount` (bill total, not outstanding).

---

## Replacing dummy dashboard data in Flutter

1. Call `revenue-summary` + `unpaid-summary` + `overdue-summary` with the same `period` (and optional `asOf`).
2. Bind KPI cards to `current`, `previous`, `percentChange`, `direction`.
3. Feed `revenue-series` `points` into `LineChart` (`fl_chart`).
4. Feed `revenue-by-department` `slices` into `PieChart`.
5. Map `recent-invoices` `items` to your DataTable columns: Status, Invoice ID, Patient name, Date, Amount.

Handle `percentChange` when comparing to zero as described above to avoid divide-by-zero in the UI.
