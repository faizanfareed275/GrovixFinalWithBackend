import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type BatchRow = {
  id: number;
  batchCode: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

type ApplicationRow = {
  id: string;
  internshipId: number;
  batchId: number | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  portfolio: string | null;
  linkedin: string | null;
  github: string | null;
  location: string | null;
  phone: string | null;
  coverLetter: string | null;
  offerSubject: string | null;
  offerBody: string | null;
  resumeFileId?: string | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null; xp: number };
  batch: BatchRow | null;
};

function toIsoDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toISOString();
}

export default function AdminInternshipV2Applications() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  const [offerSubject, setOfferSubject] = useState("");
  const [offerBody, setOfferBody] = useState("");
  const [overrideStart, setOverrideStart] = useState("");
  const [overrideEnd, setOverrideEnd] = useState("");
  const [approveBatchId, setApproveBatchId] = useState<string>("");
  const [sendEmail, setSendEmail] = useState(true);

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

  const loadApps = async (id: number, batch: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (batch) qs.set("batchId", batch);
      const d = await apiFetch<{ applications: ApplicationRow[] }>(`/internships/${encodeURIComponent(String(id))}/admin/applications?${qs.toString()}`);
      setApps(Array.isArray(d?.applications) ? d.applications : []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!internshipId) return;
    loadBatches(internshipId).catch(() => {});
    loadApps(internshipId, batchId).catch(() => {});
  }, [internshipId, batchId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => {
      return (
        String(a.user?.name || "").toLowerCase().includes(q) ||
        String(a.user?.email || "").toLowerCase().includes(q) ||
        String(a.batch?.batchCode || "").toLowerCase().includes(q) ||
        String(a.status || "").toLowerCase().includes(q)
      );
    });
  }, [apps, query]);

  const beginAct = (app: ApplicationRow) => {
    setActingId(app.id);
    setOfferSubject(app.offerSubject || "Offer Letter");
    setOfferBody(app.offerBody || "<p>Congratulations! Please find your offer letter attached.</p>");
    setOverrideStart(app.batch?.startDate ? new Date(app.batch.startDate).toISOString().slice(0, 10) : "");
    setOverrideEnd(app.batch?.endDate ? new Date(app.batch.endDate).toISOString().slice(0, 10) : "");
    setApproveBatchId(app.batchId ? String(app.batchId) : (batches[0]?.id ? String(batches[0].id) : ""));
    setSendEmail(true);
  };

  const approve = async (appId: string) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/applications/${encodeURIComponent(appId)}/approve`, {
        method: "POST",
        body: JSON.stringify({
          batchId: approveBatchId ? Number(approveBatchId) : null,
          startDate: overrideStart ? toIsoDateStart(overrideStart) : null,
          endDate: overrideEnd ? toIsoDateStart(overrideEnd) : null,
          offerSubject,
          offerBody,
          sendEmail,
        }),
      });
      toast.success("Approved and enrolled");
      setActingId(null);
      await loadApps(internshipId, batchId);
    } catch {
      toast.error("Failed to approve");
    }
  };

  const reject = async (appId: string) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/applications/${encodeURIComponent(appId)}/reject`, {
        method: "POST",
      });
      toast.success("Rejected");
      setActingId(null);
      await loadApps(internshipId, batchId);
    } catch {
      toast.error("Failed to reject");
    }
  };

  const downloadResume = (app: ApplicationRow) => {
    const url = `${import.meta.env.VITE_GROVIX_API_URL || "http://localhost:4000"}/internships/${encodeURIComponent(
      String(internshipId)
    )}/admin/applications/${encodeURIComponent(app.id)}/resume`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Applications</h1>
          <p className="text-muted-foreground mt-1">Review applicants and approve/reject (approval enrolls intern).</p>
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
          <div className="col-span-3">Batch</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Applied</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{a.user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.user.email}</div>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground min-w-0">
                  <div className="truncate">{a.batch ? a.batch.batchCode : "—"}</div>
                  <div className="truncate">{a.batch ? a.batch.name : ""}</div>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">{a.status}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => beginAct(a)}>
                    Review
                  </Button>
                </div>
              </div>

              {actingId === a.id && (
                <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Portfolio</div>
                      <div className="text-sm break-words">{a.portfolio || "—"}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Location / Phone</div>
                      <div className="text-sm break-words">
                        {a.location || "—"}
                        {a.phone ? ` • ${a.phone}` : ""}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">LinkedIn</div>
                      <div className="text-sm break-words">{a.linkedin || "—"}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">GitHub</div>
                      <div className="text-sm break-words">{a.github || "—"}</div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Cover Letter</div>
                    <div className="text-sm whitespace-pre-wrap break-words">{a.coverLetter || "—"}</div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => downloadResume(a)} disabled={!a.resumeFileId}>
                      Download Resume
                    </Button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm font-medium mb-1">Assign Batch</div>
                      <select
                        value={approveBatchId}
                        onChange={(e) => setApproveBatchId(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={String(b.id)} className="bg-card">
                            {b.batchCode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">Send Email</div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                        Send offer letter email
                      </label>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">Start Date override</div>
                      <Input type="date" value={overrideStart} onChange={(e) => setOverrideStart(e.target.value)} />
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">End Date override</div>
                      <Input type="date" value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Offer subject</div>
                    <Input value={offerSubject} onChange={(e) => setOfferSubject(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Offer body (HTML)</div>
                    <textarea
                      value={offerBody}
                      onChange={(e) => setOfferBody(e.target.value)}
                      className="w-full h-28 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="destructive" onClick={() => void reject(a.id)}>
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                    <Button variant="neon" onClick={() => void approve(a.id)}>
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No applications found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
