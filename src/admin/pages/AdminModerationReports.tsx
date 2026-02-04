import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Flag, RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
type ReportSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ReportTargetType = "POST" | "POST_COMMENT" | "DISCUSSION" | "DISCUSSION_REPLY" | "USER";

type ModerationActionType = "REMOVE_CONTENT" | "RESTORE_CONTENT" | "ISSUE_WARNING" | "TEMP_BAN" | "PERM_BAN";

type Report = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetLegacyId: number | null;
  targetNodeId: number | null;
  targetUserId: string | null;
  reason: string;
  details: string | null;
  severity: ReportSeverity;
  status: ReportStatus;
  guidelineId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionActionId: string | null;
  snapshot?: any;
};

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildReportsCsv(rows: Report[]) {
  const header = [
    "id",
    "status",
    "severity",
    "targetType",
    "targetLegacyId",
    "targetNodeId",
    "targetUserId",
    "reporterUserId",
    "reason",
    "details",
    "createdAt",
    "resolvedAt",
    "resolvedByUserId",
    "resolutionActionId",
    "guidelineId",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const values = [
      r.id,
      r.status,
      r.severity,
      r.targetType,
      r.targetLegacyId ?? "",
      r.targetNodeId ?? "",
      r.targetUserId ?? "",
      r.reporterUserId,
      r.reason,
      r.details ?? "",
      r.createdAt,
      r.resolvedAt ?? "",
      r.resolvedByUserId ?? "",
      r.resolutionActionId ?? "",
      r.guidelineId ?? "",
    ].map(csvEscape);
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function safeFilenamePart(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]+/g, "")
    .slice(0, 40);
}

