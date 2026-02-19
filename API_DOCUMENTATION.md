# Hospital Management System - Backend API

Complete hospital management backend for the medical records department built with NestJS, Prisma, and PostgreSQL.

## Features

### Patient Management
- Patient registration with comprehensive medical information
- Patient ID generation using nanoid
- Search functionality by name, ID, email, and phone
- Complete patient history tracking
- Support for title, personal details, contact information, and next of kin

### Appointments
- Schedule and manage patient appointments
- Track appointment status (scheduled, completed, cancelled, no-show, rescheduled)
- View upcoming appointments
- Patient-specific appointment history

### Hospital Admissions
- Record patient hospital admissions
- Track ward and room assignments
- Monitor discharge status
- View active admissions
- Complete admission history per patient

### Medical Records
- **Doctor Reports**: Clinical assessments and notes from physicians
- **Lab Reports**: Laboratory test results and analysis
- **Radiology Reports**: Medical imaging results (X-ray, CT, MRI, etc.)

### Prescriptions
- Record medication prescriptions
- Track dosage and duration
- Monitor active prescriptions
- Maintain complete prescription history

### Payment Management
- Record all patient payments
- Support multiple payment methods (cash, card, bank transfer, insurance, cheque)
- Track payment history
- Aggregate payment totals per patient

### Hospital Services
- Define hospital services with pricing
- Assign services to patients
- Track service utilization
- Manage service costs for billing

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: class-validator & class-transformer
- **API Documentation**: Swagger/OpenAPI
- **ID Generation**: nanoid
- **Node Version**: 22.x

## Project Structure

```
src/
├── modules/
│   ├── patient/              # Patient management module
│   ├── appointment/          # Appointment management
│   ├── admission/            # Hospital admission tracking
│   ├── payment/              # Payment recording
│   ├── doctor-report/        # Doctor clinical reports
│   ├── lab-report/           # Laboratory reports
│   ├── radiology-report/     # Radiology/imaging reports
│   ├── prescription/         # Medication prescriptions
│   └── service/              # Hospital services
├── prisma/                    # Database schema and migrations
│   └── schema.prisma
└── main.ts                    # Application entry point
```

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd hospital/backend
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string
```

4. **Setup database**
```bash
# Create PostgreSQL database first
npx prisma migrate dev --name initial
```

5. **Run the application**
```bash
# Development mode with auto-reload
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

## API Documentation

Once the application is running, visit:
```
http://localhost:3000/api
```

This provides interactive Swagger UI documentation for all endpoints.

## API Endpoints

### Patients
- `POST /patients` - Create new patient
- `GET /patients` - List all patients (paginated)
- `GET /patients/search?q=query` - Search patients
- `GET /patients/:id` - Get patient details
- `GET /patients/history/:id` - Get complete patient history
- `PATCH /patients/:id` - Update patient information
- `DELETE /patients/:id` - Delete patient

### Appointments
- `POST /appointments` - Create appointment
- `GET /appointments` - List all appointments
- `GET /appointments/upcoming` - Get upcoming appointments
- `GET /appointments/patient/:patientId` - Get patient's appointments
- `GET /appointments/:id` - Get appointment details
- `PATCH /appointments/:id` - Update appointment
- `DELETE /appointments/:id` - Delete appointment

### Admissions
- `POST /admissions` - Record admission
- `GET /admissions` - List all admissions
- `GET /admissions/active` - Get active admissions
- `GET /admissions/patient/:patientId` - Get patient's admissions
- `GET /admissions/:id` - Get admission details
- `PATCH /admissions/:id` - Update admission (e.g., discharge)
- `DELETE /admissions/:id` - Delete admission record

### Payments
- `POST /payments` - Record payment
- `GET /payments` - List all payments
- `GET /payments/patient/:patientId` - Get patient's payments
- `GET /payments/patient/:patientId/total` - Get payment totals
- `GET /payments/:id` - Get payment details
- `PATCH /payments/:id` - Update payment record
- `DELETE /payments/:id` - Delete payment record

