import { useEffect, useMemo, useState } from "react";
import { Users, MessageSquare, Trophy, Briefcase, Calendar, ClipboardCheck, Target } from "lucide-react";
import { readJson, safeNumber } from "@/admin/lib/storage";
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
  const [v2Stats, setV2Stats] = useState<{
    pendingAttempts: number;
    lockedAssignments: number;
    activeEnrollments: number;
    pendingApplications: number;
  } | null>(null);

  const stats = useMemo(() => {
    const users = readJson<any[]>("youthxp_users", []);
    const posts = readJson<any[]>("youthxp_community_posts", []);
    const completedChallenges = readJson<any[]>("youthxp_completed_challenges_details", []);
    const enrolledInternships = readJson<any[]>("youthxp_enrolled_internships", []);
    const registrations = readJson<any[]>("youthxp_event_registrations", []);
    const totalXP = safeNumber(localStorage.getItem("youthxp_user_xp"), 0);

    return {
      users: users.length,
      posts: posts.length,
      challenges: completedChallenges.length,
      internships: enrolledInternships.length,
      events: registrations.length,
      totalXP,
    };
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
        <StatCard title="Users" value={String(stats.users)} icon={Users} />
        <StatCard title="Community Posts" value={String(stats.posts)} icon={MessageSquare} />
        <StatCard title="Challenge Completions" value={String(stats.challenges)} icon={Trophy} />
        <StatCard title="Enrolled Internships" value={String(stats.internships)} icon={Briefcase} />
        <StatCard title="Event Registrations" value={String(stats.events)} icon={Calendar} />
        <StatCard title="Total XP (current user)" value={String(stats.totalXP)} icon={Trophy} />
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
