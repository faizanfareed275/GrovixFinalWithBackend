import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

export type ReportTargetType = "POST" | "POST_COMMENT" | "DISCUSSION" | "DISCUSSION_REPLY" | "USER";
export type ReportSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReportDialogTarget = {
  targetType: ReportTargetType;
  targetLegacyId?: number;
  targetNodeId?: number;
  targetUserId?: string;
  label?: string;
};

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportDialogTarget | null;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState<ReportSeverity>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => {
    if (!target) return "Report";
    if (target.targetType === "POST") return "Report post";
    if (target.targetType === "POST_COMMENT") return "Report comment";
    if (target.targetType === "DISCUSSION") return "Report discussion";
    if (target.targetType === "DISCUSSION_REPLY") return "Report reply";
    return "Report user";
  }, [target]);

  const canSubmit = !!target && reason.trim().length > 0 && !submitting;

  const resetForm = () => {
    setReason("");
    setDetails("");
    setSeverity("MEDIUM");
    setSubmitting(false);
  };

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) return;

    const payload: any = {
      targetType: target.targetType,
      reason: reason.trim(),
      details: details.trim() ? details.trim() : null,
      severity,
    };

    if (target.targetType === "USER") {
      payload.targetUserId = String(target.targetUserId || "");
    } else {
      payload.targetLegacyId = target.targetLegacyId;
      if (target.targetNodeId !== undefined) payload.targetNodeId = target.targetNodeId;
    }

    setSubmitting(true);
    try {
      await apiFetch("/community/reports", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Report submitted");
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) toast.error("Please sign in to continue");
      else toast.error("Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Help us understand what happened. Reports are reviewed by moderators.
            {target?.label ? ` (${target.label})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. harassment, spam, hate speech" maxLength={200} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Severity</label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as ReportSeverity)}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Details (optional)</label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Add any context or links (optional)" maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
