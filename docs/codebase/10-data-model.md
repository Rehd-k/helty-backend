# Data model

Source of truth: `prisma/schema.prisma`. This page names every model and the enum that drives its lifecycle, and says which module writes it. Field-level detail belongs in the schema next to the model. When the schema and a service disagree, trust the service for behaviour and the schema for what can be stored.

Prisma client is generated into `node_modules/.prisma/client` and imported as `@prisma/client`. `PrismaService` is the only injectable client. Scripts under `prisma/backup-restore` and `prisma/seed.ts` construct their own `PrismaClient` with the same Postgres adapter.

## Identity

| Model | Purpose | Written by |
|---|---|---|
| `Patient` | Chart. Status `ADMITED`, `DECEASED`, `OUTPATIENT` | `patient`, and status updates from `admission` |
| `PatientDevice` | App install. `PENDING` or `APPROVED` | `patient-auth`, `frontdesk` |
| `PatientFamilyLink` | Parent to child | `frontdesk` |
| `PatientCycleSettings`, `PatientCyclePeriod` | Cycle tracker. Flow `LIGHT`, `MEDIUM`, `HEAVY` | `patient-cycle` |
| `Staff` | Hospital user. `AccountType` + `StaffRole` | `staff` |
| `StaffPasswordReset` | 6-digit reset code | `auth` |
| `Department` | Org unit, optional head | `department` |
| `Icd10Code` | Diagnosis catalog. Read only at runtime | `seed-icd10` |

`Patient.createdById` is required. Every registration stores the staff member who created the row. The patient app’s appointment writes use `PATIENT_PORTAL_SYSTEM_STAFF_ID` for the same reason.

## Access and scheduling

| Model | Purpose |
|---|---|
| `Appointment` | Booking. `status` is a string. Visit type is `AppointmentVisitType` |
| `AppointmentNotification` | Push, email, and SMS attempts. Channel, kind, and status enums |
| `ConsultingRoom` | Room and assigned doctor |
| `WaitingPatient` | Legacy queue. Live queue does not write this |
| `Ward`, `Bed` | `WardType`, `BedStatus` |
| `Admission` | Stay. `AdmissionType`, `AdmissionStatus` |
| `AdmissionWardHistory` | Ward and bed moves |
| `DepartmentShiftRoster` | Non-nursing, non-janitor shifts. `ShiftType` |

## The visit

| Model | Purpose |
|---|---|
| `Encounter` | The note. `EncounterType`, `EncounterStatus`. `admissionId` is unique |
| `EncounterEditHistory` | Snapshot before a post-completion edit |
| `EncounterTemplate` | Private doctor prefill. Unique on doctor + name |
| `EncounterDiagnosis` | Code strings on an encounter |
| `EncounterSpecialtyModule` | Enabled specialties. Unique on encounter + specialty |
| `EncounterClinicalSection` | JSON section. Unique on encounter + specialty + section key |
| `PatientVitals` | One parent among waiting patient, admission, invoice, encounter |
| `PatientAllergy`, `PatientImmunization` | Staff clinical records |
| `MedicalHistory` | Free-text past history |
| `DoctorReport` | Narrative report, optional encounter |
| `WardRoundNote` | Inpatient SOAP |
| `PatientArchivedEncounter`, `PatientArchivedEncounterDocument` | Scanned historical visits |

`MedicalSpecialty` is the enum for both `Staff.medicalSpecialty` and encounter specialty modules.

## Billing

| Model | Purpose |
|---|---|
| `ServiceCategory`, `Service` | Catalog. Code column is `searviceCode` |
| `ClinicalServicePackage`, `ClinicalServicePackageItem` | Bundles, including the default antenatal package |
| `Hmo`, `HmoServicePrice` | Insurer and tariff |
| `DiscountPolicy` | Staff-owned percent or fixed policy |
| `Invoice` | The bill. `InvoiceStatus` |
| `InvoiceItem` | One charge. Optional links to service, drug, consumable, purchase item, package item |
| `InvoiceItemUsageSegment` | Days a recurring line was active |
| `InvoiceItemPayment` | How a payment was split onto lines |
| `InvoicePayment` | Cash, wallet, card, transfer, insurance, waiver |
| `InvoiceRefund` | Cash reversed by an approved line refund |
| `InvoiceItemRefundRequest` | `pending`, `approved`, `rejected`, `cancelled` |
| `InvoiceCoverage` | HMO or discount. `APPLIED`, `REVERSED`, `SETTLED` |
| `CoverageRemittance`, `CoverageRemittanceLine` | Third party paid the hospital |
| `PatientWallet`, `WalletTransaction` | `CREDIT` or `DEBIT` |
| `InvoiceAuditLog` | Billing audit |
| `InvoiceDrugReturn`, `InvoicePurchaseItemReturn` | Stock put back from an unpaid line |
| `InsuranceClaim` | Tracking row. Does not pay the invoice |
| `Bank` | Account numbers referenced by payments |
| `Payment` | Legacy payments. Writes are disabled |

Finance back office, not patient cash:

