# Frontend integration brief: Obstetrics & Gynaecology (O&G) API

**Purpose:** Give this document to your frontend Cursor agent (or developers) so the UI can consume the O&G backend API and connect seamlessly.

---

## 1. Base URL and authentication

- **Base URL:** Use the same origin as your existing hospital backend (e.g. `http://localhost:3000` or your deployed API URL). All O&G routes are under `/obstetrics/...`.
- **Auth:** Every O&G endpoint is protected. Send the JWT in the `Authorization` header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Login:** Get the token via `POST /auth/login` with body `{ "email": string, "password": string }`. Response includes the JWT (exact shape depends on your backend; typically `{ "access_token": string }` or similar).
- **Current user:** `GET /auth/me` returns the authenticated staff/user (with JWT in header).
- **Access:** Only staff with account types **ONG**, **CONSULTANT**, **INPATIENT_DOCTOR** can use antenatal, labour/delivery, and postnatal endpoints. **THEATERE** is also allowed for gynae procedures. If the user’s `accountType` is not in this set, the API returns **403 Forbidden**.

---

## 2. Enums (use these exact strings in requests and for dropdowns)

Copy these into your frontend types/enums:

```ts
// Pregnancy
PregnancyStatus = 'ONGOING' | 'DELIVERED' | 'LOST' | 'TERMINATED'

// Antenatal – fetal presentation
FetalPresentation = 'CEPHALIC' | 'BREECH' | 'TRANSVERSE' | 'UNKNOWN'

// Labour & delivery
DeliveryMode = 'SVD' | 'ASSISTED_VAGINAL' | 'CS_ELECTIVE' | 'CS_EMERGENCY' | 'BREECH' | 'TWIN' | 'OTHER'
DeliveryOutcome = 'LIVE_BIRTH' | 'STILLBIRTH' | 'OTHER'

// Baby
BabySex = 'M' | 'F' | 'U'

// Postnatal visit
PostnatalVisitType = 'MOTHER' | 'BABY'
```

---

## 3. Date/time format

- **All dates:** ISO 8601 date or date-time strings. Prefer **YYYY-MM-DD** for date-only (e.g. `visitDate`, `lmp`, `edd`) and **YYYY-MM-DDTHH:mm:ss.sssZ** (or with timezone) for date-time (e.g. `deliveryDateTime`, `recordedAt`, `procedureDate`). The backend accepts what `IsDateString()` allows (ISO-like strings).

---

## 4. API endpoints and payloads

### 4.1 Pregnancy (Antenatal)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/pregnancies` | Create pregnancy |
| GET | `/obstetrics/pregnancies` | List pregnancies (paginated) |
| GET | `/obstetrics/pregnancies/:id` | Get one pregnancy |
| PATCH | `/obstetrics/pregnancies/:id` | Update pregnancy |

**POST /obstetrics/pregnancies** (body)

- `patientId` (string, UUID, required) – mother
- `gravida` (number, ≥ 0, required)
- `para` (number, ≥ 0, required)
- `lmp` (string, date, required)
- `edd` (string, date, required)
- `bookingDate` (string, date, optional)
- `status` (PregnancyStatus, optional)
- `outcome` (string, optional)

**PATCH** – same fields as above, all optional.

**GET /obstetrics/pregnancies** (query)

- `patientId` (UUID, optional) – filter by mother
- `status` (PregnancyStatus, optional)
- `skip` (number, default 0)
- `take` (number, default 20, max 100)

**Response (list):** `{ pregnancies: Pregnancy[], total: number, skip: number, take: number }`. Each pregnancy includes nested `patient` (e.g. id, firstName, surname) when returned by the backend.

---

### 4.2 Antenatal visits

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/pregnancies/:pregnancyId/visits` | Create visit (do **not** send `pregnancyId` in body; it’s in the path) |
| GET | `/obstetrics/pregnancies/:pregnancyId/visits` | List visits for a pregnancy |
| GET | `/obstetrics/antenatal-visits/:id` | Get one visit |
| PATCH | `/obstetrics/antenatal-visits/:id` | Update visit |

**POST body (no pregnancyId):**

- `visitDate` (string, date, required)
- `staffId` (UUID, required)
- `gestationWeeks` (number, optional)
- `systolicBP`, `diastolicBP` (number, optional)
- `weight`, `fundalHeight` (number, optional)
- `fetalHeartRate` (number, optional)
- `presentation` (FetalPresentation, optional)
- `urineProtein`, `notes`, `ultrasoundFindings` (string, optional)
- `labResultsJson` (object, optional) – e.g. `{ "Hb": "12.5", "bloodGroup": "O+" }`
- `encounterId` (UUID, optional)

**GET .../visits** (query)

- `fromDate`, `toDate` (string, date, optional)
- `skip` (default 0), `take` (default 50, max 100)

**Response (list):** `{ visits: AntenatalVisit[], total: number, skip: number, take: number }`.

---

### 4.3 Labour & delivery

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/pregnancies/:pregnancyId/labour-deliveries` | Create delivery (do **not** send `pregnancyId` in body) |
| GET | `/obstetrics/labour-deliveries/:id` | Get one delivery (includes partogram entries and babies) |
| GET | `/obstetrics/admissions/:admissionId/labour-delivery` | Get delivery by admission |
| PATCH | `/obstetrics/labour-deliveries/:id` | Update delivery |

