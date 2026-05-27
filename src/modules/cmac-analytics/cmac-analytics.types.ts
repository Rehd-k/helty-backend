export type CmacSeverity = 'info' | 'warning' | 'critical';

export type KpiComparison = {
  current: number;
  previous: number;
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat';
  isPositive: boolean;
};

export type KpiMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  comparison: KpiComparison;
};

export type SeriesPoint = {
  label: string;
  value: number;
  start: string;
  end: string;
};

export type NamedCount = { name: string; count: number };

export type AlertItem = {
  severity: CmacSeverity;
  code: string;
  message: string;
  metric?: string;
};

export type InsightItem = {
  id: string;
  message: string;
  category: string;
  severity: CmacSeverity;
};

export type AuditFlagItem = {
  entityType: string;
  entityId: string;
  patientId: string;
  rule: string;
  severity: CmacSeverity;
};

export type CmacPeriodContext = {
  period: string;
  asOf: Date;
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
};
