# Flutter client: Patient chart & archived encounters

This guide describes how the Flutter app should call the patient chart API and the archived-encounter upload endpoints added to the hospital backend.

## Base URL and authentication

- **Base URL:** Configure from your environment (e.g. `http://localhost:3000` in development). Match `PUBLIC_API_BASE_URL` if you build absolute download links.
- **Auth:** All endpoints below require a valid JWT from staff login (`POST /auth/login` or your existing auth flow).
- **Header:** Send on every request:

```http
Authorization: Bearer <access_token>
```

## Patient identifier

Use the patient **UUID** (`Patient.id`), not the hospital registration number (`patientId` string on the chart), in path parameters unless you add a separate lookup later.

Example UUID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## 1. Patient chart (`GET /patients/:id/chart`)

Unified, opt-in view of a patient record. Without `include`, the response is lightweight: demographics, summary counts, and the list of sections you can request.

### 1.1 Initial screen (profile + summary)

```http
GET /patients/{patientUuid}/chart
```

**Response shape (abbreviated):**

```json
{
  "patient": {
    "id": "...",
    "patientId": "HOS-12345",
    "firstName": "Jane",
    "surname": "Doe",
    "dob": "1990-01-15T00:00:00.000Z",
    "gender": "Female",
    "phoneNumber": "+234...",
    "status": "OUTPATIENT",
    "ward": { "id": "...", "name": "OPD" },
    "hmoProvider": { "id": "...", "name": "...", "code": "..." }
  },
  "summary": {
    "encounterCount": 42,
    "admissionCount": 3,
    "openInvoiceCount": 1,
    "walletBalance": 1500.5,
    "archivedEncounterGroupCount": 5
  },
  "availableSections": [
    "encounters",
    "admissions",
    "medicationOrders",
    "prescriptions",
    "labOrders",
    "labRequests",
    "labReports",
    "radiologyOrders",
    "radiologyReports",
    "vitals",
    "allergies",
    "appointments",
    "invoices",
    "payments",
    "wallet",
    "medicalHistories",
    "doctorReports",
    "archivedEncounters"
  ]
}
```

### 1.2 Load a tab / section

Pass comma-separated section keys:

```http
GET /patients/{patientUuid}/chart?include=encounters,invoices
```

Only requested keys appear at the top level alongside `patient`, `summary`, and `availableSections`:

```json
{
  "patient": { ... },
  "summary": { ... },
  "availableSections": [ ... ],
  "encounters": [ ... ],
  "invoices": [ ... ]
}
```

### 1.3 Query parameters

| Parameter   | Type   | Default | Description |
|------------|--------|---------|-------------|
| `include`  | string | —       | Comma-separated section keys from `availableSections` |
| `limit`    | int    | 20      | Max rows per section (1–100) |
| `skip`     | int    | 0       | Offset per section |
| `fromDate` | ISO date | —     | Filter time-based sections (start) |
| `toDate`   | ISO date | —     | Filter time-based sections (end) |

### 1.4 Dart example (`dio`)

```dart
import 'package:dio/dio.dart';

class PatientChartApi {
  PatientChartApi(this._dio, {required this.baseUrl});
  final Dio _dio;
  final String baseUrl;

  Future<Map<String, dynamic>> getChart(
    String patientId, {
    List<String>? include,
    int limit = 20,
    int skip = 0,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final query = <String, dynamic>{
      'limit': limit,
      'skip': skip,
      if (include != null && include.isNotEmpty)
        'include': include.join(','),
      if (fromDate != null) 'fromDate': fromDate.toIso8601String(),
      if (toDate != null) 'toDate': toDate.toIso8601String(),
    };

    final res = await _dio.get<Map<String, dynamic>>(
      '$baseUrl/patients/$patientId/chart',
      queryParameters: query,
    );
    return res.data!;
  }
}

// Usage: load encounters tab when user opens it
final chart = await api.getChart(
  patientUuid,
  include: ['encounters', 'vitals', 'allergies'],
  limit: 20,
);
final encounters = chart['encounters'] as List<dynamic>?;
```

### 1.5 Section keys reference

| `include` value       | Content |
|----------------------|---------|
| `encounters`         | Visits with doctor, diagnoses, admission link |
| `admissions`         | Inpatient stays, ward, bed, attending doctor |
| `medicationOrders`   | Structured med orders |
| `prescriptions`      | Prescription records |
| `labOrders`          | Lab workflow orders + item results |
| `labRequests`        | Encounter lab requests + invoice stub |
| `labReports`         | Legacy text lab reports |
| `radiologyOrders`    | Imaging orders (metadata, no file bytes) |
| `radiologyReports`   | Legacy radiology reports |
| `vitals`             | Patient vitals |
| `allergies`          | Patient allergies |
| `appointments`       | Appointments |
| `invoices`           | Invoices with items and `payments` |
| `payments`           | Legacy `Payment` rows |
| `wallet`             | `{ wallet, transactions }` |
| `medicalHistories`   | Medical history entries |
| `doctorReports`      | Doctor reports |
| `archivedEncounters` | Scanned historical encounters (see §2) |