**POST body (no pregnancyId):**

- `deliveryDateTime` (string, date-time, required)
- `mode` (DeliveryMode, required)
- `outcome` (DeliveryOutcome, required)
- `deliveredById` (UUID, required)
- `admissionId` (UUID, optional) – link to inpatient admission
- `bloodLossMl` (number, optional)
- `placentaComplete`, `episiotomy` (boolean, optional)
- `perinealTearGrade`, `notes` (string, optional)

---

### 4.4 Partogram (labour progress)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/labour-deliveries/:id/partogram` | Add partogram entry (do **not** send `labourDeliveryId` in body) |
| GET | `/obstetrics/labour-deliveries/:id/partogram` | List partogram entries (ordered by time) |

**POST body (no labourDeliveryId):**

- `recordedAt` (string, date-time, required)
- `recordedById` (UUID, required)
- `cervicalDilationCm` (number, optional)
- `station` (number, optional)
- `contractionsPer10Min`, `fetalHeartRate` (number, optional)
- `moulding`, `descent`, `oxytocin`, `comments` (string, optional)

**GET** returns an array of partogram entries (each with `recordedAt`, dilation, FHR, etc.).

---

### 4.5 Baby (newborn)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/labour-deliveries/:id/babies` | Create baby (do **not** send `labourDeliveryId` in body) |
| GET | `/obstetrics/babies` | List babies (optional filters) |
| GET | `/obstetrics/babies/:id` | Get one baby |
| PATCH | `/obstetrics/babies/:id` | Update baby |
| POST | `/obstetrics/babies/:id/register-patient` | Register baby as a patient (creates Patient, links to baby) |

**POST body (no labourDeliveryId):**

- `motherId` (UUID, required)
- `sex` (BabySex, required)
- `birthWeightG`, `apgar1`, `apgar5` (number, optional)
- `birthLengthCm` (number, optional)
- `resuscitation` (string, optional)
- `birthOrder` (number, default 1, for twins etc.)
- `createdById` (UUID, optional – defaults to current user if omitted)

**PATCH** – only: `birthWeightG`, `birthLengthCm`, `apgar1`, `apgar5`, `resuscitation` (all optional).

**POST .../register-patient** (body)

- `firstName`, `surname` (string, required)
- `otherName`, `gender` (string, optional) – if gender omitted, backend derives from baby sex (M/F/U).

After registration, the baby entity has `registeredPatientId` set and the new patient’s DOB is the delivery date.

**GET /obstetrics/babies** (query)

- `motherId` (UUID, optional)
- `labourDeliveryId` (UUID, optional)
- `skip` (default 0), `take` (default 20, max 100)

**Response (list):** `{ babies: Baby[], total: number, skip: number, take: number }`.

---

