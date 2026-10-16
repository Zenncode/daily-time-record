"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { exportAttendanceAction } from "@/app/actions/reports";

export default function ExportForm({ from, to }: { from: string; to: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function exportReport(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await exportAttendanceAction(formData);
      if ("error" in result) {
        setError(result.error ?? "The export could not be prepared.");
        return;
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return <form action={exportReport} className="filters">
    <div className="field"><label htmlFor="from">From</label><input className="input" type="date" name="from" id="from" defaultValue={from} required /></div>
    <div className="field"><label htmlFor="to">To</label><input className="input" type="date" name="to" id="to" defaultValue={to} required /></div>
    <button className="button button-primary" disabled={isPending}><Download size={14} />{isPending ? "Preparing…" : "Export CSV"}</button>
    {error && <span className="notice notice-error" style={{ margin: 0 }}>{error}</span>}
  </form>;
}