### 1.6 Performance guidance

- **Do not** request all sections in one call on mobile.
- Load `GET .../chart` once for header/summary.
- Lazy-load each tab with `include=<singleSection>` (or a small bundle, e.g. `encounters,vitals,allergies`).
- Use `limit` / `skip` for “load more” lists.

### 1.7 Errors

| Status | Meaning |
|--------|---------|
| 400    | Invalid `include` key — message lists allowed sections |
| 401    | Missing or expired token |
| 404    | Patient UUID not found |

---

## 2. Archived encounters (scanned legacy charts)

For patients with years of paper records, OPD staff can upload multiple images/PDFs per historical visit. Files are grouped by **when the visit occurred** (`encounterOccurredAt`), with **upload time** on the group (`createdAt`) and each file (`uploadedAt` on documents).

### 2.1 Upload

```http
POST /patients/{patientUuid}/archived-encounters
Content-Type: multipart/form-data
```

**Form fields:**

| Field                   | Required | Description |
|-------------------------|----------|-------------|
| `encounterOccurredAt`   | Yes      | ISO 8601 datetime of the original visit |
| `title`                 | No       | Short label, e.g. `OPD visit – Dr. Ade` |
| `notes`                 | No       | Free text |
| `files`                 | Yes      | One or more files (same field name, repeated) |

**Allowed file types:** JPEG, PNG, GIF, WebP, PDF  
**Max size per file:** 50 MB (override with env `PATIENT_ARCHIVE_MAX_FILE_BYTES`)

**Roles allowed to upload/delete:** Front desk, outpatient nurse, medical records, physicians, admin (see Swagger).

### 2.2 Dart upload example (`dio`)

```dart
Future<Map<String, dynamic>> uploadArchivedEncounter({
  required String patientId,
  required DateTime encounterOccurredAt,
  required List<String> filePaths,
  String? title,
  String? notes,
}) async {
  final form = FormData.fromMap({
    'encounterOccurredAt': encounterOccurredAt.toUtc().toIso8601String(),
    if (title != null) 'title': title,
    if (notes != null) 'notes': notes,
    'files': await Future.wait(
      filePaths.map(
        (p) => MultipartFile.fromFile(
          p,
          filename: p.split(RegExp(r'[/\\]')).last,
        ),
      ),
    ),
  });

  final res = await _dio.post<Map<String, dynamic>>(
    '$baseUrl/patients/$patientId/archived-encounters',
    data: form,
  );
  return res.data!;
}
```

**Response:** One `PatientArchivedEncounter` group with nested `documents` (ids, `fileName`, `mimeType`, `fileSize`, `uploadedAt`) and `uploadedBy` staff stub.

### 2.3 List groups

```http
GET /patients/{patientUuid}/archived-encounters
```

Returns an array ordered by `encounterOccurredAt` descending. Each item includes `documents` metadata (not file bytes).

You can also load via chart:

```http
GET /patients/{patientUuid}/chart?include=archivedEncounters
```

### 2.4 Download / preview a file

```http
GET /patients/archived-encounters/documents/{documentId}/file
```

- Use the same `Authorization` header.
- Response is the raw file (`Content-Type` from stored MIME).
- In Flutter, open in a PDF viewer or `Image.network` only if you attach the token (prefer downloading bytes with Dio and showing from temp file/cache).

```dart
Future<List<int>> downloadArchivedDocument(String documentId) async {
  final res = await _dio.get<List<int>>(
    '$baseUrl/patients/archived-encounters/documents/$documentId/file',
    options: Options(responseType: ResponseType.bytes),
  );
  return res.data!;
}
```

### 2.5 Delete a document

```http
DELETE /patients/archived-encounters/documents/{documentId}
```

Restricted to the same upload roles. If the group has no documents left, the parent archived-encounter row is removed.

### 2.6 UI hints

| Display label        | Source field |
|---------------------|--------------|
| Visit date          | `encounterOccurredAt` |
| Uploaded at         | `createdAt` on the group |
| Per-file uploaded   | `documents[].uploadedAt` |
| Uploaded by         | `uploadedBy.firstName` / `lastName` |

Group multiple `files` from one picker session into a single POST so they share one historical visit datetime.

---

## 3. Related legacy endpoints

These remain available; prefer `/chart` for new screens:

- `GET /patients/:id` — full patient with many relations (heavy)
- `GET /patients/history/:id` — older subset of clinical data

---

## 4. Swagger

With the API running, open `/api` (Swagger UI) and inspect tags **Patient** and **Patient – Archived encounters** for live schemas and try-it-out requests.
