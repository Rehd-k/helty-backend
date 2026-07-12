# Patient Avatar — Hospital Frontend Integration Guide

This guide explains how the **Helty Hospital Management System (HMS) frontend** should display patient profile photos anywhere a patient is shown. Photos are uploaded by patients via the IMSH patient portal; staff apps are **read-only** for avatars.

For backend upload/delete APIs, see [patient-profile-photo.md](./patient-profile-photo.md).

---

## API contract

Every patient object returned by the backend may include:

| Field | Type | Description |
|-------|------|-------------|
| `avatarUrl` | `string \| null` | Absolute public URL to a 512×512 JPEG avatar |

Example:

```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "patientId": "P-12345",
  "firstName": "Ada",
  "surname": "Okonkwo",
  "avatarUrl": "https://api.example.com/uploads/patients/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.jpg"
}
```

Rules:

- When no photo is set, `avatarUrl` is `null` (or omitted — treat both the same).
- Avatar URLs are **public** — no `Authorization` header is required to load the image.
- URLs are always absolute (built from `PUBLIC_API_BASE_URL` on the server).

---

## Where `avatarUrl` appears

### Staff HMS APIs

`avatarUrl` is included on:

- `GET /patients` and `GET /patients/:id` (full patient records)
- Any nested `patient` object that uses the shared name select (queue, frontdesk, encounters, invoices, admissions, lab/radiology orders, nursing dashboards, etc.)
- Frontdesk live queue rows (via `toPatientNameWithLegacyKey`) alongside `firstName`, `surname`, `displayName`, `patientName`

### Patient portal (reference only)

- `POST /patient-auth/login` → `{ accessToken, patient }`
- `GET /patient-auth/me` → `{ patient }`
- `GET /patient/profile`, `PUT /patient/profile`
- `POST /patient/profile/photo`, `DELETE /patient/profile/photo`

Staff UI must **not** call the photo upload/delete endpoints.

---

## Display rule

```
if avatarUrl is non-null and image loads successfully
  → show circular profile photo
else
  → show initials fallback (existing behavior)
```

Use the same rule on **every** screen that shows a patient identity chip, list row avatar, or chart header.

---

## Shared `PatientAvatar` component

Create one reusable component and use it app-wide instead of ad-hoc initials circles.

### Props

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `avatarUrl` | `string \| null` | No | From API |
| `firstName` | `string \| null` | No | For initials |
| `surname` | `string \| null` | No | For initials |
| `size` | `number` | Yes | Diameter in logical pixels |
| `updatedAt` | `string \| Date \| null` | No | Optional cache-buster |

### Initials helper

```typescript
export function patientInitials(
  firstName?: string | null,
  surname?: string | null,
): string {
  const a = firstName?.trim().charAt(0) ?? '';
  const b = surname?.trim().charAt(0) ?? '';
  const initials = (a + b).toUpperCase();
  return initials || '?';
}
```

### Flutter example

```dart
class PatientAvatar extends StatelessWidget {
  const PatientAvatar({
    super.key,
    this.avatarUrl,
    this.firstName,
    this.surname,
    required this.size,
    this.updatedAt,
  });

  final String? avatarUrl;
  final String? firstName;
  final String? surname;
  final double size;
  final DateTime? updatedAt;

  String get _initials {
    final a = (firstName ?? '').trim().isNotEmpty
        ? firstName!.trim()[0].toUpperCase()
        : '';
    final b = (surname ?? '').trim().isNotEmpty
        ? surname!.trim()[0].toUpperCase()
        : '';
    final combined = '$a$b';
    return combined.isEmpty ? '?' : combined;
  }

  String? get _imageUrl {
    if (avatarUrl == null || avatarUrl!.isEmpty) return null;
    if (updatedAt == null) return avatarUrl;
    final sep = avatarUrl!.contains('?') ? '&' : '?';
    return '$avatarUrl${sep}v=${updatedAt!.millisecondsSinceEpoch}';
  }

  @override
  Widget build(BuildContext context) {
    final url = _imageUrl;
    if (url != null) {
      return ClipOval(
        child: Image.network(
          url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _initialsFallback(context),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return _initialsFallback(context);
          },
        ),
      );
    }
    return _initialsFallback(context);
  }

  Widget _initialsFallback(BuildContext context) {
    return CircleAvatar(
      radius: size / 2,
      child: Text(
        _initials,
        style: TextStyle(fontSize: size * 0.35),
      ),
    );
  }
}
```

