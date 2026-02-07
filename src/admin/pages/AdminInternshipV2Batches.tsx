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
                <Button variant="outline" onClick={() => openBulk(b)}>
                  Bulk Import
                </Button>
              </div>
            </div>
          ))}
          {batches.length === 0 && <div className="p-8 text-center text-muted-foreground">No batches found.</div>}
        </div>
      </div>

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
