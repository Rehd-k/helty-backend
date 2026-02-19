# Quick Reference Guide

## Start Development Server

```bash
# 1. First time setup (if not done)
pnpm install
cp .env.example .env
# Edit .env with your PostgreSQL details
npx prisma generate
npx prisma migrate dev --name initial

# 2. Start server
pnpm run start:dev
```

## API Access

- **Swagger UI**: http://localhost:3000/api
- **API Docs**: http://localhost:3000/api-json

## Key Modules

| Module | Base URL | Description |
|--------|----------|-------------|
| Patient | `/patients` | Patient management and registration |
| Appointment | `/appointments` | Appointment scheduling |
| Admission | `/admissions` | Hospital admission tracking |
| Payment | `/payments` | Payment recording |
| Medical History | `/medical-histories` | Health history |
| Doctor Report | `/doctor-reports` | Clinical assessments |
| Lab Report | `/lab-reports` | Lab test results |
| Radiology Report | `/radiology-reports` | Imaging results |
| Prescription | `/prescriptions` | Medications |
| Service | `/services` | Hospital services & billing |

## Common Endpoints

### Register Patient
```bash
POST /patients
{
  "title": "Mr",
  "surname": "Okafor",
  "firstName": "Chinedu",
  "dob": "1990-05-15",
  "gender": "Male",
  "maritalStatus": "Married",
  "nationality": "Nigerian",
  "stateOfOrigin": "Lagos",
  "lga": "Ikeja",
  "town": "Victoria Island",
  "permanentAddress": "123 Main St",
  "email": "chinedu@example.com",
  "phoneNumber": "+2348012345678"
}
```

### Search Patient
```bash
GET /patients/search?q=Okafor
```

### Get Patient History
```bash
GET /patients/history/{patient-id}
```

### Schedule Appointment
```bash
POST /appointments
{
  "patientId": "uuid-here",
  "date": "2026-02-20T10:00:00Z",
  "status": "scheduled",
  "notes": "Regular checkup"
}
```

### View Upcoming Appointments
```bash
GET /appointments/upcoming
```

### Record Admission
```bash
POST /admissions
{
  "patientId": "uuid-here",
  "admissionDate": "2026-02-18T14:30:00Z",
  "ward": "General",
  "room": "101",
  "reason": "Hypertension management"
}
```

### Record Payment
```bash
POST /payments
{
  "patientId": "uuid-here",
  "amount": 50000,
  "method": "card",
  "description": "Lab tests"
}
```

### Add Doctor Report
```bash
POST /doctor-reports
{
  "patientId": "uuid-here",
  "doctorId": "doc-001",
  "report": "Patient stable. Continue current medication..."
}
```

### Add Lab Report
```bash
POST /lab-reports
{
  "patientId": "uuid-here",
  "reportType": "Blood Test",
  "results": "Total cholesterol: 180 mg/dL..."
}
```

### Create Service
```bash
POST /services
{
  "name": "ECG Test",
  "description": "Electrocardiogram",
  "price": 5000
}
```

### Assign Service to Patient
```bash
POST /services/patient/{patient-id}/service/{service-id}
{
  "quantity": 1
}
```

## List Operations (with Pagination)

All list endpoints support:
```bash
GET /endpoint?skip=0&take=10
```

Example:
```bash
GET /patients?skip=0&take=10
GET /appointments?skip=20&take=10
GET /payments?skip=0&take=5
```

## Useful Commands

```bash
# Build
pnpm run build

# Development
pnpm run start:dev
pnpm run start:debug

# Production
pnpm run start:prod

# Code quality
pnpm run lint
pnpm run format

# Test
pnpm run test
pnpm run test:watch
pnpm run test:cov
pnpm run test:e2e

# Database
npx prisma studio        # GUI for database
npx prisma generate      # Generate types
npx prisma migrate dev   # Create migration
npx prisma db push       # Sync schema
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/hospital_db"
JWT_SECRET="your-secret-key"
NODE_ENV="development"
PORT=3000
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Deleted successfully |
| 400 | Bad Request - Validation error |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error |

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Field Validation

- **Email**: Must be valid email format
- **Phone**: Must be valid phone number
- **Dates**: ISO 8601 format (YYYY-MM-DD or full timestamp)
- **Amounts**: Positive numbers only
- **Required**: Check API docs for each endpoint

## Data Types

- `String`: Text data
- `DateTime`: Timestamps in ISO format
- `Int`: Whole numbers
- `Float`: Decimal numbers
- `Boolean`: True/False

## Patient ID Format

All patients get auto-generated IDs: `PAT-XXXXXXXX`

Example: `PAT-A1B2C3D4`

## File Locations

- Config: `.env`
- Schema: `prisma/schema.prisma`
- Modules: `src/modules/*/`
- Main app: `src/app.module.ts`
- Entry: `src/main.ts`

## Documentation Files

- `API_DOCUMENTATION.md` - Full API reference
- `SETUP_GUIDE.md` - Installation & troubleshooting
- `BUILD_SUMMARY.md` - Implementation details
- `README.md` - Project overview

## Access Swagger UI

While server is running:
```
http://localhost:3000/api
```

Features:
- ✅ All endpoints listed
- ✅ Try-it-out feature
- ✅ Request/response examples
- ✅ Parameter documentation

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Create database if it doesn't exist

### Port Already in Use
- Change PORT in .env
- Or kill process: `lsof -ti :3000 | xargs kill -9`

### Build Errors
- Run: `npm cache clean --force`
- Run: `pnpm install`
- Run: `npx prisma generate`

### Type Errors
- Run: `npx prisma generate`
- Restart TypeScript server in IDE

## Performance Tips

- ✅ Use pagination for lists
- ✅ Use search for specific records
- ✅ Only request needed fields
- ✅ Index frequently searched fields
- ✅ Cache repeated queries

## Security Notes

⚠️ Store JWT_SECRET securely
⚠️ Use HTTPS in production
⚠️ Never commit .env file
⚠️ Validate all user inputs
⚠️ Use strong database password

## Next Development Steps

1. Add authentication (JWT)
2. Add authorization (roles/permissions)
3. Add file upload support
4. Add real-time notifications
5. Add email/SMS integration
6. Add audit logging
7. Add request caching
8. Add frontend application

## Contact & Support

- Docs: See markdown files in project root
- API Docs: http://localhost:3000/api (when running)
- NestJS: https://docs.nestjs.com
- Prisma: https://www.prisma.io/docs

---

**Last Updated**: February 18, 2026
**Version**: 1.0.0
