import { useMemo } from "react";
import { Users, MessageSquare, Trophy, Briefcase, Calendar } from "lucide-react";
import { readJson, safeNumber } from "@/admin/lib/storage";

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
    </div>
  );
}
