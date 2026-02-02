import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type AttemptRow = {
  id: string;
  assignmentId: string;
  attemptNo: number;
  submittedAt: string;
  type: string;
  content: string;
  notes: string | null;
  gradeStatus: string;
  feedback: string | null;
  score: number | null;
  maxScore: number | null;
  file: { id: string; fileName: string; mimeType: string; sizeBytes: number } | null;
  assignment: {
    id: string;
    template: { id: string; title: string; badgeLevel: string; xpReward: number };
    enrollment: {
      id: string;
      user: { id: string; name: string; email: string };
      batch: { id: number; name: string; batchCode: string } | null;
    };
  };
};

const gradeStatuses = ["PENDING", "PASSED", "FAILED"] as const;

export default function AdminInternshipV2Attempts() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);

  const [gradeStatusFilter, setGradeStatusFilter] = useState<string>("PENDING");
  const [query, setQuery] = useState("");

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInternships = async () => {
    try {
      const d = await apiFetch<{ internships: InternshipItem[] }>("/internships");
      const list = Array.isArray(d?.internships) ? d.internships : [];
      setInternships(list);
      if (list[0]?.id) setInternshipId(list[0].id);
    } catch {
      setInternships([]);
    }
  };

  const loadAttempts = async (id: number, gradeStatus: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (gradeStatus) qs.set("gradeStatus", gradeStatus);
      const d = await apiFetch<{ attempts: AttemptRow[] }>(
        `/internships/${encodeURIComponent(String(id))}/admin/v2/attempts?${qs.toString()}`
      );
      setAttempts(Array.isArray(d?.attempts) ? d.attempts : []);
    } catch {
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInternships().catch(() => {});
  }, []);

  useEffect(() => {
    if (!internshipId) return;
    loadAttempts(internshipId, gradeStatusFilter).catch(() => {});
  }, [internshipId, gradeStatusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter((a) => {
      const user = a.assignment?.enrollment?.user;
      const t = a.assignment?.template;
      const batch = a.assignment?.enrollment?.batch;
      return (
        String(user?.name || "").toLowerCase().includes(q) ||
        String(user?.email || "").toLowerCase().includes(q) ||
        String(t?.title || "").toLowerCase().includes(q) ||
        String(batch?.batchCode || "").toLowerCase().includes(q) ||
        String(a.content || "").toLowerCase().includes(q)
      );
    });
  }, [attempts, query]);

  const gradeAttempt = async (attemptId: string, gradeStatus: string, patch?: { feedback?: string; score?: number | null; maxScore?: number | null }) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/attempts/${encodeURIComponent(attemptId)}/grade`, {
        method: "POST",
        body: JSON.stringify({
          gradeStatus,
          feedback: patch?.feedback ?? null,
          score: patch?.score ?? null,
          maxScore: patch?.maxScore ?? null,
        }),
      });
      toast.success("Graded");
      await loadAttempts(internshipId, gradeStatusFilter);
    } catch {
      toast.error("Failed to grade attempt");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship v2 Attempts</h1>
          <p className="text-muted-foreground mt-1">Review and grade intern submissions (manual grading).</p>
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
            value={gradeStatusFilter}
            onChange={(e) => setGradeStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {gradeStatuses.map((s) => (
              <option key={s} value={s} className="bg-card">
                {s}
              </option>
            ))}
          </select>

          <div className="w-72 max-w-full">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user/task/batch..." />
          </div>

          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">User</div>
          <div className="col-span-3">Task</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-2">Grade</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((a) => {
            const user = a.assignment.enrollment.user;
            const task = a.assignment.template;
            const batch = a.assignment.enrollment.batch;
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    {batch && <div className="text-xs text-muted-foreground truncate">{batch.batchCode}</div>}
                  </div>

                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{task.title}</div>
                    <div className="text-xs text-muted-foreground truncate">Badge: {task.badgeLevel} • XP: {task.xpReward}</div>
                  </div>

                  <div className="col-span-2 text-xs text-muted-foreground">
                    {new Date(a.submittedAt).toLocaleString()}
                  </div>

                  <div className="col-span-2">
                    <select
                      value={a.gradeStatus}
                      onChange={(e) => void gradeAttempt(a.id, e.target.value)}
                      className="w-full px-2 py-1 rounded-md bg-card/60 border border-border text-foreground focus:outline-none"
                    >
                      {gradeStatuses.map((s) => (
                        <option key={s} value={s} className="bg-card">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.alert(`Submission (${a.type})\n\n${a.content}\n\nNotes: ${a.notes || ""}`);
                      }}
                      title="View submission"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {a.file?.id && (
                      <a href={`/files/${encodeURIComponent(a.file.id)}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">File</Button>
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid sm:grid-cols-12 gap-2 items-start">
                  <div className="sm:col-span-8">
                    <div className="text-xs text-muted-foreground mb-1">Feedback</div>
                    <textarea
                      defaultValue={a.feedback || ""}
                      className="w-full h-20 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
                      placeholder="Write feedback…"
                      onBlur={(e) => {
                        const v = e.target.value;
                        void gradeAttempt(a.id, a.gradeStatus, { feedback: v, score: a.score, maxScore: a.maxScore });
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Score</div>
                    <Input
                      defaultValue={a.score === null || a.score === undefined ? "" : String(a.score)}
                      placeholder="e.g. 80"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const n = v ? Number(v) : null;
                        void gradeAttempt(a.id, a.gradeStatus, { feedback: a.feedback || "", score: n, maxScore: a.maxScore });
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Max</div>
                    <Input
                      defaultValue={a.maxScore === null || a.maxScore === undefined ? "" : String(a.maxScore)}
                      placeholder="e.g. 100"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const n = v ? Number(v) : null;
                        void gradeAttempt(a.id, a.gradeStatus, { feedback: a.feedback || "", score: a.score, maxScore: n });
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No attempts found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
