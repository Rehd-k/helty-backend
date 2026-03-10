# Radiology Module – API Documentation

This document describes all backend endpoints and data types for the Radiology module. Use it to build the Flutter frontend.

**Base URL:** Your API base (e.g. `http://localhost:3000` or production URL).

**Authentication:** All endpoints require a valid JWT. Send it in the header:

```
Authorization: Bearer <token>
```

---

## Enums

### RadiologyPriority

| Value     | Description |
|----------|-------------|
| `ROUTINE` | Routine (default) |
| `URGENT`  | Urgent        |
| `EMERGENCY` | Emergency   |

### RadiologyModality (scan type)

| Value        | Description |
|-------------|-------------|
| `X_RAY`     | X-Ray       |
| `CT`        | CT scan     |
| `MRI`       | MRI         |
| `ULTRASOUND`| Ultrasound  |
| `MAMMOGRAPHY` | Mammography |
| `FLUOROSCOPY` | Fluoroscopy |
| `OTHER`     | Other       |

### RadiologyRequestStatus

| Value        | Description |
|-------------|-------------|
| `PENDING`   | Not yet scheduled |
| `SCHEDULED` | Scheduled        |
| `IN_PROGRESS` | Scan in progress |
| `COMPLETED` | Scan done, report pending |
| `REPORTED`  | Report completed |
| `CANCELLED` | Cancelled        |

### ReportSeverity

| Value      | Description |
|-----------|-------------|
| `NORMAL`  | Normal      |
| `ABNORMAL`| Abnormal    |
| `CRITICAL`| Critical    |

---

## Endpoints

### 1. Radiology requests

#### Create request

**POST** `/radiology/requests`

**Body (JSON):**

| Field                   | Type   | Required | Description |
|-------------------------|--------|----------|-------------|
| `patientId`             | string (UUID) | Yes | Patient ID |
| `encounterId`           | string (UUID) | No  | Encounter ID (optional) |
| `requestedById`         | string (UUID) | Yes | Ordering doctor (Staff) ID |
| `departmentId`          | string (UUID) | No  | Department ID |
| `clinicalNotes`         | string | No  | Clinical notes |
| `reasonForInvestigation`| string | No  | Reason for investigation |
| `priority`              | enum   | No  | `ROUTINE` \| `URGENT` \| `EMERGENCY` (default `ROUTINE`) |
| `scanType`              | enum   | Yes | One of `RadiologyModality` |
| `bodyPart`             | string | No  | Body part to scan |

**Response:** Created radiology request with `patient`, `encounter`, `requestedBy`, `department` (selected fields).

---

#### List requests (worklist)

**GET** `/radiology/requests`

**Query parameters:**

| Param      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `status`   | string | No       | Filter by `RadiologyRequestStatus` |
| `patientId`| string (UUID) | No | Filter by patient |
| `fromDate` | string (ISO date) | No | Requests from this date |
| `toDate`   | string (ISO date) | No | Requests until this date |
| `priority` | string | No       | Filter by `RadiologyPriority` |
| `skip`     | number | No       | Pagination offset (default 0) |
| `take`     | number | No       | Page size (default 20, max 100) |

**Response:**

```json
{
  "requests": [ { ...RadiologyRequest } ],
  "total": number,
  "skip": number,
  "take": number
}
```

---

#### Get one request

**GET** `/radiology/requests/:id`

**Response:** Single radiology request with full includes: `patient`, `encounter`, `requestedBy`, `department`, `schedule` (with `radiographer`, `machine`), `procedure` (with `performedBy`, `machine`), `images`, `report` (with `signedBy`).

---

#### Update request

**PATCH** `/radiology/requests/:id`

**Body (JSON), all optional:**

| Field                   | Type   | Description |
|-------------------------|--------|-------------|
| `status`                | enum   | `RadiologyRequestStatus` |
| `clinicalNotes`         | string | |
| `reasonForInvestigation`| string | |
| `priority`              | enum   | `RadiologyPriority` |
| `scanType`              | enum   | `RadiologyModality` |
| `bodyPart`             | string | |

**Response:** Updated radiology request.

---

### 2. Worklist

**GET** `/radiology/worklist`

Same query parameters as **List requests** (`status`, `patientId`, `fromDate`, `toDate`, `priority`, `skip`, `take`).

**Response:** Same shape as list requests (`requests`, `total`, `skip`, `take`).

---

### 3. Scheduling

#### Create schedule

**POST** `/radiology/requests/:requestId/schedule`

**Body (JSON):**

