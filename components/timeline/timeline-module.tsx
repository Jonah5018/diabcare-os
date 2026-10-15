import Pagination from "@/components/shared/pagination";
import TimelineList from "@/components/timeline/timeline-list";
import { encodeTimelineCursor } from "@/lib/timeline/cursor";
import { getPatientTimeline } from "@/lib/timeline/history";

export default async function TimelineModule({ patientId, cursor, query }: {
  patientId: string;
  cursor: string;
  query: Record<string, string>;
}) {
  const history = await getPatientTimeline(patientId, cursor).catch(() => null);
  const last = history?.rows.at(-1);

  return (
    <section id="timeline" className="scroll-mt-20 space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-6">
      <h3 className="text-lg font-semibold">Patient Clinical Timeline</h3>
      <p className="text-sm text-slate-500">
        Recorded events across visits, vitals, consultations, laboratory results, prescriptions and follow-ups.
        Times are shown in Lagos time. Undated legacy entries appear after dated events.
        Clinical previews and current statuses reflect the saved records.
      </p>
      {history ? (
        <>
          <TimelineList rows={history.rows} patientId={patientId} />
          <Pagination
            path={`/dashboard/patients/${patientId}`}
            query={query}
            parameter="timelineCursor"
            hasMore={history.hasMore}
            cursor={last ? encodeTimelineCursor({
              time: last.occurred_at,
              kind: last.event_kind,
              id: last.source_id,
            }) : undefined}
          />
        </>
      ) : (
        <p role="alert" className="text-sm text-rose-700">
          Unable to load this timeline page. Refresh or open the patient folder without its timeline cursor to try again.
        </p>
      )}
    </section>
  );
}
