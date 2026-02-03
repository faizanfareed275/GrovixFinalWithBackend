import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type V2DashboardResponse = {
  ok: boolean;
  enrollment: {
    id: string;
    internshipId: number;
    batchId: number | null;
    status: string;
    accessMode: string;
    startDate: string;
    endDate: string;
    currentBadge: string;
  };
  certificate: {
    id: string;
    certificateCode: string;
    status: string;
    issuedAt: string;
    fileId: string | null;
    qrPayload: string | null;
    pdfUrl: string | null;
  } | null;
  assignments: Array<{
    id: string;
    status: string;
    unlockAt: string | null;
    deadlineAt: string | null;
    locked: boolean;
    canStart: boolean;
    canSubmit: boolean;
    maxAttempts: number;
    remainingAttempts: number;
    latestGradeStatus: string;
    passedAt: string | null;
    template: {
      id: string;
      title: string;
      description: string;
      xpReward: number;
      badgeLevel: string;
      rubricJson: any;
      autoPass: boolean;
    };
    latestAttempt: {
      id: string;
      attemptNo: number;
      submittedAt: string;
      gradeStatus: string;
      feedback: string | null;
    } | null;
  }>;
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const idx = result.indexOf(",");
      if (idx === -1) return resolve("");
      return resolve(result.slice(idx + 1));
    };
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

