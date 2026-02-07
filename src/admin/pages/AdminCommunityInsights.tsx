import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCcw, ShieldAlert, Users, Layers, Flag } from "lucide-react";
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

type InsightsSeriesRow = {
  day: string;
  reportsCreated: number;
  actionsCreated: number;
  removeContentActions: number;
};

type InsightsResponse = {
  range: { start: string; end: string; days: number };
  series: InsightsSeriesRow[];
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

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needs = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"');
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function buildTrendCsv(rows: InsightsSeriesRow[]) {
  const header = ["day", "reportsCreated", "actionsCreated", "removeContentActions"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const values = [r.day, r.reportsCreated, r.actionsCreated, r.removeContentActions].map(csvEscape);
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export default function AdminCommunityInsights() {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [days, setDays] = useState<7 | 30>(7);
  const [trend, setTrend] = useState<InsightsResponse | null>(null);

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

  const loadTrend = useCallback(async () => {
    try {
      const d = await apiFetch<InsightsResponse>(`/community/admin/insights?days=${days}`);
      setTrend(d || null);
    } catch {
      setTrend(null);
    }
  }, [days]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    loadTrend().catch(() => {});
  }, [loadTrend]);

  const bySeverity = useMemo(() => toCountMap(reports.map((r) => r.severity)), [reports]);
  const byTargetType = useMemo(() => toCountMap(reports.map((r) => r.targetType)), [reports]);

  const maxReports = useMemo(() => {
    const xs = trend?.series || [];
    return xs.reduce((m, r) => Math.max(m, r.reportsCreated || 0), 0);
  }, [trend?.series]);

  const maxActions = useMemo(() => {
    const xs = trend?.series || [];
    return xs.reduce((m, r) => Math.max(m, r.actionsCreated || 0), 0);
  }, [trend?.series]);

  const maxRemovals = useMemo(() => {
    const xs = trend?.series || [];
    return xs.reduce((m, r) => Math.max(m, r.removeContentActions || 0), 0);
  }, [trend?.series]);

  const exportTrendCsv = () => {
    try {
      const rows = trend?.series || [];
      if (!rows.length) return;
      const csv = buildTrendCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const fileName = `community_trends_${days}d_${y}${m}${d}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Community Insights</h1>
          <p className="text-muted-foreground mt-1">High-level moderation KPIs and open report breakdowns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2">
            <Button variant={days === 7 ? "default" : "outline"} onClick={() => setDays(7)} disabled={loading}>
              7d
            </Button>
            <Button variant={days === 30 ? "default" : "outline"} onClick={() => setDays(30)} disabled={loading}>
              30d
            </Button>
          </div>
          <Button variant="outline" onClick={exportTrendCsv} disabled={!trend?.series?.length}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              load().catch(() => {});
              loadTrend().catch(() => {});
            }}
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
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

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="w-4 h-4 text-primary" />
            Trends (UTC days)
          </div>
          <div className="text-xs text-muted-foreground">Last {days} days</div>
        </div>
        <div className="p-5 space-y-4">
          {!trend?.series?.length ? (
            <div className="text-sm text-muted-foreground">No trend data.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">Reports created</div>
                <div className="mt-2 space-y-1">
                  {trend.series.map((r) => (
                    <div key={`rep-${r.day}`} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground">{r.day}</div>
                      <div className="flex-1 h-2 bg-muted rounded">
                        <div
                          className="h-2 bg-primary rounded"
                          style={{ width: `${maxReports ? Math.round((r.reportsCreated / maxReports) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="w-10 text-xs text-muted-foreground text-right">{r.reportsCreated}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Moderation actions created</div>
                <div className="mt-2 space-y-1">
                  {trend.series.map((r) => (
                    <div key={`act-${r.day}`} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground">{r.day}</div>
                      <div className="flex-1 h-2 bg-muted rounded">
                        <div
                          className="h-2 bg-secondary rounded"
                          style={{ width: `${maxActions ? Math.round((r.actionsCreated / maxActions) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="w-10 text-xs text-muted-foreground text-right">{r.actionsCreated}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Remove-content actions</div>
                <div className="mt-2 space-y-1">
                  {trend.series.map((r) => (
                    <div key={`rem-${r.day}`} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground">{r.day}</div>
                      <div className="flex-1 h-2 bg-muted rounded">
                        <div
                          className="h-2 bg-destructive rounded"
                          style={{ width: `${maxRemovals ? Math.round((r.removeContentActions / maxRemovals) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="w-10 text-xs text-muted-foreground text-right">{r.removeContentActions}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