| Field            | Type   | Required | Description |
|------------------|--------|----------|-------------|
| `scheduledAt`    | string (ISO 8601) | Yes | Date and time |
| `radiographerId` | string (UUID) | No  | Assigned radiographer (Staff) |
| `machineId`      | string (UUID) | No  | Assigned machine |

**Response:** Created schedule with `radiographer`, `machine`. Request status becomes `SCHEDULED`.

---

#### Update schedule

**PATCH** `/radiology/requests/:requestId/schedule`

**Body (JSON), all optional:** `scheduledAt`, `radiographerId`, `machineId` (same as create).

**Response:** Updated schedule.

---

#### Get schedule

**GET** `/radiology/requests/:requestId/schedule`

**Response:** Schedule for the request with `radiographer`, `machine`.

---

### 4. Procedure recording

#### Create procedure

**POST** `/radiology/requests/:requestId/procedure`

**Body (JSON):**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `performedById` | string (UUID) | Yes | Radiographer (Staff) performing scan |
| `machineId`   | string (UUID) | No  | Machine used |
| `startTime`   | string (ISO 8601) | Yes | Scan start time |
| `endTime`     | string (ISO 8601) | No  | Scan completion time |
| `notes`       | string | No  | Notes during procedure |

**Response:** Created procedure with `performedBy`, `machine`. Request status becomes `IN_PROGRESS`.

---

#### Update procedure

**PATCH** `/radiology/requests/:requestId/procedure`

**Body (JSON), all optional:** `endTime`, `notes`. If `endTime` is set, request status becomes `COMPLETED`.

**Response:** Updated procedure.

---

#### Get procedure

**GET** `/radiology/requests/:requestId/procedure`

**Response:** Procedure record with `performedBy`, `machine`.

---

### 5. Images

#### Upload image

**POST** `/radiology/requests/:requestId/images`

**Content-Type:** `multipart/form-data`

**Body:** One file under field name `file`. Allowed: image (JPEG, PNG, GIF, WebP), PDF. Max size: 50 MB.

**Response:** Created `RadiologyImage` with `id`, `fileName`, `filePath`, `mimeType`, `fileSize`, `uploadedAt`, `uploadedBy` (selected fields).

---

#### List images

**GET** `/radiology/requests/:requestId/images`

**Response:** Array of images for the request (`id`, `fileName`, `filePath`, `mimeType`, `fileSize`, `uploadedAt`, `uploadedBy`).

---

#### Download/serve file

**GET** `/radiology/images/:id/file`

**Response:** File stream (inline). Use `id` from list images.

---

#### Delete image

**DELETE** `/radiology/images/:id`

**Response:** `{ "message": "Image deleted." }`

---

### 6. Reporting

#### Create report

**POST** `/radiology/requests/:requestId/report`

**Body (JSON), all optional:**

| Field           | Type   | Description |
|-----------------|--------|-------------|
| `findings`      | string | Findings |
| `impression`    | string | Impression |
| `recommendations`| string | Recommendations |
| `severity`      | enum   | `NORMAL` \| `ABNORMAL` \| `CRITICAL` |

**Response:** Created report with `signedBy`, `signedAt` (set to current user and time). Request status becomes `REPORTED`.

---

#### Update report

**PATCH** `/radiology/requests/:requestId/report`

**Body (JSON), all optional:** `findings`, `impression`, `recommendations`, `severity`.

**Response:** Updated report.

---

#### Get report

**GET** `/radiology/requests/:requestId/report`

**Response:** Report with `signedBy`, and request summary (`radiologyRequest` with `patient`, `scanType`, `bodyPart`, etc.) for viewing/print.

---

### 7. Dashboard

**GET** `/radiology/dashboard`

**Response:**

```json
{
  "totalScansToday": number,
  "pending": number,
  "completed": number,
  "waitingReports": number,
  "urgentCases": number
}
```

- `totalScansToday`: Requests created today.
- `pending`: Count with status `PENDING`.
- `completed`: Count with status `COMPLETED`.
- `waitingReports`: Completed requests without a report yet.
- `urgentCases`: Emergency priority requests that are PENDING, SCHEDULED, or IN_PROGRESS.

---

### 8. Patient radiology history

**GET** `/radiology/patients/:patientId/radiology-history`

**Response:**

```json
{
  "patientId": "uuid",
  "patient": { "id", "firstName", "surname", "patientId" },
  "requests": [ { ...RadiologyRequest with schedule, procedure, report, images } ]
}
```

Ordered by `createdAt` descending. Use for “Investigation history” / imaging history for a patient.

---

### 9. Machines

#### List machines

**GET** `/radiology/machines`

**Query:** `activeOnly` (optional, default true) – if `false`, returns inactive machines too.

**Response:** Array of `{ id, name, modality, isActive, createdAt, updatedAt }`.

