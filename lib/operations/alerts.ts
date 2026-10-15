export interface OperationsMetrics {
  failed_notifications: number;
  expired_leases: number;
  due_notifications: number;
  oldest_due_seconds: number;
  billing_reconciliation: number;
  expired_billing_periods: number;
}

export function operationalAlerts(metrics: OperationsMetrics) {
  const alerts: string[] = [];
  if (metrics.failed_notifications > 0) alerts.push("Notification jobs exhausted retries. Review delivery attempts before authorizing replay.");
  if (metrics.expired_leases > 0) alerts.push("Worker leases expired. Check scheduler and backend connectivity; lease recovery is automatic on the next eligible claim.");
  if (metrics.due_notifications > 0 && metrics.oldest_due_seconds > 900) alerts.push("Eligible notifications are over 15 minutes late. Check the worker schedule or process the clinic batch.");
  if (metrics.billing_reconciliation > 0) alerts.push("Billing events need reconciliation. Verify account bindings and canonical provider state before replaying events.");
  if (metrics.expired_billing_periods > 0) alerts.push("Active billing records have unknown or expired periods. Obtain current signed provider state; optional entitlements remain unavailable.");
  return alerts;
}
