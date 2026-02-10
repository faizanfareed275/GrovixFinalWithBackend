import { useEffect, useMemo, useState } from "react";
import { Ban, Lock, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type TemplateRow = {
  id: string;
  badgeLevel: string;
  title: string;
  sortOrder: number;
};

type AssignEnrollmentResult = {
  ok: boolean;
  result: {
    created: string[];
    updated: string[];
    skipped: { templateId: string; reason: string }[];
  };
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

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEnrollment, setAssignEnrollment] = useState<EnrollmentRow | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [assignAll, setAssignAll] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<"SKIP_EXISTING" | "UPSERT">("SKIP_EXISTING");
  const [assignSchedule, setAssignSchedule] = useState<"TEMPLATE" | "UNLOCK_NOW" | "CUSTOM">("TEMPLATE");
  const [assignCustomUnlockDate, setAssignCustomUnlockDate] = useState<string>("");
  const [assignCustomDeadlineDate, setAssignCustomDeadlineDate] = useState<string>("");
  const [assignResetAttempts, setAssignResetAttempts] = useState(false);
  const [assignForce, setAssignForce] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignResult, setAssignResult] = useState<AssignEnrollmentResult | null>(null);

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

  const openAssign = async (r: EnrollmentRow) => {
    setAssignEnrollment(r);
    setAssignOpen(true);
    setAssignAll(false);
    setSelectedTemplateIds([]);
    setAssignMode("SKIP_EXISTING");
    setAssignSchedule("TEMPLATE");
    setAssignCustomUnlockDate("");
    setAssignCustomDeadlineDate("");
    setAssignResetAttempts(false);
    setAssignForce(false);
    setAssignResult(null);
    await loadTemplates(internshipId);
  };

  const submitAssign = async () => {
    if (!assignEnrollment) return;
    if (!assignAll && selectedTemplateIds.length === 0) {
      toast.error("Select at least one template or enable Assign all");
      return;
    }

    setAssignSubmitting(true);
    setAssignResult(null);
    try {
      const res = await apiFetch<AssignEnrollmentResult>(
        `/internships/${encodeURIComponent(String(internshipId))}/admin/v2/enrollments/${encodeURIComponent(String(assignEnrollment.id))}/assignments/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            assignAll,
            templateIds: selectedTemplateIds,
            mode: assignMode,
            schedule: assignSchedule,
            unlockAt: assignSchedule === "CUSTOM" && assignCustomUnlockDate ? toIsoDateStart(assignCustomUnlockDate) : null,
            deadlineAt: assignSchedule === "CUSTOM" && assignCustomDeadlineDate ? toIsoDateStart(assignCustomDeadlineDate) : null,
            resetAttempts: assignMode === "UPSERT" ? assignResetAttempts : false,
            force: assignForce,
          }),
        },
      );
      setAssignResult(res);
      toast.success("Tasks assigned");
    } catch {
      toast.error("Assign failed");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const loadTemplates = async (id: number) => {
    setTemplatesLoading(true);
    try {
      const d = await apiFetch<{ templates: TemplateRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/v2/templates`);
      const list = Array.isArray(d?.templates) ? d.templates : [];
      list.sort((a, b) => {
        if (String(a.badgeLevel) !== String(b.badgeLevel)) return String(a.badgeLevel).localeCompare(String(b.badgeLevel));
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      });
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
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
                    <Button variant="outline" size="sm" onClick={() => void openAssign(r)} title="Assign tasks">
                      Assign Tasks
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

      <Dialog open={assignOpen} onOpenChange={(o) => setAssignOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assign Tasks</DialogTitle>
            <DialogDescription>
              {assignEnrollment ? (
                <span>
                  User: <span className="font-medium">{assignEnrollment.user.name}</span> ({assignEnrollment.user.email})
                </span>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={assignAll} onChange={(e) => setAssignAll(e.target.checked)} />
              Assign all templates
            </label>

            {!assignAll && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-sm font-medium">Templates</div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTemplateIds(templates.map((t) => String(t.id)))}
                      disabled={templatesLoading || templates.length === 0}
                    >
                      Select all
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTemplateIds([])}>
                      Clear
                    </Button>
                  </div>
                </div>

                {templatesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading templates…</div>
                ) : templates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No templates found.</div>
                ) : (
                  <div className="max-h-56 overflow-auto space-y-2">
                    {templates.map((t) => {
                      const checked = selectedTemplateIds.includes(String(t.id));
                      return (
                        <label key={t.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedTemplateIds((p) => {
                                if (on) return Array.from(new Set([...p, String(t.id)]));
                                return p.filter((x) => x !== String(t.id));
                              });
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{t.title}</div>
                            <div className="text-xs text-muted-foreground">{t.badgeLevel}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-2 text-xs text-muted-foreground">
                  Selected: <span className="text-foreground">{selectedTemplateIds.length}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-sm font-medium">Mode</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={assignMode === "SKIP_EXISTING"} onChange={() => setAssignMode("SKIP_EXISTING")} />
                  Skip existing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={assignMode === "UPSERT"} onChange={() => setAssignMode("UPSERT")} />
                  Upsert (update if exists)
                </label>

                {assignMode === "UPSERT" && (
                  <div className="pt-1 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={assignResetAttempts} onChange={(e) => setAssignResetAttempts(e.target.checked)} />
                      Reset attempts/status
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={assignForce} onChange={(e) => setAssignForce(e.target.checked)} />
                      Force update (even if attempts exist)
                    </label>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-sm font-medium">Schedule</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={assignSchedule === "TEMPLATE"} onChange={() => setAssignSchedule("TEMPLATE")} />
                  Use template offsets
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={assignSchedule === "UNLOCK_NOW"} onChange={() => setAssignSchedule("UNLOCK_NOW")} />
                  Unlock now
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={assignSchedule === "CUSTOM"} onChange={() => setAssignSchedule("CUSTOM")} />
                  Custom dates
                </label>

                {assignSchedule === "CUSTOM" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Unlock date (optional)</div>
                      <Input type="date" value={assignCustomUnlockDate} onChange={(e) => setAssignCustomUnlockDate(e.target.value)} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Deadline date (optional)</div>
                      <Input type="date" value={assignCustomDeadlineDate} onChange={(e) => setAssignCustomDeadlineDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {assignResult?.result && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="text-sm font-medium">Result</div>
                <div className="text-xs text-muted-foreground">
                  Created: <span className="text-foreground">{Array.isArray(assignResult.result.created) ? assignResult.result.created.length : 0}</span>
                  {" "}· Updated: <span className="text-foreground">{Array.isArray(assignResult.result.updated) ? assignResult.result.updated.length : 0}</span>
                  {" "}· Skipped: <span className="text-foreground">{Array.isArray(assignResult.result.skipped) ? assignResult.result.skipped.length : 0}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
            <Button variant="neon" onClick={() => void submitAssign()} disabled={assignSubmitting || !assignEnrollment}>
              {assignSubmitting ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
