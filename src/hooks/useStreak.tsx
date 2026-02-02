import { useState, useEffect, useCallback } from "react";

interface StreakData {
  count: number;
  lastActivityDate: string | null;
  longestStreak: number;
  totalActiveDays: number;
  weeklyActivity: boolean[]; // Last 7 days activity
}

const STREAK_KEY = "youthxp_day_streak";

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getWeeklyActivity(lastActivityDate: string | null, count: number): boolean[] {
  const today = new Date();
  const week: boolean[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = getDateString(checkDate);
    
    if (lastActivityDate) {
      const daysDiff = getDaysDifference(dateStr, lastActivityDate);
      // If within streak range and streak is active
      week.push(daysDiff < count && daysDiff >= 0);
    } else {
      week.push(false);
    }
  }
  
  return week;
}

export function useStreak() {
  const [streakData, setStreakData] = useState<StreakData>({
    count: 0,
    lastActivityDate: null,
    longestStreak: 0,
    totalActiveDays: 0,
    weeklyActivity: [false, false, false, false, false, false, false],
  });

  // Load streak data and check for reset
  useEffect(() => {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored) {
      const data: StreakData = JSON.parse(stored);
      const today = getDateString();
      
      if (data.lastActivityDate) {
        const daysDiff = getDaysDifference(data.lastActivityDate, today);
        
        // If more than 1 day has passed, reset streak
        if (daysDiff > 1) {
          const resetData: StreakData = {
            count: 0,
            lastActivityDate: null,
            longestStreak: data.longestStreak,
            totalActiveDays: data.totalActiveDays,
            weeklyActivity: getWeeklyActivity(null, 0),
          };
          setStreakData(resetData);
          localStorage.setItem(STREAK_KEY, JSON.stringify(resetData));
        } else {
          // Update weekly activity
          data.weeklyActivity = getWeeklyActivity(data.lastActivityDate, data.count);
          setStreakData(data);
        }
      } else {
        setStreakData(data);
      }
    }
  }, []);

  // Record activity and update streak
  const recordActivity = useCallback(() => {
    const today = getDateString();
    
    setStreakData((prev) => {
      let newCount = prev.count;
      let newLongest = prev.longestStreak;
      let newTotalDays = prev.totalActiveDays;
      
      if (prev.lastActivityDate === today) {
        // Already recorded activity today, no change
        return prev;
      }
      
      if (prev.lastActivityDate) {
        const daysDiff = getDaysDifference(prev.lastActivityDate, today);
        
        if (daysDiff === 1) {
          // Consecutive day - increment streak
          newCount = prev.count + 1;
        } else if (daysDiff > 1) {
          // Missed days - reset streak
          newCount = 1;
        } else {
          // Same day or future (shouldn't happen)
          newCount = prev.count;
        }
      } else {
        // First activity ever
        newCount = 1;
      }
      
      // Update longest streak
      if (newCount > newLongest) {
        newLongest = newCount;
      }
      
      // Increment total active days
      newTotalDays = prev.totalActiveDays + 1;
      
      const newData: StreakData = {
        count: newCount,
        lastActivityDate: today,
        longestStreak: newLongest,
        totalActiveDays: newTotalDays,
        weeklyActivity: getWeeklyActivity(today, newCount),
      };
      
      localStorage.setItem(STREAK_KEY, JSON.stringify(newData));
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent("streak-update", { 
        detail: newData 
      }));
      
      return newData;
    });
  }, []);

  // Check if user was active today
  const isActiveToday = useCallback(() => {
    return streakData.lastActivityDate === getDateString();
  }, [streakData.lastActivityDate]);

  // Get time until streak resets
  const getTimeUntilReset = useCallback(() => {
    if (!streakData.lastActivityDate) return null;
    
    const lastActivity = new Date(streakData.lastActivityDate);
    const resetTime = new Date(lastActivity);
    resetTime.setDate(resetTime.getDate() + 2); // Resets after missing a full day
    resetTime.setHours(0, 0, 0, 0);
    
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  }, [streakData.lastActivityDate]);

  return {
    streak: streakData.count,
    longestStreak: streakData.longestStreak,
    totalActiveDays: streakData.totalActiveDays,
    weeklyActivity: streakData.weeklyActivity,
    lastActivityDate: streakData.lastActivityDate,
    isActiveToday: isActiveToday(),
    timeUntilReset: getTimeUntilReset(),
    recordActivity,
  };
}