| Model | Purpose |
|---|---|
| `ChartOfAccount` | `asset`, `liability`, `equity`, `revenue`, `expense` |
| `JournalEntry` | One debit and one credit |
| `FiscalPeriod` | `open` or `closed` |
| `FinanceApproval` | Refund, write-off, journal, other |
| `DailyCashReconciliation`, `BankReconciliation` | `open`, `submitted`, `closed` |
| `FinanceComplianceItem` | Checklist the accounts audit screen acknowledges |
| `ExpenseBudget` | Budget lines for variance reports |

## Laboratory

| Model | Purpose |
|---|---|
| `LabCategory`, `LabTest`, `LabTestVersion`, `LabTestField` | Catalog. Orders pin a version |
| `LabRequest` | Clinician request. `REQUESTED`, `COLLECTED`, `COMPLETED`, `CANCELLED` |
| `LabOrder`, `LabOrderItem` | Bench order. Status enum includes unused `PROCESSING` |
| `LabSample` | One per order line |
| `LabResult` | One field value. `LabAbnormalFlag` is `LOW` or `HIGH` |
| `LabAntibiotic`, `LabAstResultOption`, `LabAstResult` | Culture and sensitivity |
| `LabReport` | Free-text document, not a `LabResult` |
| `LegacyLabCatalog`, `LegacyLabOrder` | Previous catalog, still in the schema |

## Radiology

| Model | Purpose |
|---|---|
| `RadiologyMachine` | Modality equipment. API is read-only |
| `RadiologyOrder`, `RadiologyOrderItem` | Request and items. Priority and modality enums |
| `RadiologySchedule`, `RadiologyProcedure` | Booking and performing the study |
| `RadiologyImage` | File on disk |
| `RadiologyStudyReport` | Signed report. `ReportSeverity` |
| `RadiologyReport` | Free-text document, separate from the study report |

Item status: `PENDING`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `REPORTED`, `CANCELLED`. Order status is computed from items.

## Pharmacy and medication

| Model | Purpose |
|---|---|
| `Drug`, `DrugPrice`, `DrugInteraction` | Catalog, ward price, interactions |
| `Manufacturer`, `Supplier` | Pharmacy master data |
| `PharmacyLocation` | `STORE` or `DISPENSARY` |
| `DrugBatch` | Stock at a location |
| `PurchaseOrder`, `PurchaseOrderItem` | Drug PO. `DRAFT`, `APPROVED`, `RECEIVED`, `CANCELLED` |
| `GoodsReceipt`, `GoodsReceiptItem` | Receipt creates batches |
| `StockTransfer`, `StockTransferItem` | `PENDING`, `APPROVED`, `COMPLETED` |
| `InventoryMovement` | Every quantity change, including `DISPENSE` |
| `DispenseBatchAllocation` | Which batches filled one invoice line |
| `Dispensation`, `DispensationItem`, `ControlledApproval` | Present in the schema. Live dispense does not create them |
| `MedicationOrder` | Clinical order. Status is a string |
| `MedicationOrderSchedule` | Inpatient dose clock. Status is computed |
| `MedicationRequest` | `REQUESTED`, `BILLED`, `DISPENSED`, `CANCELLED` |
| `MedicationAdministration` | MAR row. `GIVEN`, `MISSED`, `REFUSED`, `DELAYED` |
| `Prescription`, `PrescriptionItem` | Chart copy, including what was dispensed |
| `PatientMedicationDoseLog`, `PatientMedicationStreak` | Patient-app adherence |
| `PrescriptionRefillRequest` | `PENDING`, `APPROVED`, `REJECTED`, `FULFILLED` |
| `DrugCatalog` | Legacy catalog |

## Store and purchases

| Model | Purpose |
|---|---|
| `Consumable`, `ConsumableBatch`, `ConsumableMovement` | Clinical consumables |
| `ConsumableStockAllocation`, `ConsumableUsageEvent` | FIFO allocations and non-billable use |
| `StoreItemCategory`, `StoreItem`, `StoreLocation`, `StoreStock`, `StoreStockMovement` | General supplies |
| `PurchaseItem`, `PurchaseItemBatch` | Non-drug catalog |
| `PurchasesManufacturer`, `PurchasesSupplier`, `PurchasesLocation` | Purchases master data |
| `PurchasesPurchaseOrder`, `PurchasesPurchaseOrderLine` | Non-drug PO |
| `PurchasesGoodsReceipt`, `PurchasesGoodsReceiptItem` | Receipt |
| `PurchasesStockTransfer`, `PurchasesStockTransferLine` | Transfer |
| `PurchasesInventoryMovement`, `PurchaseItemStockAllocation` | Quantity ledger |
| `Requisition`, `RequisitionLine` | Internal request that can become a draft PO |

Pharmacy `PurchaseOrder` and purchases `PurchasesPurchaseOrder` are different tables.

## Inpatient chart

All of these hang off `Admission` except the roster.

