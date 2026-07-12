# Patient Profile Photo API

Backend implementation guide for patient profile photo upload and removal in the IMSH patient portal (NestJS + Prisma).

The Flutter patient app (`imsh`) uploads **square-cropped** JPEG images and displays them as circular avatars. The backend must store the file and expose a public `avatarUrl` on all patient payloads.

## Schema change

Add an optional URL field to the existing `Patient` model:

```prisma
model Patient {
  // ...existing fields
  avatarUrl String?
}
```

Run a Prisma migration after adding the field.

## Patient JSON contract

Include `avatarUrl` (nullable string, absolute public URL) on every endpoint that returns a patient object:

| Endpoint | Response shape |
|----------|----------------|
| `POST /patient-auth/login` | `{ accessToken, patient }` |
| `GET /patient-auth/me` | `{ patient }` or patient object |
| `GET /patient/profile` | patient object |
| `PUT /patient/profile` | updated patient object |
| `POST /patient/profile/photo` | updated patient object |
| `DELETE /patient/profile/photo` | updated patient object |

Example patient fragment:

```json
{
  "id": "clx...",
  "patientId": "P-12345",
  "firstName": "Ada",
  "surname": "Okonkwo",
  "avatarUrl": "https://api.imsh.ng/uploads/patients/clx.../avatar.jpg"
}
```

When no photo is set, return `"avatarUrl": null` or omit the field (the app treats both as no photo).

## Authentication

All routes require a valid patient JWT with `accountType: PATIENT`. Patients may only upload or delete **their own** profile photo.

Reject staff tokens and cross-patient access with `403 Forbidden`.

## POST `/patient/profile/photo`

Upload or replace the authenticated patient's profile photo.

### Request

- **Method:** `POST`
- **Path:** `/patient/profile/photo`
- **Headers:**
  - `Authorization: Bearer <patient_jwt>`
  - `Content-Type: multipart/form-data`
- **Body:** multipart form with a single file field:
  - **Field name:** `photo` (required)
  - **Accepted MIME types:** `image/jpeg`, `image/png`, `image/webp`
  - **Max file size:** 5 MB

The Flutter client crops to a **1:1 square** (512×512 JPEG) before upload. The server should still validate:

1. File is a real image (magic bytes / image decoder).
2. Aspect ratio is approximately square (tolerance ±2%), **or** center-crop to square server-side.
3. Optionally resize to a standard size (e.g. 512×512) and re-encode as JPEG.

### Processing

1. Resolve patient from JWT.
2. Validate file type and size.
3. Strip EXIF metadata (privacy).
4. Store file in object storage or local uploads directory, e.g.:
   - `uploads/patients/{patientId}/avatar.jpg`
   - or S3 key `patients/{patientId}/avatar.jpg`
5. If the patient already has an `avatarUrl`, delete the previous stored file.
6. Set `Patient.avatarUrl` to the **absolute public URL** of the new file.
7. Return the full updated patient JSON.

### Response

- **200 OK** — updated patient object (includes `avatarUrl`)
- **400 Bad Request** — missing file, invalid type, too large, or not square
- **401 Unauthorized** — missing or invalid token
- **403 Forbidden** — non-patient token
- **413 Payload Too Large** — file exceeds limit
- **500 Internal Server Error** — storage failure

### Example (curl)

```bash
curl -X POST "https://api.imsh.ng/patient/profile/photo" \
  -H "Authorization: Bearer <token>" \
  -F "photo=@/path/to/avatar.jpg;type=image/jpeg"
```

## DELETE `/patient/profile/photo`

Remove the authenticated patient's profile photo.

### Request

- **Method:** `DELETE`
- **Path:** `/patient/profile/photo`
- **Headers:** `Authorization: Bearer <patient_jwt>`
- **Body:** none

### Processing

1. Resolve patient from JWT.
2. If `avatarUrl` is set, delete the stored file from disk/S3.
3. Set `Patient.avatarUrl = null`.
4. Return the full updated patient JSON.

### Response

- **200 OK** — updated patient object (`avatarUrl` null)
- **401 Unauthorized**
- **403 Forbidden**

If the patient has no photo, return **200** with unchanged patient (idempotent).

## Storage recommendations

| Environment | Suggestion |
|-------------|------------|
| Development | Local `uploads/` served via NestJS static module or reverse proxy |
| Production | S3-compatible object storage with CDN; HTTPS URLs only |

Requirements:

- URLs must be publicly readable (avatars are not sensitive clinical data, but avoid guessable sequential IDs if possible).
- Use content-hash or patient-id keyed paths; overwrite on replace.
- Set `Cache-Control` with a reasonable max-age; bust cache on replace by using a new filename or version query param.

## Security

- **Authorization:** patient JWT only; scope to authenticated patient record.
- **Rate limiting:** e.g. 10 uploads per hour per patient.
- **Validation:** reject executables, SVG, and non-image payloads.
- **EXIF stripping:** remove GPS and device metadata before save.
- **Optional:** virus scan on upload in production.

## NestJS module sketch

Suggested structure under `patient-portal` module:

```
patient-portal/
  patient-profile.controller.ts   # GET/PUT /patient/profile
  patient-profile-photo.controller.ts  # POST/DELETE /patient/profile/photo
  patient-profile.service.ts
  patient-photo-storage.service.ts
```

Use `@UseInterceptors(FileInterceptor('photo'))` with `multer` limits:

```typescript
{
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
}
```

Swagger tag: `patient-portal`.

## Flutter client alignment

The app (`imsh`) calls:

- `POST /patient/profile/photo` with `FormData` field `photo` (JPEG, 512×512 square)
- `DELETE /patient/profile/photo`

After success it updates local session state so the circular avatar appears in the profile screen and app bar without restart.

## Testing checklist

- [ ] Upload JPEG square image → `avatarUrl` returned and file accessible
- [ ] Replace existing photo → old file deleted, new URL set
- [ ] Delete photo → `avatarUrl` null, file removed
- [ ] `GET /patient/profile` and `GET /patient-auth/me` include `avatarUrl`
- [ ] Login response includes `avatarUrl`
- [ ] Reject non-image, oversized, and non-patient tokens
- [ ] Idempotent DELETE when no photo exists
