import { motion } from "framer-motion";
import { Flame, Trophy, Calendar, Clock } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";
import { cn } from "@/lib/utils";

interface StreakTrackerProps {
  className?: string;
  variant?: "compact" | "full";
  streakData?: {
    count: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActivityDate: string | null;
  };
}

function BackendStreakTracker({ className, variant, streakData }: { className?: string; variant: "compact" | "full"; streakData: StreakTrackerProps["streakData"] }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const count = typeof streakData?.count === "number" ? streakData.count : 0;
  const longest = typeof streakData?.longestStreak === "number" ? streakData.longestStreak : 0;
  const total = typeof streakData?.totalActiveDays === "number" ? streakData.totalActiveDays : 0;
  const lastActivityDate = streakData?.lastActivityDate ?? null;
  const isActiveToday = lastActivityDate === todayStr;
  const weeklyActivity = buildWeeklyActivity(lastActivityDate, count);

  return (
    <StreakTrackerView
      className={className}
      variant={variant}
      count={count}
      longest={longest}
      total={total}
      weeklyActivity={weeklyActivity}
      isActiveToday={isActiveToday}
      timeUntilReset={null}
    />
  );
}

function LocalStreakTracker({ className, variant }: { className?: string; variant: "compact" | "full" }) {
  const local = useStreak();
  return (
    <StreakTrackerView
      className={className}
      variant={variant}
      count={local.streak}
      longest={local.longestStreak}
      total={local.totalActiveDays}
      weeklyActivity={local.weeklyActivity}
      isActiveToday={local.isActiveToday}
      timeUntilReset={local.timeUntilReset}
    />
  );
}

export function StreakTracker({ className, variant = "full", streakData }: StreakTrackerProps) {
  if (streakData) {
    return <BackendStreakTracker className={className} variant={variant} streakData={streakData} />;
  }
  return <LocalStreakTracker className={className} variant={variant} />;
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function buildWeeklyActivity(lastActivityDate: string | null, count: number) {
  const today = new Date();
  const out: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    if (!lastActivityDate) {
      out.push(false);
      continue;
    }
    const diffDays = Math.floor((new Date(lastActivityDate).getTime() - new Date(dayStr).getTime()) / (1000 * 60 * 60 * 24));
    out.push(diffDays >= 0 && diffDays < count);
  }
  return out;
}

function StreakTrackerView({
  className,
  variant,
  count,
  longest,
  total,
  weeklyActivity,
  isActiveToday,
  timeUntilReset,
}: {
  className?: string;
  variant: "compact" | "full";
  count: number;
  longest: number;
  total: number;
  weeklyActivity: boolean[];
  isActiveToday: boolean;
  timeUntilReset: { hours: number; minutes: number } | null;
}) {

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
          count > 0 
            ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-500" 
            : "bg-muted text-muted-foreground"
        )}>
          <Flame className={cn("w-4 h-4", count > 0 && "animate-pulse")} />
          <span>{count}</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("glass-card p-6", className)}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          Daily Streak
        </h2>
        {isActiveToday && (
          <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
            ✓ Active Today
          </span>
        )}
      </div>

      {/* Current Streak */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center",
              count > 0 
                ? "bg-gradient-to-br from-orange-500 to-red-500" 
                : "bg-muted"
            )}
          >
            <div className="text-center">
              <span className="text-3xl font-display font-bold text-white">
                {count}
              </span>
              <p className="text-xs text-white/80">days</p>
            </div>
          </motion.div>
          {count >= 7 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center"
            >
              <span className="text-sm">🔥</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Time until reset warning */}
      {timeUntilReset && !isActiveToday && count > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
        >
          <div className="flex items-center gap-2 text-orange-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              Complete an activity within {timeUntilReset.hours}h {timeUntilReset.minutes}m to keep your streak!
            </span>
          </div>
        </motion.div>
      )}

      {/* Weekly Activity */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-3">This Week</p>
        <div className="flex justify-between gap-2">
          {weeklyActivity.map((active, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  active 
                    ? "bg-gradient-to-br from-orange-500 to-red-500" 
                    : "bg-muted"
                )}
              >
                {active ? (
                  <Flame className="w-4 h-4 text-white" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </motion.div>
              <span className="text-xs text-muted-foreground">{dayLabels[index]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-card/40">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-level-gold" />
            <span className="text-xs text-muted-foreground">Longest</span>
          </div>
          <span className="text-lg font-bold">{longest} days</span>
        </div>
        <div className="p-3 rounded-lg bg-card/40">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Active</span>
          </div>
          <span className="text-lg font-bold">{total} days</span>
        </div>
      </div>
    </motion.div>
  );
}
