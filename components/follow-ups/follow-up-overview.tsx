import Link from "next/link";
import { getClinicFollowUps } from "@/lib/follow-ups/history";
import { formatAppointmentDate } from "@/lib/clinic-date";

export default async function FollowUpOverview() {
  const results = await Promise.all([
    getClinicFollowUps("upcoming", "", 5).catch(() => null),
    getClinicFollowUps("overdue", "", 5).catch(() => null),
  ]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Follow-ups and Recalls</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(["upcoming", "overdue"] as const).map((window, index) => {
          const history = results[index];
          return (
            <article key={window} className="space-y-3 rounded-2xl border bg-white p-5">
              <h3 className="font-semibold">{window === "upcoming" ? "Upcoming follow-ups" : "Overdue recall review"}</h3>
              {history ? (
                history.rows.length ? <ul className="space-y-3 text-sm">
                  {history.rows.map(row => <li key={row.id}>
                    <Link href={`/dashboard/patients/${row.patient_id}#follow-ups`} className="text-sky-700 underline">
                      {row.patient ? `${row.patient.last_name} ${row.patient.first_name}` : "Review patient"}
                    </Link>
                    <p className="text-slate-500">Due {formatAppointmentDate(row.due_date)}</p>
                  </li>)}
                </ul> : <p className="text-sm text-slate-500">No plans in this list.</p>
              ) : <p role="alert" className="text-sm text-rose-700">Unable to load this follow-up list.</p>}
              <Link href={`/dashboard/follow-ups?window=${window}`} className="inline-block text-sm text-sky-700 underline">Review plans</Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