---

#### List by modality

**GET** `/radiology/machines/by-modality/:modality`

**Path:** `modality` = one of `RadiologyModality` (e.g. `X_RAY`, `CT`).

**Response:** Array of machines with that modality (active only).

---

#### Get one machine

**GET** `/radiology/machines/:id`

**Response:** Single machine.

---

## Role matrix

| Endpoint / area              | CONSULTANT / INPATIENT_DOCTOR | RADIOLOGIST | RADIOGRAPHER | RADIOLOGY_RECEPTIONIST | RADIOLOGY |
|-----------------------------|-------------------------------|-------------|--------------|------------------------|-----------|
| POST/GET/PATCH requests      | Yes (order, view)             | Yes         | Yes          | Yes                    | Yes       |
| GET worklist                | No                            | Yes         | Yes          | Yes                    | Yes       |
| Schedule (POST/PATCH/GET)   | No                            | No          | Yes          | Yes                    | Yes       |
| Procedure (POST/PATCH/GET)   | No                            | No          | Yes          | Yes                    | Yes       |
| Images (upload/list/file/delete) | Yes (view)                | Yes         | Yes          | No                     | Yes       |
| Report (POST/PATCH/GET)     | Yes (view)                    | Yes         | No           | No                     | Yes       |
| Dashboard                   | No                            | Yes         | No           | Yes                    | Yes       |
| Patient radiology history   | Yes                           | Yes         | Yes          | Yes                    | Yes       |
| Machines (list/get)         | No                            | Yes         | Yes          | Yes                    | Yes       |

---

## Example requests (minimal)

### Create request

```http
POST /radiology/requests
Content-Type: application/json

{
  "patientId": "patient-uuid",
  "requestedById": "staff-uuid",
  "scanType": "X_RAY",
  "bodyPart": "Chest",
  "priority": "ROUTINE",
  "clinicalNotes": "Cough, rule out pneumonia"
}
```

### Get worklist (pending)

```http
GET /radiology/worklist?status=PENDING&take=20
```

### Schedule

```http
POST /radiology/requests/request-uuid/schedule
Content-Type: application/json

{
  "scheduledAt": "2025-03-11T09:00:00.000Z",
  "radiographerId": "staff-uuid",
  "machineId": "machine-uuid"
}
```

### Record procedure

```http
POST /radiology/requests/request-uuid/procedure
Content-Type: application/json

{
  "performedById": "staff-uuid",
  "machineId": "machine-uuid",
  "startTime": "2025-03-11T09:05:00.000Z",
  "endTime": "2025-03-11T09:20:00.000Z",
  "notes": "No complications"
}
```

### Create report

```http
POST /radiology/requests/request-uuid/report
Content-Type: application/json

{
  "findings": "No focal consolidation. No pleural effusion.",
  "impression": "No acute cardiopulmonary abnormality.",
  "recommendations": "Clinical correlation.",
  "severity": "NORMAL"
}
```

### Get dashboard

```http
GET /radiology/dashboard
```

### Get patient radiology history

```http
GET /radiology/patients/patient-uuid/radiology-history
```

---

## Data types (TypeScript/Flutter reference)

- **RadiologyRequest:** `id`, `patientId`, `encounterId?`, `requestedById`, `departmentId?`, `clinicalNotes?`, `reasonForInvestigation?`, `priority`, `scanType`, `bodyPart?`, `status`, `createdAt`, `updatedAt`. Relations: `patient`, `encounter?`, `requestedBy`, `department?`, `schedule?`, `procedure?`, `images[]`, `report?`.
- **RadiologySchedule:** `id`, `radiologyRequestId`, `scheduledAt`, `radiographerId?`, `machineId?`, `createdAt`, `updatedAt`. Relations: `radiographer?`, `machine?`.
- **RadiologyProcedure:** `id`, `radiologyRequestId`, `performedById`, `machineId?`, `startTime`, `endTime?`, `notes?`, `createdAt`, `updatedAt`. Relations: `performedBy`, `machine?`.
- **RadiologyImage:** `id`, `radiologyRequestId`, `fileName`, `filePath`, `mimeType?`, `fileSize?`, `uploadedById`, `uploadedAt`. Relation: `uploadedBy`.
- **RadiologyStudyReport:** `id`, `radiologyRequestId`, `findings?`, `impression?`, `recommendations?`, `severity?`, `signedById`, `signedAt`, `createdAt`, `updatedAt`. Relation: `signedBy`.
- **RadiologyMachine:** `id`, `name`, `modality`, `isActive`, `createdAt`, `updatedAt`.

Use the enums above for `priority`, `scanType`, `status`, and `severity` in your Flutter models.
