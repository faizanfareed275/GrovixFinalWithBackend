import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

function toIsoDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toISOString();
}

export default function AdminInternshipV2Batches() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);

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
              <div className="col-span-3 text-xs text-muted-foreground">
                Open: {b.applicationOpenAt ? new Date(b.applicationOpenAt).toLocaleDateString() : "—"}
                <br />
                Close: {b.applicationCloseAt ? new Date(b.applicationCloseAt).toLocaleDateString() : "—"}
              </div>
            </div>
          ))}
          {batches.length === 0 && <div className="p-8 text-center text-muted-foreground">No batches found.</div>}
        </div>
      </div>
    </div>
  );
}
