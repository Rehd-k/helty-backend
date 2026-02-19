# Hospital Management System - Setup & Implementation Guide

## Overview

This complete backend system implements a comprehensive hospital management solution focused on the medical records department. It includes patient management, appointment scheduling, admission tracking, lab/radiology reports, prescriptions, payments, and service billing.

## Prerequisites

Before starting, ensure you have:

- **Node.js** 22.x or higher
- **PostgreSQL** 12 or higher
- **pnpm** 10.x or npm/yarn equivalents
- **Git** (optional, for version control)

## Installation Steps

### 1. **Setup Database**

First, install and start PostgreSQL, then create a database:

```bash
# Using PostgreSQL command line
createdb hospital_db

# Or using psql interactive shell
psql -U postgres
# Then in psql shell:
# CREATE DATABASE hospital_db;
```

### 2. **Clone/Navigate to Project**

```bash
cd hospital/backend
```

### 3. **Install Dependencies**

```bash
pnpm install
```

### 4. **Configure Environment**

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Important: Update DATABASE_URL with your PostgreSQL credentials
```

Example `.env` file:

```env
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/hospital_db"
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

### 5. **Initialize Database**

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
npx prisma generate

# Create and run initial migration
npx prisma migrate dev --name initial
```

### 6. **Start the Application**

```bash
# Development mode with auto-reload
pnpm run start:dev

# Or production mode
pnpm run build
pnpm run start:prod
```

The application will start on `http://localhost:3000`

## Quick Start After Setup

```bash
# Start development server
pnpm run start:dev

# In another terminal, view API documentation
# Open http://localhost:3000/api in your browser
```

## Project Structure

```
src/
├── modules/
│   ├── patient/                    # Core patient management
│   │   ├── dto/
│   │   │   └── create-patient.dto.ts   # Patient validation & types
│   │   ├── patient.controller.ts       # HTTP endpoints
│   │   ├── patient.service.ts          # Business logic
│   │   └── patient.module.ts           # Module definition
│   ├── appointment/                # Appointment scheduling
│   ├── admission/                  # Hospital admissions
│   ├── payment/                    # Financial tracking
│   ├── medical-history/            # Medical history records
│   ├── doctor-report/              # Clinical assessments
│   ├── lab-report/                 # Lab test results
│   ├── radiology-report/           # Imaging reports
│   ├── prescription/               # Medication prescriptions
│   └── service/                    # Hospital services & billing
├── prisma/
│   └── schema.prisma               # Database schema definition
└── main.ts                         # Application entry point
```

## Core Concepts

### Patient Management
- **Comprehensive Registration**: Captures all necessary patient information
- **Unique Patient ID**: Generated automatically using nanoid format `PAT-XXXXXXXX`
- **Search Functionality**: Query by name, patient ID, email, or phone
- **Complete History**: Access all patient records in one view

### Medical Records
The system tracks:
- **Appointments**: Scheduled, completed, cancelled, rescheduled, no-show statuses
- **Admissions**: Ward/room assignments with admission/discharge dates
- **Doctor Reports**: Clinical notes and assessments
- **Lab Reports**: Test results from laboratory
- **Radiology Reports**: Medical imaging results (X-ray, CT, MRI, etc.)
- **Prescriptions**: Medication history with dosage, duration, and renewal status
- **Medical History**: General health notes and observations

### Financial Tracking
- **Payment Recording**: Multiple methods (cash, card, bank transfer, insurance, cheque)
- **Patient Billing**: Link services to patients for billing
- **Payment History**: Complete audit trail of all transactions
- **Service Costs**: Hospital services with pricing information

### Front Desk Operations
- **Appointment Checking**: View scheduled and upcoming appointments
- **Patient History Lookup**: Access complete patient information
- **Service Assignment**: Route patients to required services (labs, radiology, billing)
- **Quick Search**: Fast patient lookup by multiple criteria

## API Endpoints Reference

### Authentication Endpoints
```
POST   /auth/login              # User login (future implementation)
POST   /auth/logout             # User logout (future implementation)
```

### Patient Endpoints
```
POST   /patients                           # Create new patient
GET    /patients                           # List all patients (paginated)
GET    /patients/search?q=query            # Search patients
GET    /patients/history/:id               # Complete patient history
GET    /patients/:id                       # Get patient details
PATCH  /patients/:id                       # Update patient
DELETE /patients/:id                       # Delete patient
```

### Appointment Management
```
POST   /appointments                       # Schedule appointment
GET    /appointments                       # List appointments
GET    /appointments/upcoming              # Get upcoming appointments
GET    /appointments/patient/:patientId    # Patient's appointments
PATCH  /appointments/:id                   # Update appointment
DELETE /appointments/:id                   # Cancel appointment
```

### Admission Tracking
```
POST   /admissions                         # Record admission
GET    /admissions                         # List admissions
GET    /admissions/active                  # Active admissions
GET    /admissions/patient/:patientId      # Patient admissions
PATCH  /admissions/:id                     # Update (e.g., discharge)
DELETE /admissions/:id                     # Delete record
```

### Medical Reports
```
POST   /doctor-reports                     # Create doctor report
POST   /lab-reports                        # Create lab report
POST   /radiology-reports                  # Create radiology report
GET    /doctor-reports/patient/:patientId  # Patient's reports
GET    /lab-reports/patient/:patientId
GET    /radiology-reports/patient/:patientId
PATCH  /{module}/:id                       # Update report
DELETE /{module}/:id                       # Delete report
```