### Medical Reports
- `POST /doctor-reports` - Create doctor report
- `GET /doctor-reports` - List all doctor reports
- `GET /doctor-reports/patient/:patientId` - Get patient's reports
- `PATCH /doctor-reports/:id` - Update report
- `DELETE /doctor-reports/:id` - Delete report

Similar endpoints exist for:
- `/lab-reports` - Laboratory reports
- `/radiology-reports` - Radiology/imaging reports

### Prescriptions
- `POST /prescriptions` - Create prescription
- `GET /prescriptions` - List all prescriptions
- `GET /prescriptions/patient/:patientId` - Get patient's prescriptions
- `GET /prescriptions/patient/:patientId/active` - Get active prescriptions
- `PATCH /prescriptions/:id` - Update prescription
- `DELETE /prescriptions/:id` - Delete prescription

### Services
- `POST /services` - Create hospital service
- `GET /services` - List all services
- `GET /services/:id` - Get service details
- `POST /services/patient/:patientId/service/:serviceId` - Assign service to patient
- `GET /services/patient/:patientId/services` - Get patient's assigned services
- `PATCH /services/:id` - Update service
- `DELETE /services/:id` - Delete service

## Database Schema

The database includes the following main models:

- **Patient**: Core patient information with comprehensive personal details
- **Appointment**: Appointment scheduling and status tracking
- **Admission**: Hospital admission records with ward/room assignments
- **Payment**: Financial transactions with method tracking
- **MedicalHistory**: General medical history notes
- **DoctorReport**: Clinical assessments from physicians
- **LabReport**: Laboratory test results
- **RadiologyReport**: Medical imaging reports
- **Prescription**: Medication prescriptions with duration tracking
- **Service**: Hospital services with pricing
- **PatientService**: Junction table linking patients to services

## Available Scripts

```bash
# Development
pnpm run start:dev        # Start with watch mode
pnpm run start:debug      # Start with debugger

# Production
pnpm run build           # Build for production
pnpm run start:prod      # Start production server

# Quality
pnpm run lint            # Run ESLint
pnpm run lint --fix      # Fix linting issues
pnpm run format          # Format code with Prettier
pnpm run test            # Run unit tests
pnpm run test:watch      # Run tests in watch mode
pnpm run test:cov        # Generate coverage report
pnpm run test:e2e        # Run end-to-end tests

# Database
npx prisma migrate dev   # Create and apply migration
npx prisma studio       # Open Prisma Studio GUI
npx prisma generate     # Generate Prisma Client
```

## Validation Rules

All endpoints use class-validator for input validation:

- **Email**: Must be valid email format if provided
- **Phone**: Must be valid phone number format if provided
- **Dates**: ISO 8601 format (YYYY-MM-DD or full ISO datetime)
- **Numbers**: Must be positive for financial amounts
- **Required Fields**: Validated based on DTO specifications

## Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Future Enhancements

- [ ] Authentication and authorization (JWT-based)
- [ ] Role-based access control (RBAC)
- [ ] Advanced medical record querying
- [ ] File upload for medical reports and imaging
- [ ] Real-time notifications for appointments
- [ ] SMS/Email integration for reminders
- [ ] Analytics and reporting dashboard
- [ ] Medical audit trail logging
- [ ] Insurance verification integration
- [ ] Multi-location/branch support

## Development Notes

### Adding a New Module

1. Create module directory under `src/modules/`
2. Create service, controller, module files
3. Create DTO files in `dto/` subdirectory
4. Update Prisma schema if needed
5. Import new module in app.module.ts

### Database Migrations

```bash
# After modifying schema.prisma
npx prisma migrate dev --name describe_change

# Review generated migration
# Check prisma/migrations/ folder
```

## License

UNLICENSED

## Support

For issues or questions regarding the Hospital Management System backend, please contact the development team.
