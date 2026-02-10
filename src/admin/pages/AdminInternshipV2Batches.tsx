import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type BatchRow = {
  id: number;
  internshipId: number;
  batchCode: string;
  name: string;
  startDate: string;
  endDate: string;
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  capacity: number | null;
  status: string;
  createdAt: string;
};

const batchStatuses = ["DRAFT", "OPEN", "CLOSED", "RUNNING", "ENDED"] as const;

type BulkApplicantInput = {
  email: string;
  name: string;
  portfolio?: string | null;
  linkedin?: string | null;
  github?: string | null;
  location?: string | null;
  phone?: string | null;
  coverLetter?: string | null;
};

type BulkImportResult = {
  ok: boolean;
  createdUsers: { userId: string; email: string; name: string; tempPassword?: string }[];
  createdApplications: { id: string; email: string; userId: string; wasRejected?: boolean }[];
  skipped: { email: string; reason: string }[];
  applicantsDelta: number;
};

type TemplateRow = {
  id: string;
  badgeLevel: string;
  title: string;
  sortOrder: number;
};

type AssignBatchResult = {
  ok: boolean;
  result: {
    enrollments: any[];
    totals: { created: number; updated: number; skipped: number };
  };
};

function toIsoDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toISOString();
}

export default function AdminInternshipV2Batches() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBatch, setBulkBatch] = useState<BatchRow | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkReturnPasswords, setBulkReturnPasswords] = useState(true);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBatch, setAssignBatch] = useState<BatchRow | null>(null);
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
  const [assignResult, setAssignResult] = useState<AssignBatchResult | null>(null);
  const [includeActive, setIncludeActive] = useState(true);
  const [includeFrozen, setIncludeFrozen] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "DRAFT",
    capacity: "",
    applicationOpenAt: "",
    applicationCloseAt: "",
  });

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
    setLoading(true);
    try {
      const d = await apiFetch<{ batches: BatchRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/batches`);
      setBatches(Array.isArray(d?.batches) ? d.batches : []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!internshipId) return;
    loadBatches(internshipId).catch(() => {});
  }, [internshipId]);

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

  const parseBulkApplicants = (text: string): { applicants: BulkApplicantInput[]; skipped: number } => {
    const raw = String(text || "").trim();
    if (!raw) return { applicants: [], skipped: 0 };

    // JSON mode: array of {email,name,...}
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : parsed?.applicants;
        if (!Array.isArray(arr)) return { applicants: [], skipped: 0 };

        const out: BulkApplicantInput[] = [];
        const seen = new Set<string>();
        let skipped = 0;
        for (const it of arr) {
          const email = String(it?.email || "").trim().toLowerCase();
          const name = String(it?.name || it?.fullName || "").trim();
          if (!email || !email.includes("@") || !name) {
            skipped += 1;
            continue;
          }
          if (seen.has(email)) {
            skipped += 1;
            continue;
          }
          seen.add(email);
          out.push({
            email,
            name,
            portfolio: it?.portfolio ?? null,
            linkedin: it?.linkedin ?? null,
            github: it?.github ?? null,
            location: it?.location ?? null,
            phone: it?.phone ?? null,
            coverLetter: it?.coverLetter ?? null,
          });
        }
        return { applicants: out, skipped };
      } catch {
        return { applicants: [], skipped: 0 };
      }
    }

    // CSV-ish mode: one per line: email,name,(optional columns ignored)
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const out: BulkApplicantInput[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const line of lines) {
      // allow commas or tabs
      const parts = line.split(/\s*,\s*|\t/).map((p) => p.trim());
      const email = String(parts[0] || "").trim().toLowerCase();
      const name = String(parts[1] || "").trim();
      if (!email || !email.includes("@") || !name) {
        skipped += 1;
        continue;
      }
      if (seen.has(email)) {
        skipped += 1;
        continue;
      }
      seen.add(email);
      out.push({ email, name });
    }

    return { applicants: out, skipped };
  };

  const openBulk = (b: BatchRow) => {
    setBulkBatch(b);
    setBulkText("");
    setBulkReturnPasswords(true);
    setBulkSubmitting(false);
    setBulkResult(null);
    setBulkOpen(true);
  };

  const openAssign = async (b: BatchRow) => {
    setAssignBatch(b);
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
    setIncludeActive(true);
    setIncludeFrozen(false);
    setIncludeCompleted(false);
    await loadTemplates(internshipId);
  };

  const submitAssign = async () => {
    if (!assignBatch) return;
    if (!assignAll && selectedTemplateIds.length === 0) {
      toast.error("Select at least one template or enable Assign all");
      return;
    }

    const includeStatuses: string[] = [];
    if (includeActive) includeStatuses.push("ACTIVE");
    if (includeFrozen) includeStatuses.push("FROZEN");
    if (includeCompleted) includeStatuses.push("COMPLETED");

    setAssignSubmitting(true);
    setAssignResult(null);
    try {
      const res = await apiFetch<AssignBatchResult>(
        `/internships/${encodeURIComponent(String(internshipId))}/admin/v2/batches/${encodeURIComponent(String(assignBatch.id))}/assignments/assign`,
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
            includeStatuses: includeStatuses.length ? includeStatuses : ["ACTIVE"],
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

  const submitBulk = async () => {
    if (!bulkBatch) return;
    const parsed = parseBulkApplicants(bulkText);
    if (!parsed.applicants.length) {
      toast.error("No valid applicants found");
      return;
    }

    setBulkSubmitting(true);
    setBulkResult(null);

    try {
      const res = await apiFetch<BulkImportResult>(
        `/internships/${encodeURIComponent(String(internshipId))}/admin/batches/${encodeURIComponent(String(bulkBatch.id))}/applicants/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ applicants: parsed.applicants, returnPasswords: bulkReturnPasswords }),
        },
      );
      setBulkResult(res);
      toast.success("Bulk import complete");
      await loadBatches(internshipId);
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      toast.error("Name, start date and end date are required");
      return;
    }

    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/batches`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          startDate: toIsoDateStart(form.startDate),
          endDate: toIsoDateStart(form.endDate),
          status: form.status,
          capacity: form.capacity.trim() ? Number(form.capacity) : null,
          applicationOpenAt: form.applicationOpenAt ? toIsoDateStart(form.applicationOpenAt) : null,
          applicationCloseAt: form.applicationCloseAt ? toIsoDateStart(form.applicationCloseAt) : null,
        }),
      });
      toast.success("Batch created");
      setForm((p) => ({ ...p, name: "" }));
      await loadBatches(internshipId);
    } catch {
      toast.error("Failed to create batch");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Batches</h1>
          <p className="text-muted-foreground mt-1">Create and manage batches per internship.</p>
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
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold">Create Batch</div>
          <Button variant="neon" onClick={() => void handleCreate()}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-medium mb-1">Name</div>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Status</div>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {batchStatuses.map((s) => (
                <option key={s} value={s} className="bg-card">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Start date</div>
            <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">End date</div>
            <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Capacity (optional)</div>
            <Input value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="e.g. 50" />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Application opens (optional)</div>
            <Input type="date" value={form.applicationOpenAt} onChange={(e) => setForm((p) => ({ ...p, applicationOpenAt: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Application closes (optional)</div>
            <Input type="date" value={form.applicationCloseAt} onChange={(e) => setForm((p) => ({ ...p, applicationCloseAt: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Batch</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Dates</div>
          <div className="col-span-3">Applications</div>
        </div>
        <div className="divide-y divide-border">
          {batches.map((b) => (
            <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground truncate">{b.batchCode}</div>
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">{b.status}</div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
              </div>
              <div className="col-span-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Open: {b.applicationOpenAt ? new Date(b.applicationOpenAt).toLocaleDateString() : "—"}
                  <br />
                  Close: {b.applicationCloseAt ? new Date(b.applicationCloseAt).toLocaleDateString() : "—"}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void openAssign(b)}>
                    Assign Tasks
                  </Button>
                  <Button variant="outline" onClick={() => openBulk(b)}>
                    Bulk Import
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {batches.length === 0 && <div className="p-8 text-center text-muted-foreground">No batches found.</div>}
        </div>
      </div>

      <Dialog open={assignOpen} onOpenChange={(o) => setAssignOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assign Tasks (Batch)</DialogTitle>
            <DialogDescription>
              {assignBatch ? (
                <span>
                  Batch: <span className="font-medium">{assignBatch.name}</span> ({assignBatch.batchCode})
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

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-sm font-medium">Apply to enrollments</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeActive} onChange={(e) => setIncludeActive(e.target.checked)} />
                  ACTIVE
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeFrozen} onChange={(e) => setIncludeFrozen(e.target.checked)} />
                  FROZEN
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
                  COMPLETED
                </label>
              </div>
            </div>

            {assignResult?.result?.totals && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="text-sm font-medium">Result</div>
                <div className="text-xs text-muted-foreground">
                  Enrollments processed: <span className="text-foreground">{Array.isArray(assignResult.result.enrollments) ? assignResult.result.enrollments.length : 0}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: <span className="text-foreground">{assignResult.result.totals.created}</span>
                  {" "}· Updated: <span className="text-foreground">{assignResult.result.totals.updated}</span>
                  {" "}· Skipped: <span className="text-foreground">{assignResult.result.totals.skipped}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
            <Button variant="neon" onClick={() => void submitAssign()} disabled={assignSubmitting || !assignBatch}>
              {assignSubmitting ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={(o) => setBulkOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Applicants Import</DialogTitle>
            <DialogDescription>
              {bulkBatch ? (
                <span>
                  Batch: <span className="font-medium">{bulkBatch.name}</span> ({bulkBatch.batchCode})
                </span>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Paste either:
              <br />
              CSV lines: <span className="font-mono">email,name</span>
              <br />
              or JSON array: <span className="font-mono">[{`{"email":"a@x.com","name":"A"}`}]</span>
            </div>

            <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="email,name" className="min-h-[160px]" />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bulkReturnPasswords} onChange={(e) => setBulkReturnPasswords(e.target.checked)} />
              Return temp passwords for newly-created users
            </label>

            {(() => {
              const parsed = parseBulkApplicants(bulkText);
              return (
                <div className="text-xs text-muted-foreground">
                  Parsed: <span className="text-foreground">{parsed.applicants.length}</span> valid
                  {parsed.skipped ? (
                    <span>
                      {" "}· Skipped: <span className="text-foreground">{parsed.skipped}</span>
                    </span>
                  ) : null}
                </div>
              );
            })()}

            {bulkResult && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="text-sm font-medium">
                  Result (added: {bulkResult.applicantsDelta}, users: {bulkResult.createdUsers.length}, apps: {bulkResult.createdApplications.length}, skipped: {bulkResult.skipped.length})
                </div>

                {bulkResult.createdUsers.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Created Users</div>
                    <div className="max-h-40 overflow-auto rounded-md bg-muted/20 p-2 text-xs font-mono">
                      {bulkResult.createdUsers.map((u) => (
                        <div key={u.userId} className="flex justify-between gap-2">
                          <div className="truncate">{u.email}</div>
                          <div className="shrink-0">{u.tempPassword ? u.tempPassword : ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bulkResult.skipped.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Skipped</div>
                    <div className="max-h-28 overflow-auto rounded-md bg-muted/20 p-2 text-xs font-mono">
                      {bulkResult.skipped.map((s, idx) => (
                        <div key={`${s.email}-${idx}`} className="flex justify-between gap-2">
                          <div className="truncate">{s.email}</div>
                          <div className="shrink-0">{s.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkOpen(false);
              }}
            >
              Close
            </Button>
            <Button variant="neon" onClick={() => void submitBulk()} disabled={bulkSubmitting || !bulkBatch}>
              {bulkSubmitting ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