function buildAdminReportsQuery(params: { status: ReportStatus; targetType: string; severity: string; q: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.targetType && params.targetType !== "ALL") sp.set("targetType", params.targetType);
  if (params.severity && params.severity !== "ALL") sp.set("severity", params.severity);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export default function AdminModerationReports() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [targetType, setTargetType] = useState<string>("ALL");
  const [severity, setSeverity] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);

  const [selected, setSelected] = useState<Report | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ModerationActionType>("REMOVE_CONTENT");
  const [actionReason, setActionReason] = useState("");
  const [actionGuidelineId, setActionGuidelineId] = useState("");
  const [durationHours, setDurationHours] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildAdminReportsQuery({ status, targetType, severity, q: debouncedQuery });
      const d = await apiFetch<{ reports: Report[] }>(`/community/admin/reports${qs}`);
      setReports(Array.isArray(d?.reports) ? d.reports : []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [status, targetType, severity, debouncedQuery]);

  useEffect(() => {
    fetchReports().catch(() => {});
  }, [fetchReports]);

  const filtered = useMemo(() => reports, [reports]);

  const exportCsv = () => {
    try {
      const csv = buildReportsCsv(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `reports_${safeFilenamePart(status)}_${safeFilenamePart(targetType)}_${safeFilenamePart(severity)}_${y}${m}${d}.csv`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const openDetails = (r: Report) => {
    setSelected(r);
    setDetailsOpen(true);
  };

  const dismissReport = async (r: Report) => {
    try {
      await apiFetch(`/community/admin/reports/${encodeURIComponent(r.id)}/dismiss`, { method: "POST" });
      toast.success("Report dismissed");
      fetchReports().catch(() => {});
    } catch {
      toast.error("Failed to dismiss report");
    }
  };

  const defaultActionForReport = (r: Report): ModerationActionType => {
    if (r.targetType === "USER") return "ISSUE_WARNING";
    return "REMOVE_CONTENT";
  };

  const startAction = (r: Report) => {
    setSelected(r);
    setActionType(defaultActionForReport(r));
    setActionReason(r.reason || "");
    setActionGuidelineId(r.guidelineId || "");
    setDurationHours("");
    setActionOpen(true);
  };

  const submitAction = async () => {
    if (!selected) return;
    if (!actionReason.trim()) return;

    const payload: any = {
      actionType,
      targetType: selected.targetType,
      targetLegacyId: selected.targetLegacyId,
      targetNodeId: selected.targetNodeId,
      targetUserId: selected.targetUserId,
      reason: actionReason.trim(),
      guidelineId: actionGuidelineId.trim() ? actionGuidelineId.trim() : null,
      reportId: selected.id,
    };

    if (actionType === "ISSUE_WARNING" || actionType === "TEMP_BAN" || actionType === "PERM_BAN") {
      payload.targetType = "USER";
      payload.targetUserId = selected.targetUserId;
    }

    if (actionType === "TEMP_BAN") {
      const n = Number(durationHours);
      payload.durationHours = Number.isFinite(n) ? n : undefined;
    }

    if ((payload.targetType === "USER" && !payload.targetUserId) || (!payload.targetType && payload.targetType !== "USER")) {
      toast.error("Missing target user id");
      return;
    }

    setSubmittingAction(true);
    try {
      await apiFetch("/community/admin/moderate", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Moderation action applied");
      setActionOpen(false);
      setDetailsOpen(false);
      fetchReports().catch(() => {});
    } catch (e: any) {
      if (Number(e?.status) === 403) toast.error("Not allowed");
      else toast.error("Failed to apply action");
    } finally {
      setSubmittingAction(false);
    }
  };

  const actionOptions = useMemo(() => {
    if (!selected) {
      return [
        { value: "REMOVE_CONTENT", label: "Remove content" },
        { value: "RESTORE_CONTENT", label: "Restore content" },
        { value: "ISSUE_WARNING", label: "Issue warning" },
        { value: "TEMP_BAN", label: "Temp ban" },
        { value: "PERM_BAN", label: "Perm ban" },
      ];
    }

    const base = [
      { value: "ISSUE_WARNING", label: "Issue warning" },
      { value: "TEMP_BAN", label: "Temp ban" },
      { value: "PERM_BAN", label: "Perm ban" },
    ];

    if (selected.targetType === "USER") return base;

    return [
      { value: "REMOVE_CONTENT", label: "Remove content" },
      { value: "RESTORE_CONTENT", label: "Restore content" },
      ...base,
    ];
  }, [selected]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports Queue</h1>
            <p className="text-muted-foreground mt-1">Review reports and apply moderation actions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => fetchReports().catch(() => {})} disabled={loading}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <Select value={status} onValueChange={(v) => setStatus(v as ReportStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-1">
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger>
                <SelectValue placeholder="Target type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All targets</SelectItem>
                <SelectItem value="POST">Post</SelectItem>
                <SelectItem value="POST_COMMENT">Post comment</SelectItem>
                <SelectItem value="DISCUSSION">Discussion</SelectItem>
                <SelectItem value="DISCUSSION_REPLY">Discussion reply</SelectItem>
                <SelectItem value="USER">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-1">
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All severities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-1">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search id/user/reason..." />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-3">Target</div>
          <div className="col-span-4">Reason</div>
          <div className="col-span-1">Severity</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-start">
              <div className="col-span-3 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <button type="button" className="font-medium text-left truncate hover:underline" onClick={() => openDetails(r)}>
                      {r.targetType}
                      {r.targetLegacyId !== null ? ` #${r.targetLegacyId}` : ""}
                      {r.targetNodeId !== null ? `:${r.targetNodeId}` : ""}
                    </button>
                    <div className="text-xs text-muted-foreground truncate">{r.targetUserId || ""}</div>
                  </div>
                </div>
              </div>
              <div className="col-span-4 text-sm text-foreground break-words whitespace-pre-line">{r.reason}</div>
              <div className="col-span-1 text-sm text-muted-foreground">{r.severity}</div>
              <div className="col-span-2 text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
              <div className="col-span-2 flex justify-end gap-2">
                {r.status === "OPEN" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startAction(r)}>
                      Moderate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissReport(r)}>
                      Dismiss
                    </Button>
                  </>
                )}
                {r.status !== "OPEN" && (
                  <Button size="sm" variant="ghost" onClick={() => openDetails(r)}>
                    View
                  </Button>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">{loading ? "Loading..." : "No reports found."}</div>
          )}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Report details</DialogTitle>
            <DialogDescription>Review context and take action.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="glass-card p-4">
                  <div className="text-xs text-muted-foreground">Target</div>
                  <div className="font-medium mt-1">
                    {selected.targetType}
                    {selected.targetLegacyId !== null ? ` #${selected.targetLegacyId}` : ""}
                    {selected.targetNodeId !== null ? `:${selected.targetNodeId}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Target user</div>
                  <div className="text-sm break-all">{selected.targetUserId || ""}</div>
                </div>

                <div className="glass-card p-4">
                  <div className="text-xs text-muted-foreground">Reporter</div>
                  <div className="text-sm break-all mt-1">{selected.reporterUserId}</div>
                  <div className="text-xs text-muted-foreground mt-2">Created</div>
                  <div className="text-sm">{new Date(selected.createdAt).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-2">Severity</div>
                  <div className="text-sm">{selected.severity}</div>
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="text-xs text-muted-foreground">Reason</div>
                <div className="text-sm text-foreground whitespace-pre-line mt-1">{selected.reason}</div>
                {selected.details && (
                  <>
                    <div className="text-xs text-muted-foreground mt-3">Details</div>
                    <div className="text-sm text-foreground whitespace-pre-line mt-1">{selected.details}</div>
                  </>
                )}
              </div>

              {selected.snapshot !== undefined && selected.snapshot !== null && (
                <div className="glass-card p-4">
                  <div className="text-xs text-muted-foreground">Snapshot</div>
                  <pre className="mt-2 text-xs overflow-auto max-h-72 whitespace-pre-wrap break-words">{JSON.stringify(selected.snapshot, null, 2)}</pre>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                {selected.status === "OPEN" && (
                  <>
                    {selected.targetUserId && (
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/admin/community-users/${encodeURIComponent(String(selected.targetUserId))}`)}
                      >
                        Open user
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => startAction(selected)}>
                      Moderate
                    </Button>
                    <Button variant="ghost" onClick={() => dismissReport(selected)}>
                      Dismiss
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Apply moderation action</DialogTitle>
            <DialogDescription>This will resolve the report if you proceed.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as ModerationActionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actionType === "TEMP_BAN" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (hours)</label>
                <Input value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="e.g. 24" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Guideline Id (optional)</label>
              <Input value={actionGuidelineId} onChange={(e) => setActionGuidelineId(e.target.value)} placeholder="guideline id" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} maxLength={500} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={submittingAction || !actionReason.trim()}>
              {submittingAction ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>

          <button
            type="button"
            onClick={() => setActionOpen(false)}
            className="absolute right-4 top-4 p-1 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
