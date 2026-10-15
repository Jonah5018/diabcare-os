import PrescriptionHistory from "@/components/prescriptions/prescription-history";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { encodeCursor } from "@/lib/pagination";
import { getPrescriptionHistory } from "@/lib/prescriptions/history";

export default async function PrescriptionModule({ patientId, cursor, query }: {
  patientId: string;
  cursor: string;
  query: Record<string, string>;
}) {
  const { profile, user } = await getClinicContext();
  const history = await getPrescriptionHistory(patientId, cursor).catch(() => null);

  return (
    <section id="prescriptions" className="scroll-mt-20 space-y-4 rounded-2xl border bg-slate-50 p-6">
      <h3 className="text-lg font-semibold">Prescription History</h3>
      <p className="text-sm text-slate-500">Create prescriptions from a saved consultation in Consultation History.</p>
      {history ? (
        <>
          <PrescriptionHistory
            rows={history.rows}
            userId={user.id}
            canUpdate={can(profile.role, "prescriptions:update")}
            administrator={profile.role === "organization_admin" || profile.role === "platform_owner"}
          />
          <Pagination
            path={`/dashboard/patients/${patientId}`}
            query={query}
            parameter="prescriptionCursor"
            hasMore={history.hasMore}
            cursor={history.rows.length ? encodeCursor(history.rows[history.rows.length - 1]) : undefined}
          />
        </>
      ) : (
        <p role="alert" className="text-sm text-rose-700">Unable to load prescriptions. Refresh the patient folder to try again.</p>
      )}
    </section>
  );
}
