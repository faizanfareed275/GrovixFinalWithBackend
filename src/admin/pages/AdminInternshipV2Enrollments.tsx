import { useEffect, useMemo, useState } from "react";
import { Ban, Lock, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

 const ALL_BATCHES_VALUE = "__all__";

function toIsoDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toISOString();
}

function EnrollmentDateInputs({ enrollmentId, editingDates, setEditingDates, onSave }: {
  enrollmentId: string;
  editingDates: Record<string, { startDate: string; endDate: string }>;
  setEditingDates: React.Dispatch<React.SetStateAction<Record<string, { startDate: string; endDate: string }>>>;
  onSave: (id: string) => void;
}) {
  const dates = editingDates[enrollmentId] || { startDate: "", endDate: "" };
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1">Start</div>
        <Input
          type="date"
          value={dates.startDate}
          onChange={(e) => setEditingDates((p) => ({ ...p, [enrollmentId]: { ...dates, startDate: e.target.value } }))}
        />
      </div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1">End</div>
        <Input
          type="date"
          value={dates.endDate}
          onChange={(e) => setEditingDates((p) => ({ ...p, [enrollmentId]: { ...dates, endDate: e.target.value } }))}
        />
      </div>
      <Button variant="neon" size="sm" onClick={() => onSave(enrollmentId)}>Save</Button>
    </div>
  );
}

export default function AdminInternshipV2Enrollments() {
  const navigate = useNavigate();
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(0);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; endDate: string }>>({});

  const [nextBatchByEnrollment, setNextBatchByEnrollment] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch<{ internships: InternshipItem[] }>("/internships")
      .then((d) => {
        const list = Array.isArray(d?.internships) ? d.internships : [];
        setInternships(list);
        if (list[0]?.id) setInternshipId(list[0].id);
      })
      .catch((e) => {
        console.error("Failed to fetch internships", e);
        setError("Failed to load internships");
        setInternships([]);
      });
  }, []);

  const loadBatches = async (id: number) => {
    try {
      const d = await apiFetch<{ batches: BatchRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/batches`);
      setBatches(Array.isArray(d?.batches) ? d.batches : []);
    } catch (e) {
      console.error("Failed to load batches", e);
      setBatches([]);
    }
  };

  const loadEnrollments = async (id: number, batch: string) => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      console.error("Failed to load enrollments", e);
      setError("Failed to load enrollments");
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

  const changeBatch = async (enrollmentId: string) => {
    const nextBatch = nextBatchByEnrollment[enrollmentId];
    const payload = { batchId: nextBatch ? Number(nextBatch) : null };
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/change-batch`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Batch changed (assignments reset)");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to change batch");
    }
  };

  const revokeCert = async (enrollmentId: string) => {
    try {
      await apiFetch(
        `/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/certificate/revoke`,
        {
          method: "POST",
        }
      );
      toast.success("Certificate revoked");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to revoke certificate");
    }
  };

  const restoreCert = async (enrollmentId: string) => {
    try {
      await apiFetch(
        `/internships/${encodeURIComponent(String(internshipId))}/admin/enrollments/${encodeURIComponent(enrollmentId)}/certificate/restore`,
        {
          method: "POST",
        }
      );
      toast.success("Certificate restored");
      await loadEnrollments(internshipId, batchId);
    } catch {
      toast.error("Failed to restore certificate");
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h1 className="text-2xl font-display font-bold">Internship v2 Enrollments</h1>
          <p className="text-destructive mt-2">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Enrollments</h1>
          <p className="text-muted-foreground mt-1">Freeze/read-only/terminate and adjust enrollment dates.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={String(internshipId)} onValueChange={(v) => setInternshipId(Number(v))}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select internship" />
            </SelectTrigger>
            <SelectContent>
              {internships.map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={batchId || ALL_BATCHES_VALUE}
            onValueChange={(v) => setBatchId(v === ALL_BATCHES_VALUE ? "" : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BATCHES_VALUE}>All batches</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user/batch/status..." />
          </div>

          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      {internships.length === 0 && !loading && (
        <div className="glass-card p-6">
          <p className="text-muted-foreground">No internships found. Create internships first.</p>
        </div>
      )}

      {internships.length > 0 && (
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
              <div key={r.id} className="px-4 py-3 space-y-3">
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
                  <div className="col-span-2 flex justify-end gap-1 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => {
                      const qs = new URLSearchParams();
                      qs.set("internshipId", String(internshipId));
                      qs.set("enrollmentId", r.id);
                      if (r.batchId) qs.set("batchId", String(r.batchId));
                      navigate(`/admin/internship-v2-assignments?${qs.toString()}`);
                    }} title="View assignments">
                      Assignments
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void syncEnrollment(r.id)} title="Sync enrollment">
                      Sync
                    </Button>
                    <Select
                      value={nextBatchByEnrollment[r.id] ?? (r.batchId ? String(r.batchId) : "")}
                      onValueChange={(v) => setNextBatchByEnrollment((p) => ({ ...p, [r.id]: v }))}
                    >
                      <SelectTrigger className="w-40" title="Change batch">
                        <SelectValue placeholder="Batch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No batch</SelectItem>
                        {batches.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void changeBatch(r.id)}
                      title="Change batch and reset assignments"
                    >
                      Change
                    </Button>
                    {r.certificate?.id && (
                      r.certificate.status === "VALID" ? (
                        <Button variant="outline" size="sm" onClick={() => void revokeCert(r.id)} title="Revoke certificate">
                          Revoke
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => void restoreCert(r.id)} title="Restore certificate">
                          Restore
                        </Button>
                      )
                    )}
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

                <EnrollmentDateInputs
                  enrollmentId={r.id}
                  editingDates={editingDates}
                  setEditingDates={setEditingDates}
                  onSave={saveDates}
                />
              </div>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground">No enrollments found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
