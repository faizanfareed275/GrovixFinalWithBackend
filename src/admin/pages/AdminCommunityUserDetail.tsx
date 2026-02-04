import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, ChevronLeft, RefreshCcw, ShieldAlert, User, AlertTriangle } from "lucide-react";
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

type ActionType = "ISSUE_WARNING" | "TEMP_BAN" | "PERM_BAN";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  xp: number;
  isBanned: boolean;
  bannedAt: string | null;
  bannedUntil: string | null;
  banReason: string | null;
  bannedBy: string | null;
};

type ActivityPost = { id: number; content: string; status: string; createdAt: string };
type ActivityDiscussion = { id: number; title: string; category: string; status: string; createdAt: string };

type EnforcementWarning = { id: string; reason: string; guidelineId: string | null; createdAt: string; actorUserId: string };
type EnforcementBan = { id: string; actionType: string; reason: string; durationHours: number | null; createdAt: string; actorUserId: string };

type Payload = {
  user: UserInfo;
  activity: {
    posts: ActivityPost[];
    discussions: ActivityDiscussion[];
    savedPostIds: number[];
    followers: string[];
    following: string[];
  };
  enforcement: {
    warnings: EnforcementWarning[];
    bans: EnforcementBan[];
  };
};

export default function AdminCommunityUserDetail() {
  const { id } = useParams();
  const userId = String(id || "");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payload | null>(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>("ISSUE_WARNING");
  const [reason, setReason] = useState("");
  const [guidelineId, setGuidelineId] = useState("");
  const [durationHours, setDurationHours] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const d = await apiFetch<Payload>(`/community/admin/users/${encodeURIComponent(userId)}`);
      setData(d || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const startAction = (type: ActionType) => {
    setActionType(type);
    setReason("");
    setGuidelineId("");
    setDurationHours("");
    setActionOpen(true);
  };

  const submitAction = async () => {
    if (!userId) return;
    if (!reason.trim()) return;

    const payload: any = {
      actionType,
      targetType: "USER",
      targetUserId: userId,
      reason: reason.trim(),
      guidelineId: guidelineId.trim() ? guidelineId.trim() : null,
    };

    if (actionType === "TEMP_BAN") {
      const n = Number(durationHours);
      payload.durationHours = Number.isFinite(n) ? n : undefined;
    }

    setSubmitting(true);
    try {
      await apiFetch("/community/admin/moderate", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Action applied");
      setActionOpen(false);
      await load();
    } catch (e: any) {
      if (Number(e?.status) === 403) toast.error("Not allowed");
      else toast.error("Failed to apply action");
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const u = data?.user;
    const a = data?.activity;
    const e = data?.enforcement;
    return {
      user: u,
      posts: a?.posts || [],
      discussions: a?.discussions || [],
      followers: a?.followers || [],
      following: a?.following || [],
      savedPostIds: a?.savedPostIds || [],
      warnings: e?.warnings || [],
      bans: e?.bans || [],
    };
  }, [data]);

  if (!userId) {
    return (
      <div className="glass-card p-6">
        <div className="text-muted-foreground">Invalid user id</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-display font-bold mt-3">Community User</h1>
          <div className="text-sm text-muted-foreground mt-1 break-all">{userId}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => load().catch(() => {})} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => startAction("ISSUE_WARNING")}>
            <ShieldAlert className="w-4 h-4 mr-2" />
            Warn
          </Button>
          <Button variant="outline" onClick={() => startAction("TEMP_BAN")}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Temp ban
          </Button>
          <Button variant="destructive" onClick={() => startAction("PERM_BAN")}>
            <Ban className="w-4 h-4 mr-2" />
            Perm ban
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{stats.user?.name || ""}</div>
              <div className="text-xs text-muted-foreground truncate">{stats.user?.email || ""}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Role</div>
              <div className="font-medium mt-1">{stats.user?.role || ""}</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">XP</div>
              <div className="font-medium mt-1">{String(stats.user?.xp ?? 0)}</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Followers</div>
              <div className="font-medium mt-1">{String(stats.followers.length)}</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Following</div>
              <div className="font-medium mt-1">{String(stats.following.length)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="text-sm font-semibold">Ban status</div>
            <div className="text-sm text-muted-foreground mt-2">
              {stats.user?.isBanned ? "BANNED" : "Not banned"}
            </div>
            {stats.user?.isBanned && (
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                <div>Reason: {stats.user?.banReason || ""}</div>
                <div>Until: {stats.user?.bannedUntil ? new Date(stats.user.bannedUntil).toLocaleString() : "Permanent"}</div>
                <div>By: {stats.user?.bannedBy || ""}</div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2 space-y-6">
          <div>
            <div className="text-sm text-muted-foreground">Community activity</div>
            <div className="text-xl font-display font-bold mt-1">Posts & Discussions</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold">Posts ({stats.posts.length})</div>
              <div className="divide-y divide-border max-h-80 overflow-auto">
                {stats.posts.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">#{p.id}</div>
                      <div className="text-xs text-muted-foreground">{p.status}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleString()}</div>
                    <div className="text-sm text-foreground mt-2 whitespace-pre-line break-words line-clamp-3">{p.content}</div>
                  </div>
                ))}
                {stats.posts.length === 0 && <div className="p-6 text-center text-muted-foreground">No posts.</div>}
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold">Discussions ({stats.discussions.length})</div>
              <div className="divide-y divide-border max-h-80 overflow-auto">
                {stats.discussions.map((d) => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium truncate">#{d.id} {d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.status}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{d.category}</div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {stats.discussions.length === 0 && <div className="p-6 text-center text-muted-foreground">No discussions.</div>}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold">Warnings ({stats.warnings.length})</div>
              <div className="divide-y divide-border max-h-72 overflow-auto">
                {stats.warnings.map((w) => (
                  <div key={w.id} className="px-4 py-3">
                    <div className="text-sm text-foreground whitespace-pre-line break-words">{w.reason}</div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(w.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1 break-all">Guideline: {w.guidelineId || ""}</div>
                  </div>
                ))}
                {stats.warnings.length === 0 && <div className="p-6 text-center text-muted-foreground">No warnings.</div>}
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold">Bans ({stats.bans.length})</div>
              <div className="divide-y divide-border max-h-72 overflow-auto">
                {stats.bans.map((b) => (
                  <div key={b.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{b.actionType}</div>
                      <div className="text-xs text-muted-foreground">{b.durationHours ? `${b.durationHours}h` : ""}</div>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-line break-words mt-2">{b.reason}</div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(b.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {stats.bans.length === 0 && <div className="p-6 text-center text-muted-foreground">No bans.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Moderate user</DialogTitle>
            <DialogDescription>Applies an enforcement action to this user.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISSUE_WARNING">Issue warning</SelectItem>
                  <SelectItem value="TEMP_BAN">Temp ban</SelectItem>
                  <SelectItem value="PERM_BAN">Perm ban</SelectItem>
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
              <Input value={guidelineId} onChange={(e) => setGuidelineId(e.target.value)} placeholder="guideline id" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={submitting || !reason.trim()}>
              {submitting ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
