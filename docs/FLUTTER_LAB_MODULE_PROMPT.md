# Flutter prompt: Dynamic Lab Module integration

**Use this entire document as the prompt when asking Cursor to build or extend the Flutter app for the dynamic laboratory module.** Copy everything below the line into Cursor.

---

You are building the **Flutter frontend for the dynamic laboratory module** of a hospital management system. The backend is already implemented and exposes REST APIs under the `/lab` namespace. The app must **integrate with the existing Flutter hospital app** (same auth, same base URL, same navigation/routing patterns) and render **dynamic result-entry forms** from backend-defined test templates so that **new test types work without any new Flutter code**.

## Backend base URL and auth

- Use the **same HTTP client and base URL** as the rest of the hospital app (e.g. existing Dio/Retrofit client with `baseUrl` from env or config).
- Send the **same auth** the app already uses (e.g. Bearer token in `Authorization` header, or existing interceptors). Do not invent a new auth mechanism.
- All lab endpoints are under the path prefix **`/lab`** (e.g. `GET /lab/categories`). There is no extra `/api` in the path unless the rest of the app already uses one.

## API contract (exact endpoints and payloads)

### Categories
- **POST /lab/categories**  
  Body: `{ "name": string, "description"?: string }`  
  Response: `{ id, name, description?, createdAt }`
- **GET /lab/categories**  
  Query: `skip`, `take` (optional).  
  Response: `{ data: [...], total, skip, take }`

### Tests
- **POST /lab/tests**  
  Body: `{ "categoryId": string (UUID), "name": string, "sampleType": string, "description"?: string, "price"?: number, "isActive"?: boolean }`  
  Response: test object with `category: { id, name }`
- **GET /lab/tests**  
  Query: `categoryId`, `isActive` (optional bool), `skip`, `take`.  
  Response: `{ data: [...], total, skip, take }`. Each test includes `category: { id, name }`
- **GET /lab/tests/:id**  
  Response: test with `category` and `versions` (array of versions ordered by versionNumber desc)

### Test versions
- **POST /lab/tests/:testId/version**  
  Body: `{ "setActive"?: boolean }` (default true; deactivates previous active version).  
  Response: new version with `test: { id, name }`
- **GET /lab/tests/:testId/versions**  
  Response: array of versions for that test (with `_count: { fields, orderItems }` if backend includes it)

### Test fields (form template)
- **POST /lab/test-fields**  
  Body: `{ "testVersionId": string (UUID), "label": string, "fieldType": "TEXT"|"NUMBER"|"DROPDOWN"|"CHECKBOX"|"MULTISELECT"|"DATE", "unit"?: string, "referenceRange"?: string, "required"?: boolean, "position"?: number, "optionsJson"?: string }`  
  For DROPDOWN/MULTISELECT, `optionsJson` is a JSON string, e.g. `["A","B"]` or `[{"value":"a","label":"A"}]`.
- **GET /lab/test-fields/:versionId**  
  Response: array of fields for that test version, **ordered by `position`**. Use this to build the dynamic result form.

### Orders
- **POST /lab/orders**  
  Body: `{ "patientId": string (UUID), "doctorId": string (UUID), "items": [ { "testVersionId": string (UUID) }, ... ] }`  
  At least one item; each `testVersionId` must be an **active** version.  
  Response: order with `patient`, `doctor`, `items` (each item has `testVersion` with `test: { id, name, sampleType }`).
- **GET /lab/orders**  
  Query: `patientId`, `status` (PENDING|SAMPLE_COLLECTED|PROCESSING|COMPLETED|VERIFIED), `skip`, `take`.  
  Response: `{ data: [...], total, skip, take }` with nested items and test info.
- **GET /lab/orders/:id**  
  Response: full order with `items`; each item has `testVersion` (with `test` and `fields` ordered by position), `sample`, and `results` (with `field`). Use this for order detail and result entry.
- **PATCH /lab/orders/:id**  
  Body: `{ "status"?: LabOrderStatus }`. Use to update order status.

### Samples
- **POST /lab/samples**  
  Body: `{ "orderItemId": string (UUID), "sampleType": string, "collectedBy": string (staff UUID), "collectionTime": string (ISO 8601), "barcode"?: string }`  
  One sample per order item; backend returns 409 if already recorded.

