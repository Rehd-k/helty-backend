import { AsyncLocalStorage } from 'async_hooks';

export type StaffAuditStore = {
  /** Staff.id (JWT sub). Absent for patient tokens and anonymous requests. */
  staffId?: string;
  staffCode?: string;
  staffRole?: string;
  accountType?: string;
  departmentName?: string;
  method?: string;
  route?: string;
  ip?: string;
};

export const staffAuditAls = new AsyncLocalStorage<StaffAuditStore>();

type HeaderValue = string | string[] | undefined;

export type StaffAuditRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, HeaderValue>;
  user?: {
    sub?: unknown;
    staffId?: unknown;
    staffRole?: unknown;
    accountType?: unknown;
    department?: unknown;
  };
};

export function requestIp(
  req: StaffAuditRequest | undefined,
): string | undefined {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0].trim().slice(0, 64);
  }
  if (typeof req?.ip === 'string' && req.ip.trim()) {
    return req.ip.trim().slice(0, 64);
  }
  return undefined;
}

export function storeFromRequest(
  req: StaffAuditRequest | undefined,
): StaffAuditStore {
  const user = req?.user;
  const isStaff =
    typeof user?.sub === 'string' &&
    user.sub.length > 0 &&
    typeof user.staffId === 'string' &&
    user.accountType !== 'PATIENT';
  const route = (req?.originalUrl || req?.url || '').toString().slice(0, 300);
  return {
    staffId: isStaff ? (user.sub as string) : undefined,
    staffCode: typeof user?.staffId === 'string' ? user.staffId : undefined,
    staffRole: typeof user?.staffRole === 'string' ? user.staffRole : undefined,
    accountType:
      typeof user?.accountType === 'string' ? user.accountType : undefined,
    departmentName:
      typeof user?.department === 'string' ? user.department : undefined,
    method:
      typeof req?.method === 'string' ? req.method.slice(0, 16) : undefined,
    route: route || undefined,
    ip: requestIp(req),
  };
}
