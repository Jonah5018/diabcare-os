import { measurementTrend } from "@/lib/clinical-review/trends";
import type { MeasurementPoint } from "@/types/clinical-review";

export default function TrendCard({ title, unit, changeUnit = unit, points }: {
  title: string;
  unit: string;
  changeUnit?: string;
  points: MeasurementPoint[];
}) {
  const trend = measurementTrend(points);
  const latest = trend.points.at(-1);

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded measurements</p>
      <h3 className="mt-2 font-semibold text-slate-900">{title}</h3>
      {latest ? (
        <>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
            {latest.value} <span className="text-sm font-normal text-slate-500">{unit}</span>
          </p>
          <div className="mt-2 text-xs leading-6 text-slate-500">
            <span className="font-medium text-slate-700">Calculated change: </span>
            {trend.change === null ? "Two dated values needed" : `${trend.change > 0 ? "+" : ""}${trend.change} ${changeUnit}`}
            <p>Between the two latest displayed measurements.</p>
          </div>
          {trend.coordinates ? (
            <svg viewBox="0 0 280 100" className="mt-4 h-28 w-full" aria-hidden="true" focusable="false">
              <path d="M12 28H268 M12 52H268 M12 76H268" stroke="#e2e8f0" strokeDasharray="3 5" />
              <polyline points={trend.coordinates} fill="none" stroke="#0e7490" strokeWidth="2" strokeLinejoin="round" />
              {trend.coordinates.split(" ").map((coordinate, index) => {
                const [cx, cy] = coordinate.split(",");
                return (
                  <circle
                    key={trend.points[index].sourceId}
                    cx={cx}
                    cy={cy}
                    r="3"
                    fill="#0e7490"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          ) : <p className="mt-4 text-xs text-slate-500">Chart unavailable for these values. Review the source table.</p>}
          <p className="text-[10px] leading-5 text-slate-500">Autoscaled. Time spacing reflects recorded dates; no target range or clinical interpretation.</p>
          <details className="mt-4 border-t border-slate-100 pt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-sky-800">View {trend.points.length} dated source values</summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{title}: recorded dates, values and source record IDs</caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-3">Recorded date (Lagos)</th>
                    <th scope="col" className="py-2 pr-3">Value</th>
                    <th scope="col" className="py-2">Source ID</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.points.map(point => (
                    <tr key={point.sourceId}>
                      <td className="py-2 pr-3">
                        <time dateTime={point.recordedAt}>
                          {new Date(point.recordedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
                        </time>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{point.value} {unit}</td>
                      <td className="py-2">
                        <code className="break-all text-[10px]">{point.sourceId}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : <p className="mt-4 text-sm leading-7 text-slate-500">No dated {title.toLowerCase()} values recorded in this preview.</p>}
      {trend.omitted > 0 ? <p className="mt-3 text-xs leading-6 text-slate-500">{trend.omitted} entries omitted from the chart because the value or date is not recorded.</p> : null}
    </article>
  );
}