export default function InternshipDashboardV2() {
  const { id } = useParams();
  const navigate = useNavigate();

  const defaultApiUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : "http://localhost:4000";
  const apiUrl = (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<V2DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return data?.assignments.find((a) => a.id === selectedAssignmentId) || null;
  }, [data?.assignments, selectedAssignmentId]);

  const progress = useMemo(() => {
    const list = data?.assignments || [];
    const eligible = list.filter((a) => a.status !== "SKIPPED");
    const total = eligible.length;
    const passed = eligible.filter((a) => !!a.passedAt).length;
    const pending = eligible.filter((a) => a.latestAttempt?.gradeStatus === "PENDING").length;
    const percent = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, pending, percent };
  }, [data?.assignments]);

  const downloadUrl = useMemo(() => {
    const u = data?.certificate?.pdfUrl;
    if (!u) return null;
    return `${apiUrl}${u}`;
  }, [data?.certificate?.pdfUrl, apiUrl]);

  const refetch = async () => {
    if (!id) return;
    const d = await apiFetch<V2DashboardResponse>(`/internships/${encodeURIComponent(id)}/v2/dashboard`);
    setData(d);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        await refetch();
      } catch (e: any) {
        const status = e?.status;
        if (status === 401) setError("Please sign in to continue");
        else if (status === 403) setError("You are not enrolled or access is restricted");
        else setError("Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !selectedAssignment) return;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        type: "TEXT",
        content,
        notes,
      };
      if (file) {
        const bytesB64 = await toBase64(file);
        payload.file = {
          bytesB64,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
        };
      }

      await apiFetch(`/internships/${encodeURIComponent(id)}/v2/assignments/${encodeURIComponent(selectedAssignment.id)}/attempts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setContent("");
      setNotes("");
      setFile(null);
      await refetch();
    } catch (e: any) {
      const status = e?.status;
      const code = e?.body?.error;
      if (status === 403 && code === "deadline_passed") setError("Deadline passed. This task is locked.");
      else if (status === 403 && code === "no_attempts_left") setError("No submission attempts left.");
      else if (status === 403 && code === "read_only") setError("Your internship access is read-only.");
      else if (status === 403 && code === "pending_review") setError("Your last submission is pending review. Please wait for grading.");
      else if (status === 403 && code === "already_passed") setError("This task is already passed.");
      else if (status === 403 && code === "skipped") setError("This task was skipped by admin.");
      else if (status === 403 && code === "locked") setError("This task is locked.");
      else if (status === 403 && code === "enrollment_not_started") setError("Your internship period has not started yet.");
      else if (status === 403 && code === "enrollment_ended") setError("Your internship period has ended.");
      else setError("Failed to submit attempt");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!id || !selectedAssignment) return;
    setStarting(true);
    try {
      await apiFetch(`/internships/${encodeURIComponent(id)}/v2/assignments/${encodeURIComponent(selectedAssignment.id)}/start`, {
        method: "POST",
      });
      await refetch();
    } catch (e: any) {
      const status = e?.status;
      const code = e?.body?.error;
      if (status === 403 && code === "deadline_passed") setError("Deadline passed. This task is locked.");
      else if (status === 403 && code === "read_only") setError("Your internship access is read-only.");
      else if (status === 403 && code === "already_passed") setError("This task is already passed.");
      else if (status === 403 && code === "skipped") setError("This task was skipped by admin.");
      else if (status === 403 && code === "locked") setError("This task is locked.");
      else if (status === 403 && code === "enrollment_not_started") setError("Your internship period has not started yet.");
      else if (status === 403 && code === "enrollment_ended") setError("Your internship period has ended.");
      else setError("Failed to start task");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="glass-card p-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Intern Dashboard (v2)</div>
                <h1 className="text-2xl font-display font-bold truncate">Timeline Tasks</h1>
                {data?.enrollment && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Badge: <span className="text-foreground">{data.enrollment.currentBadge}</span> • Status:{" "}
                    <span className="text-foreground">{data.enrollment.status}</span> • Access:{" "}
                    <span className="text-foreground">{data.enrollment.accessMode}</span>
                    {data?.assignments && (
                      <>
                        <span className="text-muted-foreground"> • </span>
                        Progress:{" "}
                        <span className="text-foreground">{progress.passed}</span>/{progress.total} ({progress.percent}%)
                        <span className="text-muted-foreground"> • </span>
                        Pending:{" "}
                        <span className="text-foreground">{progress.pending}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => navigate("/internships")}>Back</Button>
            </div>

            {loading && <div className="glass-card p-6">Loading…</div>}
            {error && <div className="glass-card p-6 text-destructive">{error}</div>}

            {data && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 glass-card p-6">
                  <div className="font-display font-bold">Certificate</div>
                  {!data.certificate ? (
                    <div className="mt-2 text-sm text-muted-foreground">Not issued yet.</div>
                  ) : (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        <div>
                          ID: <span className="text-foreground font-medium">{data.certificate.certificateCode}</span>
                        </div>
                        <div>
                          Status: <span className="text-foreground">{data.certificate.status}</span>
                        </div>
                        <div>
                          Issued: <span className="text-foreground">{new Date(data.certificate.issuedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      {downloadUrl && (
                        <a href={downloadUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline">Download PDF</Button>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-2 glass-card p-6">
                  <div className="font-display font-bold mb-3">Assignments</div>
                  <div className="space-y-3">
                    {data.assignments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAssignmentId(a.id)}
                        className={`w-full text-left rounded-xl border p-4 transition-colors ${
                          selectedAssignmentId === a.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{a.template.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Badge: {a.template.badgeLevel} • XP: {a.template.xpReward}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            Attempts: {a.remainingAttempts}/{a.maxAttempts}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Status: {a.status}
                          {a.status === "SUBMITTED"
                            ? " • Awaiting grading"
                            : a.locked
                              ? " • Locked"
                              : " • Open"}
                          {a.latestAttempt?.gradeStatus === "PENDING" ? " • Pending review" : ""}
                          {a.deadlineAt ? ` • Deadline: ${new Date(a.deadlineAt).toLocaleString()}` : ""}
                          {a.latestGradeStatus ? ` • Grade: ${a.latestGradeStatus}` : ""}
                        </div>
                        {a.latestAttempt?.feedback && (
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            Feedback: {a.latestAttempt.feedback}
                          </div>
                        )}
                      </button>
                    ))}
                    {data.assignments.length === 0 && (
                      <div className="text-sm text-muted-foreground">No assignments yet.</div>
                    )}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="font-display font-bold mb-3">Submit Attempt</div>
                  {!selectedAssignment ? (
                    <div className="text-sm text-muted-foreground">Select an assignment to submit.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">{selectedAssignment.template.title}</div>
                      <div className="text-xs text-muted-foreground">{selectedAssignment.template.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Remaining attempts: {selectedAssignment.remainingAttempts}/{selectedAssignment.maxAttempts}
                      </div>

                      {selectedAssignment.canStart && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => void handleStart()}
                          disabled={starting || !selectedAssignment.canStart}
                        >
                          {starting ? "Starting…" : "Start Task"}
                        </Button>
                      )}

                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full h-28 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none text-sm"
                        placeholder="Write your submission..."
                        disabled={submitting || !selectedAssignment.canSubmit}
                      />

                      <Input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        disabled={submitting || !selectedAssignment.canSubmit}
                      />

                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        disabled={submitting || !selectedAssignment.canSubmit}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted/80"
                      />

                      {!selectedAssignment.canSubmit && (
                        <div className="text-xs text-muted-foreground">
                          {data?.enrollment?.accessMode === "READ_ONLY"
                            ? "Your internship access is read-only."
                            : data?.enrollment?.endDate && new Date(data.enrollment.endDate).getTime() < Date.now()
                              ? "Your internship period has ended."
                              : data?.enrollment?.startDate && new Date(data.enrollment.startDate).getTime() > Date.now()
                                ? "Your internship period has not started yet."
                                : selectedAssignment.status === "SKIPPED"
                                  ? "This task was skipped by admin."
                                  : selectedAssignment.status === "SUBMITTED"
                                    ? "Submitted — awaiting grading."
                                    : selectedAssignment.unlockAt && new Date(selectedAssignment.unlockAt).getTime() > Date.now()
                                      ? "Not unlocked yet."
                                      : selectedAssignment.locked
                                        ? "Locked — deadline passed."
                                        : selectedAssignment.remainingAttempts <= 0
                                          ? "No submission attempts left."
                                          : selectedAssignment.latestAttempt?.gradeStatus === "PENDING"
                                            ? "Pending review — please wait for grading."
                                            : "Submission is currently disabled for this task."}
                        </div>
                      )}

                      <Button
                        variant="neon"
                        className="w-full"
                        onClick={() => void handleSubmit()}
                        disabled={
                          submitting ||
                          !content.trim() ||
                          !selectedAssignment.canSubmit
                        }
                      >
                        {submitting ? "Submitting…" : "Submit"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
