import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCcw, ShieldAlert, Users, Layers, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type DashboardStats = {
  totals: {
    posts: number;
    discussions: number;
    comments: number;
    discussionReplies: number;
    polls: number;
  };
  moderation: {
    activeUsers7d: number;
    reportedOpen: number;
    removedContent: number;
  };
};

type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
type ReportSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ReportTargetType = "POST" | "POST_COMMENT" | "DISCUSSION" | "DISCUSSION_REPLY" | "USER";

type Report = {
  id: string;
  targetType: ReportTargetType;
  severity: ReportSeverity;
  status: ReportStatus;
  createdAt: string;
};

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-2xl font-display font-bold mt-1">{value}</div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function toCountMap<T extends string>(rows: Array<T>): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const r of rows) out[r] = (out[r] || 0) + 1;
  return out;
}

export default function AdminCommunityInsights() {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, rep] = await Promise.all([
        apiFetch<DashboardStats>("/community/admin/dashboard"),
        apiFetch<{ reports: Report[] }>("/community/admin/reports?status=OPEN"),
      ]);
      setDashboard(dash || null);
      setReports(Array.isArray(rep?.reports) ? rep.reports : []);
    } catch {
      setDashboard(null);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const bySeverity = useMemo(() => toCountMap(reports.map((r) => r.severity)), [reports]);
  const byTargetType = useMemo(() => toCountMap(reports.map((r) => r.targetType)), [reports]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Community Insights</h1>
          <p className="text-muted-foreground mt-1">High-level moderation KPIs and open report breakdowns.</p>
        </div>
        <Button variant="outline" onClick={() => load().catch(() => {})} disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active users (7d)" value={String(dashboard?.moderation.activeUsers7d ?? 0)} icon={Users} />
        <StatCard title="Open reports" value={String(dashboard?.moderation.reportedOpen ?? 0)} icon={ShieldAlert as any} />
        <StatCard title="Removed content" value={String(dashboard?.moderation.removedContent ?? 0)} icon={Layers as any} />
        <StatCard title="Total content" value={String((dashboard?.totals.posts ?? 0) + (dashboard?.totals.discussions ?? 0))} icon={BarChart3 as any} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Flag className="w-4 h-4 text-primary" />
              Open reports by severity
            </div>
            <div className="text-xs text-muted-foreground">{reports.length} reports loaded</div>
          </div>
          <div className="divide-y divide-border">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as ReportSeverity[]).map((s) => (
              <div key={s} className="px-5 py-3 flex items-center justify-between">
                <div className="text-sm font-medium">{s}</div>
                <div className="text-sm text-muted-foreground">{String(bySeverity[s] || 0)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Flag className="w-4 h-4 text-primary" />
              Open reports by target type
            </div>
            <div className="text-xs text-muted-foreground">{reports.length} reports loaded</div>
          </div>
          <div className="divide-y divide-border">
            {(["USER", "POST", "POST_COMMENT", "DISCUSSION", "DISCUSSION_REPLY"] as ReportTargetType[]).map((t) => (
              <div key={t} className="px-5 py-3 flex items-center justify-between">
                <div className="text-sm font-medium">{t}</div>
                <div className="text-sm text-muted-foreground">{String(byTargetType[t] || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="text-sm text-muted-foreground">Notes</div>
        <div className="text-sm text-muted-foreground mt-2">
          This page uses existing endpoints and loads up to 200 open reports (backend limit).
        </div>
      </div>
    </div>
  );
}