### Results
- **POST /lab/results**  
  Body: `{ "orderItemId": string, "fieldId": string, "value": string, "enteredBy": string (staff UUID) }`  
  Single result; backend upserts by (orderItemId, fieldId).
- **POST /lab/results/batch**  
  Body: `{ "orderItemId": string, "enteredBy": string, "results": [ { "fieldId": string, "value": string }, ... ] }`  
  Multiple results for one order item in one request. Prefer this for submitting a full form.
- **GET /lab/results/:orderItemId**  
  Response: array of results for that order item (each with `fieldId`, `value`, `field`, `enteredBy`). Use to pre-fill the result form when editing.

## Requirements

### 1. Dynamic form rendering (critical)
- For result entry, **GET /lab/test-fields/:versionId** using the order item’s `testVersionId`, then build the form **only from the returned fields**:
  - **TEXT** → text field
  - **NUMBER** → numeric input; show `unit` and `referenceRange` as hint/subtitle when present
  - **DROPDOWN** → single select; options from `optionsJson` (parse JSON: array of strings or `{ value, label }`)
  - **CHECKBOX** → checkbox; store "true"/"false" or equivalent string in `value`
  - **MULTISELECT** → multi-select; options from `optionsJson`; value can be JSON array string or comma-separated per backend expectation
  - **DATE** → date picker; send value as ISO date string
- Respect `required` and show validation errors. Do not hard-code any test-specific fields; the same form widget must work for CBC, Urinalysis, Malaria, or any future test.

### 2. Screens and flows
- **Lab configuration (lab manager only):**  
  Categories list + create; Tests list + create (by category); Versions list + create per test; Fields list + create per version. Restrict these screens by role if the app has roles (e.g. “lab manager”); technicians/doctors must not edit templates.
- **Orders:**  
  Create order (select patient, select doctor, add tests by choosing from **active** test versions only); list orders with filters (patient, status); order detail with items, status, and actions (e.g. collect sample, enter results).
- **Sample collection:**  
  From an order item, open “Record sample” and submit POST /lab/samples with orderItemId, sampleType (can copy from test), collectedBy (current user’s staff id), collectionTime (now or user-selected), optional barcode.
- **Result entry:**  
  From an order item, load GET /lab/test-fields/:versionId (from item.testVersionId), render the dynamic form, load GET /lab/results/:orderItemId to pre-fill existing values, then submit via **POST /lab/results/batch** with orderItemId, enteredBy, and results array (fieldId + value for each field).

### 3. Integration with existing app
- Reuse the app’s **navigation** (e.g. same drawer/tabs, add “Lab” or “Laboratory” section).
- Reuse **patient and staff selectors** (or existing search/select widgets) for creating orders and for collectedBy/enteredBy.
- Use the same **theme, typography, and layout** patterns as the rest of the app.
- If the app already has a **state management** solution (Provider, Riverpod, Bloc), use it for lab state and API calls; do not introduce a different pattern only for lab.

### 4. Typed models and API client
- Define Dart models for: LabCategory, LabTest, LabTestVersion, LabTestField (with fieldType enum), LabOrder, LabOrderItem, LabSample, LabResult.
- Map backend JSON to these models (fromJson/toJson or code generation). Handle optional fields and nested objects (e.g. order.items[].testVersion.test).
- Use the existing HTTP client; add lab-specific methods or a small lab API service that calls the endpoints above with the correct paths and body shapes.

### 5. Validation and UX
- Client-side validation: required fields, numeric/date format where applicable, at least one test when creating an order.
- Show reference range and unit on result fields when provided by the template.
- Show clear errors when backend returns 400/404/409 (e.g. “Only active test versions can be ordered”, “Sample already recorded for this item”).

## Out of scope
- Do **not** generate or change backend (NestJS/Prisma) code. Flutter/Dart only.
- Do **not** add new backend endpoints in this task; use only the lab API described above.

## Summary
Implement Flutter screens and a **single dynamic result form** that:
1. Fetches fields from GET /lab/test-fields/:versionId.
2. Renders the correct input per fieldType and optionsJson.
3. Submits via POST /lab/results/batch.
4. Integrates with the existing hospital app’s auth, HTTP client, navigation, and styling so the lab module feels like one part of the same product.