### Prescriptions
```
POST   /prescriptions                      # Create prescription
GET    /prescriptions/patient/:patientId   # Patient's prescriptions
GET    /prescriptions/patient/:patientId/active  # Active only
PATCH  /prescriptions/:id                  # Update prescription
DELETE /prescriptions/:id                  # Remove prescription
```

### Payment Management
```
POST   /payments                           # Record payment
GET    /payments                           # List payments
GET    /payments/patient/:patientId        # Patient's payments
GET    /payments/patient/:patientId/total  # Payment summary
PATCH  /payments/:id                       # Update payment
DELETE /payments/:id                       # Delete record
```

### Services & Billing
```
POST   /services                           # Create service
GET    /services                           # List services
POST   /services/patient/:patientId/service/:serviceId  # Assign to patient
GET    /services/patient/:patientId/services             # Patient's services
DELETE /services/patient-service/:id                     # Remove service
```

### Medical History
```
POST   /medical-histories                  # Add history entry
GET    /medical-histories/patient/:patientId  # Patient history
PATCH  /medical-histories/:id              # Update entry
DELETE /medical-histories/:id              # Delete entry
```

## Available Commands

```bash
# Development
pnpm run start:dev        # Development with hot reload
pnpm run start:debug      # With debugger attached
pnpm run start:prod       # Production mode

# Building
pnpm run build            # Build for production
pnpm run lint             # Run ESLint
pnpm run lint --fix       # Auto-fix linting issues
pnpm run format           # Format code with Prettier

# Testing
pnpm run test                    # Run unit tests
pnpm run test:watch              # Tests in watch mode
pnpm run test:cov                # With coverage report
pnpm run test:e2e                # End-to-end tests

# Database
npx prisma migrate dev           # Create and apply migration
npx prisma studio               # Open Prisma Studio GUI
npx prisma generate             # Generate Prisma client
npx prisma db push              # Sync schema to DB
```

## Database Schema

### Key Models

**Patient**: Core patient information
- Personal: title, name, DOB, gender, nationality
- Contact: email, phone, address
- Medical: next of kin, HMO, fingerprint
- System: patientId, created/updated timestamps

**Appointment**: Scheduling
- Status: scheduled, completed, cancelled, no-show, rescheduled
- Timestamps: date of appointment, creation date
- Notes: additional information

**Admission**: Hospital stays
- Dates: admission, discharge
- Location: ward, room number
- Reason: admission reason

**Payment**: Financial records
- Amount, method (cash/card/transfer/insurance/cheque)
- Description, date
- Links to patient

**Reports**: Medical documentation
- DoctorReport: Clinical assessments
- LabReport: Test results
- RadiologyReport: Imaging results
- All include patient reference and timestamps

**Prescription**: Medications
- Drug name, dosage
- Start/end dates
- Notes and instructions

**Service**: Hospital services
- Name, description, price
- Links to patient services for billing

## Development Workflow

### Adding a New Feature

1. **Update Schema**
```bash
# Edit prisma/schema.prisma
# Add or modify model
```

2. **Create Migration**
```bash
npx prisma migrate dev --name describe_change
```

3. **Create Module**
```bash
# Create directory: src/modules/feature-name/
# Create controller.ts, service.ts, module.ts, dto/
```

4. **Update App Module**
```typescript
// Import new module in src/app.module.ts
```

5. **Build & Test**
```bash
pnpm run build
pnpm run start:dev
```

### Code Standards

- Use TypeScript strict mode
- Validate all inputs with class-validator
- Include Swagger decorators for API docs
- Use DTO classes for request/response
- Follow NestJS conventions

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### Prisma Client Not Generated
```
Error: Cannot find module '@prisma/client'
```
**Solution**: Run `npx prisma generate`

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change PORT in .env or kill the process using port 3000

### Permission Denied Errors
```
Error: Migration lock acquired
```
**Solution**: Database may have stale lock. Run:
```bash
npx prisma migrate resolve --rolled-back initial
```

## Performance Optimization

1. **Pagination**: Always use skip/take for list endpoints
2. **Indexing**: Prisma/PostgreSQL handles common indexes
3. **Query Optimization**: Use `include` selectively
4. **Caching**: Consider Redis for frequently accessed data (future)

## Security Considerations

- ✅ Input validation on all endpoints
- ✅ CORS configured
- ✅ Environment variables for secrets
- ⚠️ Add authentication/authorization (planned)
- ⚠️ Add rate limiting (planned)
- ⚠️ Add audit logging (planned)

## Deployment

### Build for Production
```bash
pnpm install --prod
pnpm run build
```

### Environment for Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/hospital_db
JWT_SECRET=use-strong-random-secret
PORT=3000
```

### Start Server
```bash
pnpm run start:prod
```

## Support Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## Next Steps

1. ✅ Basic CRUD operations for all modules
2. 📋 Add authentication system (JWT)
3. 📋 Implement role-based access control
4. 📋 Add file uploads for medical documents
5. 📋 Implement real-time notifications
6. 📋 Add SMS/Email integration
7. 📋 Create analytics dashboard
8. 📋 Add medical audit logging

## License

UNLICENSED - Commercial Use

---

**For questions or issues, refer to the API documentation at `/api` endpoint when server is running.**