| Model | Purpose |
|---|---|
| `NurseShiftRoster` | Unit roster |
| `NurseAssignment` | Nurse on an admission for a shift |
| `OutpatientNurseAssignment` | Nurse on a queue invoice. One per invoice |
| `IVFluidOrder`, `IVMonitoring` | Infusions |
| `IntakeOutputRecord` | Fluid balance |
| `NursingNote` | Narrative |
| `ProcedureRecord` | Bedside procedure |
| `WoundAssessment` | Wound plus optional photo |
| `CarePlan` | Plan of care |
| `MonitoringChart` | GCS, neuro, cardiac, seizure JSON |
| `HandoverReport` | Shift handover |
| `AlertLog` | Open and resolved alerts |
| `AuditTrail` | Chart audit |

## Maternity, theatre, dialysis

| Model | Purpose |
|---|---|
| `Pregnancy` | `ONGOING`, `DELIVERED`, `LOST`, `TERMINATED` |
| `AntenatalVisit` | Clinic visit in pregnancy |
| `LabourDelivery` | Delivery. Optional admission |
| `PartogramEntry` | Labour observations |
| `Baby` | Newborn. Optional link to a registered `Patient` |
| `PostnatalVisit` | `MOTHER` or `BABY` |
| `GynaeProcedure` | Gynaecology procedure |
| `TheatreRoom` | Operating room |
| `SurgeryRequest` | `REQUESTED` through `BILLED` or `CANCELLED` |
| `TheatreSchedule` | Room and time |
| `TheatreCase` | Intra-op record |
| `TheatreOperativeNote` | Operative note |
| `TheatreCaseConsumable` | Items used, later billed |
| `TheatreCaseStaff` | Surgeon, assistant, scrub, circulating, anaesthetist |
| `DialysisSession`, `DialysisSessionConsumable` | Session and items used |

## Patient app content and safety

| Model | Purpose |
|---|---|
| `HealthCampaign`, `HealthNewsArticle` | Published health content |
| `SystemAnnouncement` | Banner, including the public active list |
| `CustomPushNotification` | Staff broadcast record |
| `PatientFeedback` | App complaint or suggestion |
| `EmergencyRequest` | Patient or guest emergency. Status from `SUBMITTED` to `CLOSED` |
| `Referral` | Quality register, in or out |
| `PatientComplaint` | Quality register |
| `SafetyIncident` | Quality register |
| `InfectionCase` | Quality register, linked to an admission |

## Chat, command, assets, releases

| Model | Purpose |
|---|---|
| `ChatMessage` | Older chat row kept beside the conversation tables |
| `StaffConversation`, `StaffConversationMember`, `StaffConversationMessage`, `StaffConversationMessageRead` | Current staff chat |
| `SupportTicket`, `SupportTicketAssignment`, `SupportTicketMessage`, `SupportTicketAuditLog` | Internal tickets |
| `CmdCommunication`, `CmdReportTemplate`, `CmdIntegrationStatus`, `CmdComplianceItem` | CMD screens |
| `HospitalAsset`, `HospitalAssetLog`, `HospitalAssetAccessGrant` | Department equipment |
| `HousekeepingWorker`, `HousekeepingArea`, `HousekeepingAssignment`, `HousekeepingShiftRoster`, `HousekeepingSupplyLog` | Janitorial |
| `HeltyDesktopRelease`, `HeltyDesktopExternalExecutable` | Windows installer metadata |
| `ImshAndroidRelease` | Android release metadata |
| `AuditLog` | General audit rows |

## Relationships worth remembering

- `Patient` 1—n `Invoice`. At most one of those is open (`PENDING` or `PARTIALLY_PAID`) by service rule, not by a database unique index.
- `Invoice` 1—n `InvoiceItem`. A consultation, lab, radiology, drug, consumable, or purchase charge is an item.
- `Encounter` 0—1 `Admission` (`admissionId` unique). Admitting completes the encounter.
- `LabRequest.invoiceItemId` is unique. `LabOrder.invoiceItemId` is unique. One billed line, one request, one bench order.
- `MedicationOrder.invoiceItemId` is unique. `MedicationRequest.invoiceItemId` is unique. Dispense settles the item and then updates both statuses.
- `InvoiceCoverage` points at an `Hmo` or at a `DiscountPolicy` and its owner `Staff`. Remittance lines point at coverages.
- `Baby` can point at `Patient` twice: the mother, and the child once `register-patient` has run.

## Enums that are not a workflow

Some enums document allowed values. Some are only half-used. The unused values are still valid in the database if something writes them by hand:

- `LabOrderStatus.PROCESSING` — nothing sets it.
- `AdmissionStatus.TRANSFERRED` — the admission service never sets it.
- `PurchasesStockTransferStatus.IN_TRANSIT` and `REJECTED` — the transfer endpoints do not set them.
- `PrescriptionRefillRequestStatus.CANCELLED` — refill review does not set it.
- `RequisitionStatus.CANCELLED` — requisition endpoints do not set it.

`Appointment.status`, `MedicationOrder.status`, and `InsuranceClaim.status` are strings. The schema does not constrain them.
