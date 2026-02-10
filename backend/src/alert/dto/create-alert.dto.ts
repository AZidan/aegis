export interface CreateAlertDto {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  tenantId?: string;
  ruleId: string;
}