### React / web example

```tsx
type PatientAvatarProps = {
  avatarUrl?: string | null;
  firstName?: string | null;
  surname?: string | null;
  size: number;
  updatedAt?: string | Date | null;
};

export function patientInitials(
  firstName?: string | null,
  surname?: string | null,
): string {
  const a = firstName?.trim().charAt(0) ?? '';
  const b = surname?.trim().charAt(0) ?? '';
  const initials = (a + b).toUpperCase();
  return initials || '?';
}

export function PatientAvatar({
  avatarUrl,
  firstName,
  surname,
  size,
  updatedAt,
}: PatientAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = patientInitials(firstName, surname);

  const src =
    avatarUrl && !failed
      ? updatedAt
        ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${new Date(updatedAt).getTime()}`
        : avatarUrl
      : null;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ ...baseStyle, objectFit: 'cover' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      style={baseStyle}
      aria-label={initials}
      role="img"
    >
      {initials}
    </div>
  );
}
```

---

## Example API responses

### Frontdesk live queue row

```json
{
  "id": "wp:abc-123",
  "patientId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "firstName": "Ada",
  "surname": "Okonkwo",
  "displayName": "Ada Okonkwo",
  "patientName": "Ada Okonkwo",
  "avatarUrl": "https://api.example.com/uploads/patients/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.jpg",
  "status": "Waiting"
}
```

### Patient detail (`GET /patients/:id`)

```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "patientId": "P-12345",
  "firstName": "Ada",
  "surname": "Okonkwo",
  "avatarUrl": "https://api.example.com/uploads/patients/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.jpg",
  "status": "OUTPATIENT"
}
```

### Nested patient on invoice

```json
{
  "id": "inv-001",
  "patient": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "firstName": "Ada",
    "surname": "Okonkwo",
    "displayName": "Ada Okonkwo",
    "avatarUrl": null
  }
}
```

---

## App-wide rollout checklist

Replace every hardcoded initials-only avatar with `PatientAvatar`:

- [ ] Patient search and list
- [ ] Patient chart / profile header
- [ ] Waiting room queue
- [ ] Frontdesk live queue
- [ ] Encounter header and worklists
- [ ] Admission cards and ward boards
- [ ] Invoice and billing rows
- [ ] Lab and radiology order lists
- [ ] Nursing dashboards
- [ ] Appointment lists
- [ ] Patient feedback lists
- [ ] Any shared patient picker / autocomplete row

### TypeScript / Dart model updates

Add `avatarUrl?: string | null` to every patient model/DTO used by the UI. Map it from JSON in deserialization; default to `null` when absent.

### Do not

- Upload or delete photos from the HMS app (patient portal only).
- Require staff auth to display `avatarUrl` images.
- Use a single global static avatar for all patients.

---

## Caching

The backend overwrites `uploads/patients/{uuid}/avatar.jpg` when a patient replaces their photo. Browsers may cache the old image.

Mitigations:

1. Append `?v={updatedAt}` when the patient record includes `updatedAt`.
2. Re-fetch patient data after long-lived sessions.
3. On image `onError`, fall back to initials (already required).

---

## Accessibility

- Use `alt=""` on decorative avatar images (name is shown beside the avatar).
- For initials-only fallback, expose initials via `aria-label` or visible text.
- Ensure contrast for initials text on the fallback circle.

---

## Testing (frontend)

- [ ] Patient with `avatarUrl` set → photo renders as circle
- [ ] Patient with `avatarUrl: null` → initials render
- [ ] Broken image URL → initials fallback
- [ ] Same component used on list row and detail header
- [ ] No auth header sent for avatar image requests
