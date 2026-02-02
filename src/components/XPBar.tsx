import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface XPBarProps {
  currentXP: number;
  maxXP: number;
  level: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function XPBar({ 
  currentXP, 
  maxXP, 
  level, 
  className,
  showLabel = true,
  size = "md"
}: XPBarProps) {
  const percentage = (currentXP / maxXP) * 100;

  const sizeClasses = {
    sm: "h-2",
    md: "h-4",
    lg: "h-6",
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="level-badge">
              <span>LVL {level}</span>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {currentXP.toLocaleString()} / {maxXP.toLocaleString()} XP
            </span>
          </div>
          <span className="text-sm font-bold text-primary">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className={cn("xp-bar relative overflow-hidden rounded-full", sizeClasses[size])}>
        <motion.div
          className="xp-bar-fill absolute left-0 top-0 bottom-0"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </div>
    </div>
  );
}