### 4.6 Postnatal visits

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/postnatal-visits` | Create visit (mother or baby) |
| GET | `/obstetrics/postnatal-visits` | List visits |
| GET | `/obstetrics/postnatal-visits/:id` | Get one visit |
| PATCH | `/obstetrics/postnatal-visits/:id` | Update visit |

**POST body:**

- `labourDeliveryId` (UUID, required)
- `type` (PostnatalVisitType: `'MOTHER'` or `'BABY'`, required)
- `visitDate` (string, date, required)
- `staffId` (UUID, required)
- For **MOTHER:** `patientId` (UUID, required). Optional: `uterusInvolution`, `lochia`, `perineum`, `bloodPressure`, `temperature`, `breastfeeding`, `notes`.
- For **BABY:** `babyId` (UUID, required). Optional: `weight`, `feeding`, `jaundice`, `immunisationGiven`, `notes`.

**GET** (query)

- `labourDeliveryId`, `type` (MOTHER | BABY), `fromDate`, `toDate`
- `skip` (default 0), `take` (default 50, max 100)

**Response (list):** `{ visits: PostnatalVisit[], total: number, skip: number, take: number }`.

---

### 4.7 Gynaecology procedures

| Method | Path | Description |
|--------|------|-------------|
| POST | `/obstetrics/gynae-procedures` | Create procedure |
| GET | `/obstetrics/gynae-procedures` | List procedures |
| GET | `/obstetrics/gynae-procedures/:id` | Get one procedure |
| PATCH | `/obstetrics/gynae-procedures/:id` | Update procedure |

**POST body:**

- `patientId` (UUID, required)
- `procedureType` (string, required) – e.g. "D&C", "HYSTERECTOMY", "MYOMECTOMY", "LAPAROSCOPY"
- `procedureDate` (string, date-time, required)
- `surgeonId` (UUID, required)
- `encounterId`, `admissionId`, `assistantId` (UUID, optional)
- `findings`, `complications`, `notes` (string, optional)

**GET** (query)

- `patientId`, `procedureType`, `fromDate`, `toDate`
- `skip` (default 0), `take` (default 20, max 100)

**Response (list):** `{ procedures: GynaeProcedure[], total: number, skip: number, take: number }`.

---

## 5. Pagination and list responses

- List endpoints return: `{ [itemsKey]: T[], total: number, skip: number, take: number }`.
- Always send `skip` and `take` as **numbers** (query params may be strings; backend uses class-transformer to coerce). Keep `take` ≤ 100 where a max is documented.
- Use `total` to build pagination UI (e.g. total pages, “Load more”).

---

## 6. Error handling

- **401 Unauthorized** – Missing or invalid JWT. Redirect to login.
- **403 Forbidden** – Valid JWT but user’s `accountType` not allowed for O&G (or that endpoint). Show “You don’t have access to this section.”
- **404 Not Found** – Resource not found (e.g. wrong id). Show a friendly “Not found” message.
- **400 Bad Request** – Validation errors (e.g. invalid UUID, missing required field, invalid enum). Response body is typically `{ message: string, error: "Bad Request" }`; Nest may return `message` as an array of validation messages. Parse and show next to the relevant fields.
- **409 / 4xx** – e.g. “Baby is already registered as a patient” for register-patient. Show the `message` in the UI.

Always read the response body `message` (or first element of `message` if array) for user-facing error text.

---

## 7. Suggested frontend structure (screens/flows)

Map these to the API so the agent can wire them correctly:

1. **Patient context** – Before O&G, the user selects or opens a **patient** (mother). Use existing patient list/search if you have it. All pregnancies are for a `patientId` (mother).
2. **Pregnancies list** – `GET /obstetrics/pregnancies?patientId=<motherId>`. Show list; “Add pregnancy” → POST with same `patientId`.
3. **Pregnancy detail** – `GET /obstetrics/pregnancies/:id`. Show gravida, para, LMP, EDD, status; tabs or sections: **Antenatal visits**, **Labour & delivery**, **Postnatal**.
4. **Antenatal visits** – List: `GET /obstetrics/pregnancies/:pregnancyId/visits`. Add: POST to same path. Edit: PATCH `/obstetrics/antenatal-visits/:id`.
5. **Labour & delivery** – Create from pregnancy: POST `/obstetrics/pregnancies/:pregnancyId/labour-deliveries`. Then:
   - **Partogram:** list GET, add POST under `/obstetrics/labour-deliveries/:id/partogram`.
   - **Babies:** add POST under `/obstetrics/labour-deliveries/:id/babies`; list via GET `/obstetrics/babies?labourDeliveryId=:id` or by mother. “Register as patient” → POST `/obstetrics/babies/:id/register-patient`.
6. **Postnatal** – List: GET `/obstetrics/postnatal-visits?labourDeliveryId=...` (and optionally `type=MOTHER` or `type=BABY`). Create: POST with `labourDeliveryId`, `type`, and either `patientId` (mother) or `babyId` (baby).
7. **Gynaecology (standalone)** – List: GET `/obstetrics/gynae-procedures?patientId=...` (and optional date range / procedureType). Create: POST with patient, procedure type, date, surgeon. Can be a separate section or under patient.

Use the same API base URL and auth (Bearer token) as the rest of the hospital app; only the path prefix and these payloads are specific to O&G.

---

## 8. Quick reference: base path and IDs

- Base path: **`/obstetrics`**
- All IDs in paths and bodies are **UUIDs** (e.g. `patientId`, `pregnancyId`, `labourDeliveryId`, `babyId`, `staffId`). Validate as UUID in forms.
- When creating a resource under a parent (e.g. visit under pregnancy), the parent id goes in the **path**; do **not** repeat it in the body (backend merges it).

This brief is the single source of truth for the frontend to consume the O&G API and work seamlessly with this backend.
