import { useEffect, useState } from "react";
import { Users, MessageSquare, ClipboardCheck, Target, ShieldAlert, MessageCircle, BarChart3, Layers, Briefcase } from "lucide-react";
import { apiFetch } from "@/lib/api";

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

export default function AdminDashboard() {
  const [communityStats, setCommunityStats] = useState<{
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
  } | null>(null);

  const [v2Stats, setV2Stats] = useState<{
    pendingAttempts: number;
    lockedAssignments: number;
    activeEnrollments: number;
    pendingApplications: number;
  } | null>(null);

  useEffect(() => {
    apiFetch<{
      totals: { posts: number; discussions: number; comments: number; discussionReplies: number; polls: number };
      moderation: { activeUsers7d: number; reportedOpen: number; removedContent: number };
    }>("/community/admin/dashboard")
      .then((d) => {
        if (d?.totals && d?.moderation) setCommunityStats(d);
      })
      .catch(() => setCommunityStats(null));
  }, []);

  useEffect(() => {
    apiFetch<{ ok: boolean; stats: { pendingAttempts: number; lockedAssignments: number; activeEnrollments: number; pendingApplications: number } }>(
      "/internships/admin/v2/stats"
    )
      .then((d) => {
        if (d?.stats) setV2Stats(d.stats);
      })
      .catch(() => setV2Stats(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your app data and activity.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Active users (7d)" value={String(communityStats?.moderation.activeUsers7d ?? 0)} icon={Users} />
        <StatCard title="Open reports" value={String(communityStats?.moderation.reportedOpen ?? 0)} icon={ShieldAlert as any} />
        <StatCard title="Removed content" value={String(communityStats?.moderation.removedContent ?? 0)} icon={Layers as any} />
        <StatCard title="Community posts" value={String(communityStats?.totals.posts ?? 0)} icon={MessageSquare} />
        <StatCard title="Discussions" value={String(communityStats?.totals.discussions ?? 0)} icon={MessageCircle as any} />
        <StatCard title="Comments + replies" value={String((communityStats?.totals.comments ?? 0) + (communityStats?.totals.discussionReplies ?? 0))} icon={BarChart3 as any} />
      </div>

      {v2Stats && (
        <>
          <div className="glass-card p-6">
            <div className="text-sm text-muted-foreground">Internships v2</div>
            <div className="text-xl font-display font-bold mt-1">Operational KPIs</div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Pending Attempts" value={String(v2Stats.pendingAttempts)} icon={ClipboardCheck as any} />
            <StatCard title="Locked Assignments" value={String(v2Stats.lockedAssignments)} icon={Target as any} />
            <StatCard title="Active Enrollments" value={String(v2Stats.activeEnrollments)} icon={Briefcase} />
            <StatCard title="Pending Applications" value={String(v2Stats.pendingApplications)} icon={Users} />
          </div>
        </>
      )}
    </div>
  );
}
