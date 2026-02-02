import { useEffect, useMemo, useState } from "react";
import { Ban, Lock, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type BatchRow = {
  id: number;
  batchCode: string;
  name: string;
};

type EnrollmentRow = {
  id: string;
  internshipId: number;
  batchId: number | null;
  userId: string;
  startDate: string;
  endDate: string;
  status: string;
  accessMode: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null; xp: number };
  batch: BatchRow | null;
  certificate: { id: string; certificateCode: string; status: string; issuedAt: string } | null;
};

function toIsoDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toISOString();
}

export default function AdminInternshipV2Enrollments() {
  const navigate = useNavigate();
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; endDate: string }>>({});

  useEffect(() => {
    apiFetch<{ internships: InternshipItem[] }>("/internships")
      .then((d) => {
        const list = Array.isArray(d?.internships) ? d.internships : [];
        setInternships(list);
        if (list[0]?.id) setInternshipId(list[0].id);
      })
      .catch(() => setInternships([]));
  }, []);

  const loadBatches = async (id: number) => {
    try {
      const d = await apiFetch<{ batches: BatchRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/batches`);
      setBatches(Array.isArray(d?.batches) ? d.batches : []);
    } catch {
      setBatches([]);
    }
  };

  const syncEnrollment = async (enrollmentId: string) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/sync`, {
        method: "POST",
      });
      toast.success("Synced");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to sync");
    }
  };

  const loadEnrollments = async (id: number, batch: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (batch) qs.set("batchId", batch);
      const d = await apiFetch<{ enrollments: EnrollmentRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/enrollments?${qs.toString()}`);
      const list = Array.isArray(d?.enrollments) ? d.enrollments : [];
      setRows(list);

      const nextDates: Record<string, { startDate: string; endDate: string }> = {};
      for (const r of list) {
        nextDates[r.id] = {
          startDate: new Date(r.startDate).toISOString().slice(0, 10),
          endDate: new Date(r.endDate).toISOString().slice(0, 10),
        };
      }
      setEditingDates(nextDates);
    } catch {
      setRows([]);
      setEditingDates({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!internshipId) return;
    loadBatches(internshipId).catch(() => {});
    loadEnrollments(internshipId, batchId).catch(() => {});
  }, [internshipId, batchId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.user?.name || "").toLowerCase().includes(q) ||
      String(r.user?.email || "").toLowerCase().includes(q) ||
      String(r.batch?.batchCode || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const act = async (enrollmentId: string, action: "freeze" | "read-only" | "terminate") => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/${action}`, {
        method: "POST",
      });
      toast.success("Updated");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to update");
    }
  };

  const saveDates = async (enrollmentId: string) => {
    const d = editingDates[enrollmentId];
    if (!d?.startDate || !d?.endDate) return;

    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/dates`, {
        method: "POST",
        body: JSON.stringify({ startDate: toIsoDateStart(d.startDate), endDate: toIsoDateStart(d.endDate) }),
      });
      toast.success("Dates updated");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to update dates");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Enrollments</h1>
          <p className="text-muted-foreground mt-1">Freeze/read-only/terminate and adjust enrollment dates.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={internshipId}
            onChange={(e) => setInternshipId(parseInt(e.target.value))}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {internships.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">
                {i.title}
              </option>
            ))}
          </select>

          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="" className="bg-card">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={String(b.id)} className="bg-card">
                {b.batchCode}
              </option>
            ))}
          </select>

          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user/batch/status..." />
          </div>

          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Batch</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Dates</div>
          <div className="col-span-1">Cert</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{r.user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.user.email}</div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground min-w-0">
                  <div className="truncate">{r.batch ? r.batch.batchCode : "—"}</div>
                  <div className="truncate">{r.batch ? r.batch.name : ""}</div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  <div>{r.status}</div>
                  <div>{r.accessMode}</div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {r.certificate ? r.certificate.status : "—"}
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const qs = new URLSearchParams();
                      qs.set("internshipId", String(internshipId));
                      qs.set("enrollmentId", r.id);
                      if (r.batchId) qs.set("batchId", String(r.batchId));
                      navigate(`/admin/internship-v2-assignments?${qs.toString()}`);
                    }}
                    title="View assignments"
                  >
                    Assignments
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void syncEnrollment(r.id)} title="Sync enrollment">
                    Sync
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void act(r.id, "freeze")} title="Freeze">
                    <Snowflake className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void act(r.id, "read-only")} title="Read-only">
                    <Lock className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void act(r.id, "terminate")} title="Terminate">
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">Start</div>
                  <Input
                    type="date"
                    value={editingDates[r.id]?.startDate || ""}
                    onChange={(e) => setEditingDates((p) => ({ ...p, [r.id]: { ...(p[r.id] || { startDate: "", endDate: "" }), startDate: e.target.value } }))}
                  />
                </div>
                <div className="sm:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">End</div>
                  <Input
                    type="date"
                    value={editingDates[r.id]?.endDate || ""}
                    onChange={(e) => setEditingDates((p) => ({ ...p, [r.id]: { ...(p[r.id] || { startDate: "", endDate: "" }), endDate: e.target.value } }))}
                  />
                </div>
                <div className="sm:col-span-6 flex justify-end">
                  <Button variant="neon" size="sm" onClick={() => void saveDates(r.id)}>
                    Save dates
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No enrollments found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
