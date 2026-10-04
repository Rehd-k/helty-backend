# Authentication and access

Three guards run on every route, in this order, unless the handler or its controller is marked `@Public()`:

1. `JwtAuthGuard` — valid Bearer token.
2. `AccessGuard` — account type or role is allowed.
3. `ApprovedDeviceGuard` — patient tokens must come from an approved device.

`SUPER_ADMIN` and `CMD` (either `accountType` or `staffRole`) pass `AccessGuard` on every protected route. A later check inside a service can still reject them. Database backup download does that: `assertSuperAdminOnly` does not treat CMD as a super admin.

## Staff login

`POST /auth/login` is public. Body is `emailOrPhone` and `password`. `AuthService.validateUser` loads `Staff` by email or phone and compares the password with bcrypt. Inactive staff cannot sign in.

The access token payload is the object `JwtStrategy.validate` returns unchanged:

| Field | Source |
|---|---|
| `sub` | `Staff.id` |
| `staffId` | Human staff number |
| `accountType` | `AccountType` |
| `staffRole` | `StaffRole` |
| `department` | Department name, or null |
| `departmentHead` | Whether this staff member is some department’s `headId` |

`GET /auth/me` returns that payload. It accepts any valid token, including a patient token.

Password reset:

- `POST /auth/forgot-password` always returns the same message, whether or not the email exists.
- A 6-digit code is stored on `StaffPasswordReset` for 15 minutes. One unused code is active per staff member.
- If Postmark is configured, the code is emailed. If not, it is only in the database and the server log.
- `POST /auth/reset-password` sets a new bcrypt hash when the code matches and is unused.

Staff CRUD is `src/modules/staff`, not `auth`. `POST /staff` is **public** and hashes the password. Treat that as a deployment concern: do not expose it on an open network without something in front of it. When both `accountType` and `staffRole` are sent, `validateStaffRolePairing` checks they belong together. Charge-nurse roles must be tied to a ward that matches the role (ward, ICU, emergency, OPD, O&G).

## Patient login

`POST /patient-auth/login` is public. There is no patient password. The body is the hospital `patientId`, date of birth, and a `deviceKey` (plus optional platform, label, and FCM token).

A wrong id and a wrong date of birth return the same invalid-credentials error. `DECEASED` patients cannot log in.

The patient JWT:

| Field | Meaning |
|---|---|
| `sub` | `Patient.id` (UUID) |
| `patientId` | Hospital number |
| `accountType` | Always `PATIENT` |
| `deviceId` | `PatientDevice.id` for this install |

Staff and patient tokens use the same `JWT_SECRET`. `AccessGuard` rejects a patient token unless the route’s `@AccountTypes` list includes `PATIENT` (or a legacy alias that maps to it).

### Device approval

1. A new `deviceKey` creates `PatientDevice` with status `PENDING`. Login still returns a JWT.
2. `ApprovedDeviceGuard` then blocks patient routes with HTTP 403 and code `DEVICE_PENDING_APPROVAL`.
3. Front desk or medical records approves with `POST /frontdesk/patient-devices/:id/approve`. That sets `APPROVED` and sends an FCM message of type `DEVICE_APPROVED` when a token exists. `DELETE /frontdesk/patient-devices/:id` removes the device.
4. Routes marked `@AllowPendingDevice()` work before approval: `GET` and `POST /patient-auth/me` and `logout`, plus device status and FCM token refresh.
5. `POST /patient-auth/logout` deletes the device. The next login needs approval again.
6. A `deviceKey` already registered to another patient is moved to the logging-in patient and set back to `PENDING`.
7. Hospital number `Q4CMEZM8` is exempt: its devices are stored as `APPROVED` and the guard skips the check.

Missing `deviceId` on a patient route that requires approval returns 401 `DEVICE_SESSION_REQUIRED`. A deleted device returns `DEVICE_REVOKED`.

## How `@AccountTypes` matches

`accountTypeTokenMatches` in `src/common/guards/access.guard.ts` returns true when the token equals `user.accountType` or `user.staffRole`. It also maps old names:

| Token on the route | Who matches |
|---|---|
| `INPATIENT_DOCTOR` | `PHYSICIAN` whose role is resident, intern, junior or senior or chief resident, house officer, or medical officer |
| `CONSULTANT` | `staffRole === CONSULTANT` |
| `RADIOLOGIST` | `RADIOLOGY_HEAD` |
| `RADIOLOGY` | `accountType === RADIOLOGY` |
| `LAB` | `accountType === LABORATORY` |
| `NURSE` | `accountType === NURSE` |
| `PHARMACY` | `accountType === PHARMACY` |
| `ACCOUNTS` | `accountType === ACCOUNTING` |
| `BILLS` | `accountType === BILLING` |
| `FRONTDESK` | Front desk account whose role is `FRONT_DESK` or `FRONT_DESK_HEAD` |
| `FRONT_DESK` | `accountType === FRONT_DESK` |
| `MEDICAL_RECORDS` | Medical records staff or head |
| `JANITOR` | Janitor account or `JANITOR_HEAD` |
| `STORE` | `accountType === STORE` |
| `ONG` | Physician who is not `MEDICAL_STUDENT` |
| `THEATERE` | Physician, matron, or the inpatient, emergency, and ICU nurse roles (spelled with an extra E) |
| `NURSING_CHARGE` | Matron or any charge-nurse role |
| `DIALYSIS`, `THEATRE`, `PURCHASES` | Matching `accountType` |
| `HMO_DESK` | HMO account, `HMO_STAFF`, or `HMO_HEAD` |
| `PATIENT` | `accountType === PATIENT` |

