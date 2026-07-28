# Client guide: display `createdBy` on GET responses

This document is for the Flutter / client app team. The backend now returns `createdBy` on most GET endpoints that load auditable records. The client should always show who created a record when that field is present.

---

## 1. Standard shape

Almost every GET that returns a created record now includes:

```json
{
  "id": "...",
  "createdAt": "2026-07-27T10:00:00.000Z",
  "createdBy": {
    "id": "staff-uuid",
    "firstName": "Jane",
    "lastName": "Okonkwo"
  }
}
```

`createdBy` may be `null` for:

- Seeded / legacy rows that never set `createdById`
- System-generated records in rare cases

**Rule:** If `createdBy` is `null`, hide the creator UI. Do not show `"Unknown"` unless product design explicitly asks for it.

Many detail endpoints also return:

```json
"updatedBy": {
  "id": "staff-uuid",
  "firstName": "Ada",
  "lastName": "Okoro"
}
```

Treat `updatedBy` the same way (optional display: “Last updated by …”).

---

## 2. Display helpers (Dart)

```dart
String? formatStaffName(Map<String, dynamic>? staff) {
  if (staff == null) return null;
  final first = (staff['firstName'] as String?)?.trim() ?? '';
  final last = (staff['lastName'] as String?)?.trim() ?? '';
  final name = '$first $last'.trim();
  return name.isEmpty ? null : name;
}

String? createdByLabel(Map<String, dynamic>? record) {
  final name = formatStaffName(record?['createdBy'] as Map<String, dynamic>?);
  return name == null ? null : 'Created by: $name';
}
```

Example list subtitle:

```dart
final label = createdByLabel(item);
// Text('John Doe')  OR  Text('John Doe · Created by: Jane Okonkwo')
```

Example detail metadata row:

```dart
if (createdByLabel(detail) != null)
  Text(createdByLabel(detail)!),
```

---

## 3. UI placement

| Screen type | Suggested placement |
|-------------|---------------------|
| List / table row | Subtle subtitle or secondary text under the title |
| Detail / view screen | Metadata section next to `createdAt` |
| Nested line items (invoice items, chart entries, consumables) | Per-row creator under the item name |
| Queue / waiting list | Optional chip or small caption |

Keep creator text visually secondary (smaller / muted) so clinical content stays primary.

---

## 4. Extended shapes (exceptions)

Most endpoints use the brief staff object above. A few return more fields:

| Area | Extra fields on `createdBy` |
|------|-----------------------------|
| Invoice detail / billing | May include `staffRole`, `accountType` (used for “requesting doctor” style UI) |
| Patient vitals | May return a fuller staff object (`createdBy: true` historically) |
| Support tickets | May include `staffId` |

Always prefer `firstName` + `lastName` for display. Extra fields are optional for badges/roles.

---

## 5. Endpoint inventory (where to expect `createdBy`)

### Patients

| Method | Path | Notes |
|--------|------|--------|
| GET | `/patients` | Each patient has `createdBy` (+ `updatedBy`) |
| GET | `/patients/search` | Each result has `createdBy` |
| GET | `/patients/registered/today` | Each patient has `createdBy` |
| GET | `/patients/:id` | Patient + nested appointments, admissions, payments, medical histories, doctor/lab/radiology reports, prescriptions, invoices — each nested row has `createdBy` |
| GET | `/patients/:id/chart` | Chart sections that are auditable include `createdBy` (encounters, admissions, prescriptions, reports, appointments, invoices, payments, wallet transactions, medical histories, doctor reports, vitals) |

### Clinical

