import type { MeasurementPoint, MeasurementTrend } from "@/types/clinical-review";

export function measurementTrend(input: readonly MeasurementPoint[]): MeasurementTrend {
  if (input.length > 12) throw new Error("Trend input exceeds the bounded preview.");

  const points = input.filter((point): point is MeasurementPoint & { recordedAt: string; value: number } => (
    point.value !== null && Number.isFinite(point.value) && point.recordedAt !== null
    && Number.isFinite(Date.parse(point.recordedAt))
  )).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.sourceId.localeCompare(b.sourceId));

  if (!points.length) return { points, change: null, coordinates: null, omitted: input.length };

  const values = points.map(point => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const latestDifference = points.length > 1 ? points.at(-1)!.value - points.at(-2)!.value : null;
  const roundedChange = latestDifference !== null ? Math.round(latestDifference * 100) / 100 : null;
  const change = roundedChange !== null && Number.isFinite(roundedChange) ? roundedChange : null;

  // Horizontal spacing represents elapsed time, not the number of observations.
  const firstTime = Date.parse(points[0].recordedAt);
  const duration = Date.parse(points.at(-1)!.recordedAt) - firstTime;
  const coordinates = Number.isFinite(span) ? points.map(point => {
    const x = duration ? 12 + ((Date.parse(point.recordedAt) - firstTime) / duration) * 256 : 140;
    const y = maximum === minimum ? 52 : 76 - ((point.value - minimum) / span) * 48;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ") : null;

  return { points, change: Object.is(change, -0) ? 0 : change, coordinates, omitted: input.length - points.length };
}

export function isOverduePlan(plan: { status: string; due_date: string }, today: string) {
  return plan.status === "planned" && plan.due_date < today;
}
