import { metricLabels, type OperationalReport } from "@/lib/reports/metrics";

export default function OperationalSummary({ report }: { report: OperationalReport }) {
  const metricKeys = Object.keys(metricLabels) as (keyof OperationalReport)[];
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Operational activity and recording coverage</h2>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricKeys.map(key => (
          <div key={key} className="rounded-2xl border bg-white p-5">
            <dt className="text-sm text-slate-500">{metricLabels[key]}</dt>
            <dd className="mt-3 text-2xl font-semibold">{report[key].toLocaleString("en-GB")}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 rounded-2xl border bg-white p-5 text-sm text-slate-600">
        <p>Bookings and current appointment statuses use scheduled dates. Check-ins use their recorded timestamps, including visits later cancelled. Consultation time uses visit date, falling back to creation time.</p>
        <p>Registrations, vitals and laboratories use creation timestamps. Prescriptions use prescribed dates; follow-up load uses due dates and current saved status. Unknown legacy timestamps are excluded.</p>
        <p>Coverage counts distinct patients with non-cancelled bookings who have a vitals/lab record in the same period. Multiple records do not increase patient coverage. Unlinked legacy records can count at patient level.</p>
        <p>These figures describe operations and saved records. They do not assess clinical adequacy, treatment effectiveness or medical risk. No no-show status is implemented.</p>
      </div>
    </section>
  );
}
