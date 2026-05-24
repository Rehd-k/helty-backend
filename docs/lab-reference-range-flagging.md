# Lab reference range flagging (frontend guide)

This document describes how the backend evaluates lab results against reference ranges and how the client should display flags.

## Overview

- Reference ranges are configured on **lab test fields** (`LabTestField.referenceRange`) when `fieldType` is `NUMBER`.
- Result values are stored as strings on **lab results** (`LabResult.value`).
- On every lab result API response, the backend adds a computed **`referenceEvaluation`** object. Nothing is stored in the database; flags always reflect the **current** reference range on the field.

## API endpoints

| Method | Path | Returns `referenceEvaluation` |
|--------|------|-------------------------------|
| `POST` | `/lab/results` | Yes (single result) |
| `POST` | `/lab/results/batch` | Yes (each item in array) |
| `GET` | `/lab/results/:orderItemId` | Yes (each item in array) |

Request bodies are unchanged. Clients only send `orderItemId`, `fieldId`, `value`, and `enteredBy`.

## Response shape

Each lab result object includes:

```json
{
  "id": "uuid",
  "orderItemId": "uuid",
  "fieldId": "uuid",
  "value": "130",
  "enteredById": "uuid",
  "createdAt": "2026-05-24T08:00:00.000Z",
  "field": {
    "id": "uuid",
    "label": "Random glucose",
    "fieldType": "NUMBER",
    "unit": "mg/dL",
    "referenceRange": "80-120",
    "required": true,
    "position": 0
  },
  "enteredBy": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "referenceEvaluation": {
    "inRange": false,
    "flag": "HIGH",
    "parsedValue": 130,
    "referenceRange": "80-120"
  }
}
```

### `referenceEvaluation` fields

| Field | Type | Meaning |
|-------|------|---------|
| `inRange` | `boolean \| null` | `true` = within range, `false` = out of range, `null` = not evaluated |
| `flag` | `"LOW" \| "HIGH" \| null` | Direction when out of range; `null` when in range or not evaluated |
| `parsedValue` | `number \| null` | Numeric value extracted from `value` (leading number only) |
| `referenceRange` | `string \| null` | Echo of the field’s reference range text used for evaluation |

## When evaluation is skipped (`inRange: null`)

Do **not** show an abnormal highlight when `referenceEvaluation.inRange === null`:

- Field type is not `NUMBER` (`TEXT`, `DROPDOWN`, etc.)
- `referenceRange` is empty or missing
- `referenceRange` text is invalid (admins should fix via field API; results still save)
- `value` is empty or not parseable as a number

## Supported reference range formats (admin entry)

When creating/updating lab test fields (`POST` / `PATCH` lab test field APIs), use these patterns for `NUMBER` fields:

| Format | Examples | In range when |
|--------|----------|----------------|
| Closed interval | `80-120`, `80 - 120`, `80–120` | min ≤ value ≤ max |
| Less than | `<1.2`, `< 1.2` | value &lt; limit |
| Less or equal | `<=1.2`, `≤1.2` | value ≤ limit |
| Greater than | `>5` | value &gt; limit |
| Greater or equal | `>=5`, `≥5` | value ≥ limit |

Invalid ranges on `NUMBER` fields are rejected with `400 Bad Request` at field create/update time.

## Flag direction examples

| Reference | Value | `inRange` | `flag` |
|-----------|-------|-----------|--------|
| `80-120` | `70` | `false` | `LOW` |
| `80-120` | `100` | `true` | `null` |
| `80-120` | `130` | `false` | `HIGH` |
| `<1.2` | `1.0` | `true` | `null` |
| `<1.2` | `1.2` | `false` | `HIGH` |
| `<1.2` | `1.3` | `false` | `HIGH` |
| `>5` | `4` | `false` | `LOW` |
| `>5` | `6` | `true` | `null` |

For `<limit`, values **at or above** the limit are flagged `HIGH`.  
For `>limit`, values **at or below** the limit are flagged `LOW`.

## UI recommendations

### Result entry screen

1. After save (or on blur), re-fetch results or use the `POST` response.
2. If `referenceEvaluation.inRange === false`:
   - Highlight the value (e.g. red text or background).
   - Show an arrow or label: `LOW` → “↓ Below range”, `HIGH` → “↑ Above range”.
3. Still show `field.referenceRange` and `field.unit` beside the value for context.

### Result report / print view

Use the same rules. Because flags are computed on read, re-opening an order item always uses the latest reference range on the test definition.

### Pseudocode (Dart-like)

```dart
Color? resultValueColor(ReferenceEvaluation? eval) {
  if (eval == null || eval.inRange == null) return null; // default style
  if (eval.inRange == true) return null;
  return Colors.red; // or theme error color
}

String? resultFlagLabel(ReferenceEvaluation? eval) {
  if (eval?.inRange != false) return null;
  switch (eval!.flag) {
    case 'LOW':
      return 'Below reference range';
    case 'HIGH':
      return 'Above reference range';
    default:
      return 'Outside reference range';
  }
}

bool shouldHighlight(ReferenceEvaluation? eval) =>
    eval?.inRange == false;
```

### TypeScript example

```typescript
type ReferenceEvaluation = {
  inRange: boolean | null;
  flag: 'LOW' | 'HIGH' | null;
  parsedValue: number | null;
  referenceRange: string | null;
};

function isAbnormal(eval_: ReferenceEvaluation | undefined): boolean {
  return eval_?.inRange === false;
}
```

## Values with units

The backend parses the **leading number** from `value`:

- `"1.3"` → `1.3`
- `"1.3 mg/dL"` → `1.3`

Prefer entering numeric-only values for `NUMBER` fields when possible.

## Limitations

- One reference range string per field (no built-in age/sex-specific ranges). Use separate fields or cohort-specific tests if needed.
- Qualitative results (`TEXT`, `DROPDOWN`) are never auto-flagged.
- Editing a field’s `referenceRange` changes flags for **all** historical results on the next API read.

## Related backend files

- Evaluator: `src/modules/lab/lab-reference-range.util.ts`
- Result enrichment: `src/modules/lab/lab-result/lab-result.service.ts`
- Field validation: `src/modules/lab/lab-test-field/lab-test-field.service.ts`
