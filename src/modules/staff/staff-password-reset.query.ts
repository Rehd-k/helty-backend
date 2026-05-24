/** Unused, unexpired staff password reset (evaluate per query so expiry is current). */
export function activeStaffPasswordResetWhere() {
  return {
    usedAt: null,
    expiresAt: { gt: new Date() },
  } as const;
}

export function activeStaffPasswordResetInclude() {
  return {
    where: activeStaffPasswordResetWhere(),
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      code: true,
      expiresAt: true,
      createdAt: true,
    },
  };
}

export function normalizePasswordResetCode(code: string): string {
  return code.trim();
}

export function normalizePasswordResetEmail(email: string): string {
  return email.trim();
}