| Method | Path | Notes |
|--------|------|--------|
| GET | `/encounters` | `createdBy` on each encounter |
| GET | `/encounters/:id` | `createdBy` + `updatedBy` |
| GET | `/prescriptions` (+ patient / encounter / active / `:id`) | `createdBy` |
| GET | `/doctor-reports` (+ by patient / encounter / `:id`) | `createdBy` |
| GET | `/lab-reports` (+ by patient / `:id`) | `createdBy` |
| GET | `/radiology-reports` (+ by patient / `:id`) | `createdBy` |
| GET | medical-history list/detail/by-patient | `createdBy` |
| GET | `/admissions` (+ active / patient / pending-billing-clearance / `:id`) | Admission `createdBy` |
| GET | `/appointments` (+ patient / upcoming / `:id`) | `createdBy` |
| GET | encounter specialty modules / clinical sections | `createdBy` |

### Obstetrics

| Method | Path | Notes |
|--------|------|--------|
| GET | pregnancies list/detail | `createdBy` (detail also `updatedBy`) |
| GET | babies list/detail | `createdBy` (detail also `updatedBy`) |

### Billing / payments

| Method | Path | Notes |
|--------|------|--------|
| GET | invoices (list/detail/by-patient) | Invoice + line items already had `createdBy` — unchanged |
| GET | invoice payments | Already included — unchanged |
| GET | legacy `/payments` list/detail/by-patient | Now includes `createdBy` |

### Catalog / admin

| Method | Path | Notes |
|--------|------|--------|
| GET | departments, service categories, consulting rooms | List: `createdBy`; detail: + `updatedBy` |
| GET | staff list / by id | `createdBy` (detail + `updatedBy`) |
| GET | services, HMOs, banks, discount policies | Already included — unchanged |
| GET | clinical packages, encounter templates | Already included — unchanged |

### Pharmacy / purchases

| Method | Path | Notes |
|--------|------|--------|
| GET | pharmacy locations (list + detail), drug search/detail | `createdBy` |
| GET | pharmacy POs / stock transfers | Already included — unchanged |
| GET | purchases manufacturers, suppliers, items, locations | `createdBy` |
| GET | purchases POs / stock transfers | Already included — unchanged |

### Quality, theatre, dialysis, CMD, frontdesk

| Method | Path | Notes |
|--------|------|--------|
| GET | quality-safety referrals / complaints / infections | Already included — unchanged |
| GET | theatre case consumables (via surgery request includes) | Consumable lines include `createdBy` |
| GET | dialysis session consumables | Consumable lines include `createdBy` |
| GET | CMD analytics `/communications` | Each communication has `createdBy` |
| GET | frontdesk family children links | Each link has `createdBy` |
| GET | support tickets | Already included — unchanged |
| GET | patient vitals | Already included — unchanged |

### Different field names (not `createdBy`)

These models use other creator-style relations. Do **not** expect `createdBy`:

| Model / area | Field to display |
|--------------|------------------|
| Requisitions | `requestedBy` |
| Safety incidents | `reportedBy` |
| Some archived chart uploads | `uploadedBy` |

---

## 6. Patient name search — no client change required

Staff search boxes that send a single `q` (or `search`) query string now support multi-word names on the server.

**Before:** Searching `John Doe` failed because each name column was matched against the whole string.

**After:** The backend:

1. Matches against a persisted `searchName` (`firstname othername surname`, lowercased)
2. Falls back to token-split matching across `firstName` / `otherName` / `surname`

Affected APIs (same query params as today):

- `GET /patients?q=John+Doe`
- `GET /patients/search?q=John+Doe`
- `GET /patients/registered/today?q=John+Doe`
- Invoice / waiting-queue / receivables / HMO patient / frontdesk device search that filters by patient name

**Client action:** Keep sending the full typed string from the single search box. Do not split names on the client.

---

## 7. Checklist for the client app

- [ ] Add a shared `formatStaffName` / `createdByLabel` helper
- [ ] On every list row that shows an auditable entity, show creator when `createdBy != null`
- [ ] On every detail screen, show creator next to created date
- [ ] On nested collections (invoice items, chart sections, consumables), show per-row creator
- [ ] Gracefully hide UI when `createdBy` is null
- [ ] Do not change patient search request shape — multi-word search is fixed server-side
- [ ] For requisitions / safety incidents, use `requestedBy` / `reportedBy` instead of `createdBy`
