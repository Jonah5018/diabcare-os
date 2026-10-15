"use client";

import { useState } from "react";

export default function AuditExport({ query, cursor }: { query: Record<string, string>; cursor: string }) {
  const [next, setNext] = useState<string | null>(cursor);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function downloadPage() {
    if (pending || next === null) return;
    setPending(true);
    setMessage("");
    try {
      const form = new FormData();
      Object.entries({ ...query, cursor: next }).forEach(([key, value]) => form.set(key, value));
      const response = await fetch("/dashboard/audit/export", { method: "POST", body: form });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "clinic-audit-page.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      const more = response.headers.get("X-Audit-Has-More") === "true";
      setNext(more ? response.headers.get("X-Audit-Next-Cursor") : null);
      setMessage(more ? "Page prepared. Download the next export page to continue." : "Final page prepared. Store exported audit files securely.");
    } catch {
      setMessage("Unable to export. Refresh audit history and check your filters before retrying.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-600">CSV export: up to 200 events per file, starting at the displayed page cursor. Names and clinical content are excluded. This is a live paginated export; it is not a frozen archive.</p>
      <button type="button" disabled={pending || next === null} onClick={downloadPage}
        className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
        {pending ? "Preparing export..." : next === null ? "Export pages complete" : "Download audit CSV page"}
      </button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </div>
  );
}
