import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type BatchAnalyticsRow = {
  id: number;
  batchCode: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  applications: { pending: number; approved: number; rejected: number; other: number };
  enrollments: { active: number; frozen: number; terminated: number; completed: number; other: number };
  completionRate: number;
};

type InternshipAnalyticsRow = {
  id: number;
  title: string;
  company: string;
  internshipCode: string | null;
  applications: { pending: number; approved: number; rejected: number; other: number };
  enrollments: { active: number; frozen: number; terminated: number; completed: number; other: number };
  completionRate: number;
  batches: BatchAnalyticsRow[];
};

export default function AdminInternshipV2Analytics() {
  const [rows, setRows] = useState<InternshipAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ ok: boolean; internships: InternshipAnalyticsRow[] }>("/internships/admin/v2/analytics");
      setRows(Array.isArray(d?.internships) ? d.internships : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.title || "").toLowerCase().includes(q) ||
      String(r.company || "").toLowerCase().includes(q) ||
      String(r.internshipCode || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Analytics</h1>
          <p className="text-muted-foreground mt-1">Applications, enrollments and completion rates per internship/batch.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search internship/company/code..." />
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Internship</div>
          <div className="col-span-3">Applications</div>
          <div className="col-span-3">Enrollments</div>
          <div className="col-span-2 text-right">Completion</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((r) => {
            const apps = r.applications;
            const en = r.enrollments;
            const isOpen = !!expanded[r.id];
            return (
              <div key={r.id} className="px-4 py-3 space-y-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 min-w-0">
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.company} {r.internshipCode ? `• ${r.internshipCode}` : ""}</div>
                    </div>

                    <div className="col-span-3 text-xs text-muted-foreground">
                      <div>Pending: {apps.pending} • Approved: {apps.approved}</div>
                      <div>Rejected: {apps.rejected} • Other: {apps.other}</div>
                    </div>

                    <div className="col-span-3 text-xs text-muted-foreground">
                      <div>Active: {en.active} • Completed: {en.completed}</div>
                      <div>Frozen: {en.frozen} • Terminated: {en.terminated}</div>
                    </div>

                    <div className="col-span-2 text-right">
                      <div className="font-medium">{r.completionRate}%</div>
                      <div className="text-xs text-muted-foreground">Click to {isOpen ? "hide" : "view"} batches</div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-card/50 text-[11px] text-muted-foreground">
                      <div className="col-span-3">Batch</div>
                      <div className="col-span-3">Apps</div>
                      <div className="col-span-4">Enrollments</div>
                      <div className="col-span-2 text-right">Completion</div>
                    </div>
                    <div className="divide-y divide-border">
                      {r.batches.map((b) => (
                        <div key={b.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs">
                          <div className="col-span-3 min-w-0">
                            <div className="font-medium truncate">{b.batchCode}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{b.name} • {b.status}</div>
                          </div>
                          <div className="col-span-3 text-muted-foreground">
                            P:{b.applications.pending} A:{b.applications.approved} R:{b.applications.rejected} O:{b.applications.other}
                          </div>
                          <div className="col-span-4 text-muted-foreground">
                            Active:{b.enrollments.active} Completed:{b.enrollments.completed} Frozen:{b.enrollments.frozen} Term:{b.enrollments.terminated}
                          </div>
                          <div className="col-span-2 text-right font-medium">{b.completionRate}%</div>
                        </div>
                      ))}
                      {r.batches.length === 0 && (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">No batches</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="p-8 text-center text-muted-foreground">No analytics rows found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