If a route sets `@AccountTypes`, every caller except super admin and CMD must match one token. If it does not, `AccessGuard` looks at `@Roles`. If neither decorator is present, any non-patient token is allowed. Patient tokens still need an explicit `PATIENT` match.

`@Roles('admin' | 'doctor' | 'nurse' | 'laboratory' | 'radiology')` is the older style. `admin` is super admin or CMD. `doctor` is any physician.

Shared lists live in `src/common/constants/clinical-access.constants.ts` (`CLINICAL_READ_ACCESS`) and `department-head.constants.ts` (`DEPARTMENT_HEAD_ACCESS`, `HOUSEKEEPING_ACCESS`).

## Account types and roles

`AccountType` is the department. `StaffRole` is the job. Both are Prisma enums.

| Account type | Roles |
|---|---|
| `BILLING` | `BILLING_HEAD`, `BILLING_STAFF` |
| `ACCOUNTING` | `ACCOUNT_HEAD`, `ACCOUNTING_STAFF` |
| `PHARMACY` | `PHARMACY_STORE`, `PHARMACY_DISPENSARY`, `PHARMACY_HEAD` |
| `NURSE` | `MATRON`, charge nurses (`WARD`, `ICU`, `EMERGENCY`, `OPD`, `ONG`), and line nurses (`INPATIENT`, `OUTPATIENT`, `EMERGENCY`, `ICU`, `ONG`) |
| `PHYSICIAN` | `PHYSICIAN_HEAD`, `CONSULTANT`, `SPECIALIST`, resident ladder, `HOUSE_OFFICER`, `MEDICAL_OFFICER`, `MEDICAL_STUDENT` |
| `LABORATORY` | `LAB_HEAD`, `LAB_SCIENTIST` |
| `RADIOLOGY` | `RADIOLOGY_HEAD`, `RADIOGRAPHER`, `RADIOLOGY_RECEPTIONIST` |
| `STORE` | `HEAD_OF_STORE`, `STOREKEEPER` |
| `MEDICAL_RECORDS` | `MEDICAL_RECORDS_HEAD`, `MEDICAL_RECORDS` |
| `FRONT_DESK` | `FRONT_DESK_HEAD`, `FRONT_DESK` |
| `ICT` | `ICT_HEAD`, `ICT_STAFF` |
| `CMD` | `CMD` |
| `CMAC` | `CMAC` |
| `HMO` | `HMO_HEAD`, `HMO_STAFF` |
| `PURCHASES` | `PURCHASES_STORE`, `PURCHASES_STAFF`, `PURCHASES_HEAD` |
| `DIALYSIS` | `DIALYSIS_HEAD`, `DIALYSIS_NURSE`, `DIALYSIS_TECH`, `DIALYSIS_RECEPTIONIST` |
| `THEATRE` | `THEATRE_HEAD`, `THEATRE_NURSE`, `THEATRE_SCRUB`, `THEATRE_ANAESTHETIST`, `THEATRE_RECEPTIONIST` |
| `JANITOR` | `JANITOR_HEAD` |
| `SUPER_ADMIN` | `SUPER_ADMIN` |

Physicians may also carry `MedicalSpecialty` (cardiology, obstetrics, and the rest of that enum). That value is profile data. Encounter specialty forms use the same enum but are enabled per encounter, not copied from the doctor automatically.

## Authorization inside services

Guards answer “may this department call this URL?”. Services answer “may this person change this row?”.

Examples:

- `EncounterEditPolicyService` lets the treating doctor edit. On an encounter tied to an `ACTIVE` admission, any physician except a medical student may edit. Completed encounters record `EncounterEditHistory` before the change.
- Ward-round notes can be updated only by the doctor who wrote them.
- Several nursing rows (notes, intake/output, care plans, monitoring charts, administrations) can be updated only by the author.
- Hospital assets check view, log, and manage grants in `HospitalAssetsService` after the guard has only checked that the caller is staff.
- Refund approval checks account head, billing head, or super admin inside the accounts service.
- Patient portal reads of a child require a `PatientFamilyLink`. The helper is `resolveSubjectPatientId`. Create and cancel of appointments use the token patient, not the child.

## Public routes

Anything with `@Public()` skips JWT. The important ones:

- `POST /auth/login`, forgot-password, reset-password
- `POST /patient-auth/login`
- `GET /patients` (the paginated list)
- `POST /staff`
- `GET /` and `GET /server-time`
- `GET /uploads/patients/:patientId/avatar.jpg`
- `GET /system-announcements/active`
- `POST /public/emergency-requests`
- All of `/helty-desktop` and `/imsh-android` (uploads still need the shared password)

Do not add `@Public()` to bypass a guard while testing. Add the account type the real client will use.
