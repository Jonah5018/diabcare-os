import { auditEntities, auditOperations, type AuditFilters } from "@/lib/audit/filters";

export default function AuditFilterForm({ filters }: { filters: AuditFilters }) {
  const inputClass = "w-full rounded-lg border bg-white p-2";
  return (
    <form className="grid gap-4 rounded-2xl border bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm">From (Lagos date)
        <input name="from" type="date" defaultValue={filters.from} required className={inputClass} />
      </label>
      <label className="space-y-1 text-sm">To (up to 31 days)
        <input name="to" type="date" defaultValue={filters.to} required className={inputClass} />
      </label>
      <label className="space-y-1 text-sm">Actor ID
        <input name="actor" defaultValue={filters.actor} maxLength={36} placeholder="Any actor" className={inputClass} />
      </label>
      <label className="space-y-1 text-sm">Entity
        <select name="entity" defaultValue={filters.entity} className={inputClass}>
          <option value="">All entities</option>
          {auditEntities.map(entity => <option key={entity} value={entity}>{entity.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">Operation
        <select name="operation" defaultValue={filters.operation} className={inputClass}>
          <option value="">All operations</option>
          {auditOperations.map(operation => <option key={operation}>{operation}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">Record ID (such as an appointment)
        <input name="record" defaultValue={filters.record} maxLength={36} placeholder="Any record" className={inputClass} />
      </label>
      <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white">Apply filters</button>
    </form>
  );
}
