import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type InternshipItem = {
  id: number;
  title: string;
  company: string;
};

type AssignmentRow = {
  id: string;
  status: string;
  unlockAt: string | null;
  deadlineAt: string | null;
  lockedAt: string | null;
  maxAttempts: number;
  remainingAttempts: number;
  latestGradeStatus: string;
  passedAt: string | null;
  template: {
    id: string;
    title: string;
    badgeLevel: string;
    xpReward: number;
  };
  enrollment: {
    id: string;
    user: { id: string; name: string; email: string };
    batch: { id: number; name: string; batchCode: string } | null;
  };
};

const statuses = ["", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "GRADED", "LOCKED", "SKIPPED"] as const;

export default function AdminInternshipV2Assignments() {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [internshipId, setInternshipId] = useState<number>(1);

  const [batchId, setBatchId] = useState<string>("");
  const [enrollmentId, setEnrollmentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [query, setQuery] = useState<string>("");

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const internshipIdFromQuery = qs.get("internshipId");
    const batchIdFromQuery = qs.get("batchId");
    const enrollmentIdFromQuery = qs.get("enrollmentId");
    const statusFromQuery = qs.get("status");
    const qFromQuery = qs.get("q");

    if (internshipIdFromQuery) {
      const idNum = Number(internshipIdFromQuery);
      if (Number.isFinite(idNum) && idNum > 0) setInternshipId(idNum);
    }
    if (batchIdFromQuery !== null) setBatchId(batchIdFromQuery);
    if (enrollmentIdFromQuery !== null) setEnrollmentId(enrollmentIdFromQuery);
    if (statusFromQuery !== null) setStatusFilter(statusFromQuery.toUpperCase());
    if (qFromQuery !== null) setQuery(qFromQuery);
  }, []);

  const loadInternships = async () => {
    try {
      const d = await apiFetch<{ internships: InternshipItem[] }>("/internships");
      const list = Array.isArray(d?.internships) ? d.internships : [];
      setInternships(list);
      if (list[0]?.id && !list.some((x) => x.id === internshipId)) setInternshipId(list[0].id);
    } catch {
      setInternships([]);
    }
  };

  const loadAssignments = async () => {
    if (!internshipId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (batchId.trim()) qs.set("batchId", batchId.trim());
      if (enrollmentId.trim()) qs.set("enrollmentId", enrollmentId.trim());
      if (statusFilter) qs.set("status", statusFilter);

      const url = `/internships/${encodeURIComponent(String(internshipId))}/admin/v2/assignments?${qs.toString()}`;
      const d = await apiFetch<{ assignments: AssignmentRow[] }>(url);
      setAssignments(Array.isArray(d?.assignments) ? d.assignments : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInternships().catch(() => {});
  }, []);

  useEffect(() => {
    if (!internshipId) return;
    loadAssignments().catch(() => {});
  }, [internshipId, batchId, enrollmentId, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const user = a.enrollment?.user;
      const batch = a.enrollment?.batch;
      const t = a.template;
      return (
        String(user?.name || "").toLowerCase().includes(q) ||
        String(user?.email || "").toLowerCase().includes(q) ||
        String(batch?.batchCode || "").toLowerCase().includes(q) ||
        String(t?.title || "").toLowerCase().includes(q) ||
        String(a.id || "").toLowerCase().includes(q) ||
        String(a.enrollment?.id || "").toLowerCase().includes(q)
      );
    });
  }, [assignments, query]);

  const skip = async (assignmentId: string) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/assignments/${encodeURIComponent(assignmentId)}/skip`, {
        method: "POST",
      });
      toast.success("Skipped");
      await loadAssignments();
    } catch {
      toast.error("Failed to skip assignment");
    }
  };

  const unskip = async (assignmentId: string) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/assignments/${encodeURIComponent(assignmentId)}/unskip`, {
        method: "POST",
      });
      toast.success("Unskipped");
      await loadAssignments();
    } catch {
      toast.error("Failed to unskip assignment");
    }
  };

  const reopen = async (assignmentId: string, resetAttempts: boolean) => {
    try {
      await apiFetch(`/internships/${encodeURIComponent(String(internshipId))}/admin/v2/assignments/${encodeURIComponent(assignmentId)}/reopen`, {
        method: "POST",
        body: JSON.stringify({ resetAttempts }),
      });
      toast.success("Reopened");
      await loadAssignments();
    } catch {
      toast.error("Failed to reopen assignment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Internship v2 Assignments</h1>
            <p className="text-muted-foreground mt-1">Browse and manage v2 task assignments (skip/unskip).</p>
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {statuses.map((s) => (
                <option key={s || "__all"} value={s} className="bg-card">
                  {s || "ALL"}
                </option>
              ))}
            </select>

            {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Batch ID (optional)" />
          <Input value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} placeholder="Enrollment ID (optional)" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user/task/batch..." />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">User</div>
          <div className="col-span-4">Assignment</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Attempts</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((a) => {
            const user = a.enrollment.user;
            const batch = a.enrollment.batch;
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    {batch && <div className="text-xs text-muted-foreground truncate">{batch.batchCode}</div>}
                  </div>

                  <div className="col-span-4 min-w-0">
                    <div className="font-medium truncate">{a.template.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Badge: {a.template.badgeLevel} • XP: {a.template.xpReward}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.id}</div>
                  </div>

                  <div className="col-span-2 text-xs text-muted-foreground">
                    <div>{a.status}</div>
                    <div>Grade: {a.latestGradeStatus}</div>
                  </div>

                  <div className="col-span-1 text-xs text-muted-foreground">
                    {a.remainingAttempts}/{a.maxAttempts}
                  </div>

                  <div className="col-span-2 flex justify-end gap-2">
                    {String(a.status) === "LOCKED" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => void reopen(a.id, false)}>
                          Reopen
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void reopen(a.id, true)}>
                          Reopen+Reset
                        </Button>
                      </>
                    )}
                    {String(a.status) === "SKIPPED" ? (
                      <Button variant="outline" size="sm" onClick={() => void unskip(a.id)}>
                        Unskip
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void skip(a.id)}>
                        Skip
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {a.unlockAt ? `Unlock: ${new Date(a.unlockAt).toLocaleString()}` : ""}
                  {a.deadlineAt ? ` • Deadline: ${new Date(a.deadlineAt).toLocaleString()}` : ""}
                  {a.passedAt ? ` • Passed: ${new Date(a.passedAt).toLocaleString()}` : ""}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">No assignments found.</div>}
        </div>
      </div>
    </div>
  );
}
