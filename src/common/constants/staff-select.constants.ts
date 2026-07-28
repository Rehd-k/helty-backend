/** Brief staff fields for createdBy / updatedBy on GET responses. */
export const staffBriefSelect = {
  id: true,
  firstName: true,
  lastName: true,
} as const;

/** Standard include for createdBy + updatedBy on auditable records. */
export const staffBriefInclude = {
  createdBy: { select: staffBriefSelect },
  updatedBy: { select: staffBriefSelect },
} as const;
