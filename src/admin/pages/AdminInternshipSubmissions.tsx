import { useEffect, useMemo, useState } from "react";
import { Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { internships as internshipsCatalog } from "@/data/internships";
import {
  readSubmissions,
  writeSubmissions,
  readTasks,
  type InternshipTaskSubmissionRecord,
} from "@/data/internshipAssignments";

export default function AdminInternshipSubmissions() {
  const internships = useMemo(() => internshipsCatalog, []);
  const [internshipId, setInternshipId] = useState<number>(internships[0]?.id || 1);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<InternshipTaskSubmissionRecord[]>([]);

  useEffect(() => {
    setRecords(readSubmissions(internshipId));
  }, [internshipId]);

  const tasks = useMemo(() => readTasks(internshipId, []), [internshipId]);
  const taskTitleById = useMemo(() => new Map(tasks.map(t => [t.id, t.title])), [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      String(r.userId || "").toLowerCase().includes(q) ||
      String(r.userName || "").toLowerCase().includes(q) ||
      String(taskTitleById.get(r.taskId) || "").toLowerCase().includes(q) ||
      String(r.submission?.notes || "").toLowerCase().includes(q)
    );
  }, [records, query, taskTitleById]);

  const persist = (next: InternshipTaskSubmissionRecord[]) => {
    setRecords(next);
    writeSubmissions(internshipId, next);
  };

  const updateRecord = (idx: number, patch: Partial<InternshipTaskSubmissionRecord>) => {
    const next = records.slice();
    next[idx] = { ...next[idx], ...patch };
    persist(next);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship Submissions</h1>
          <p className="text-muted-foreground mt-1">Review each user submission per task.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={internshipId}
            onChange={(e) => setInternshipId(parseInt(e.target.value))}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {internships.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">{i.title}</option>
            ))}
          </select>
          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user/task..." />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-2">User</div>
          <div className="col-span-3">Task</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((r, idx) => (
            <div key={`${r.userId}_${r.taskId}_${r.submission.submittedAt}_${idx}`} className="px-4 py-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2 min-w-0">
                  <div className="font-medium truncate">{r.userName || r.userId}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.userId}</div>
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{taskTitleById.get(r.taskId) || `Task #${r.taskId}`}</div>
                  <div className="text-xs text-muted-foreground truncate">Task ID: {r.taskId}</div>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">{r.submission.type}</div>
                <div className="col-span-2">
                  <select
                    value={r.status}
                    onChange={(e) => updateRecord(idx, { status: e.target.value as any, reviewedAt: new Date().toISOString() })}
                    className="w-full px-2 py-1 rounded-md bg-card/60 border border-border text-foreground focus:outline-none"
                  >
                    <option value="submitted" className="bg-card">submitted</option>
                    <option value="approved" className="bg-card">approved</option>
                    <option value="rejected" className="bg-card">rejected</option>
                  </select>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{r.submission.submittedAt}</div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const text = r.submission.type === "file" ? (r.submission.fileName || "file") : r.submission.content;
                      window.alert(`Submission (${r.submission.type})\n\n${text}\n\nNotes: ${r.submission.notes || ""}`);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-12 gap-2 items-start">
                <div className="sm:col-span-11">
                  <div className="text-xs text-muted-foreground mb-1">Admin feedback (optional)</div>
                  <textarea
                    value={r.adminFeedback || ""}
                    onChange={(e) => updateRecord(idx, { adminFeedback: e.target.value })}
                    className="w-full h-20 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
                    placeholder="Write feedback for the user..."
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateRecord(idx, { reviewedAt: new Date().toISOString() })}
                    title="Save"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No submissions found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
