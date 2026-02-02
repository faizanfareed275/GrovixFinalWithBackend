import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface Post {
  id: number;
  content: string;
  likes: number;
  comments: any[];
  xp: number;
  timeAgo: string;
  [key: string]: any;
}

interface RankedPost extends Post {
  aiScore?: number;
  aiReason?: string;
}

interface UserInterests {
  topics: string[];
  skills: string[];
}

export function useForYouFeed(posts: Post[], userId: string | null) {
  const [forYouPosts, setForYouPosts] = useState<RankedPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user interests from localStorage
  const getUserInterests = useCallback((): UserInterests => {
    const defaultInterests: UserInterests = {
      topics: ["AI", "Web Development", "React", "TypeScript"],
      skills: ["frontend", "backend", "machine-learning"]
    };

    if (!userId) return defaultInterests;

    try {
      const stored = localStorage.getItem(`youthxp_interests_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return defaultInterests;
  }, [userId]);

  // Get user activity from localStorage
  const getUserActivity = useCallback(() => {
    const defaultActivity = {
      recentTopics: ["React", "AI", "Career"],
      likedPosts: [],
      viewedPosts: []
    };

    if (!userId) return defaultActivity;

    try {
      const stored = localStorage.getItem(`youthxp_activity_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return defaultActivity;
  }, [userId]);

  const fetchForYouFeed = useCallback(async () => {
    if (posts.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/curate-feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            posts: posts.map(p => ({
              id: p.id,
              content: p.content,
              likes: p.likes,
              comments: p.comments?.length || 0,
              xp: p.xp,
              timeAgo: p.timeAgo
            })),
            userInterests: getUserInterests(),
            userActivity: getUserActivity()
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Using default sorting.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Using default sorting.");
        }
        throw new Error("Failed to curate feed");
      }

      const data = await response.json();
      const rankings = data.rankings || [];

      // Sort posts by AI scores
      const rankedPosts = [...posts].map(post => {
        const ranking = rankings.find((r: any) => r.postId === post.id);
        return {
          ...post,
          aiScore: ranking?.score || 50,
          aiReason: ranking?.reason || "Default ranking"
        };
      }).sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));

      setForYouPosts(rankedPosts);
    } catch (err) {
      console.error("Feed curation error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      
      // Fallback to engagement-based sorting
      const fallbackPosts = [...posts].sort((a, b) => {
        const scoreA = a.likes + (a.comments?.length || 0) * 2 + a.xp / 10;
        const scoreB = b.likes + (b.comments?.length || 0) * 2 + b.xp / 10;
        return scoreB - scoreA;
      });
      
      setForYouPosts(fallbackPosts);
    } finally {
      setIsLoading(false);
    }
  }, [posts, getUserInterests, getUserActivity]);

  // Save user interest when they interact
  const recordInterest = useCallback((topic: string) => {
    if (!userId) return;

    const interests = getUserInterests();
    if (!interests.topics.includes(topic)) {
      interests.topics = [topic, ...interests.topics.slice(0, 9)];
      localStorage.setItem(`youthxp_interests_${userId}`, JSON.stringify(interests));
    }
  }, [userId, getUserInterests]);

  // Track post view
  const recordPostView = useCallback((postId: number) => {
    if (!userId) return;

    const activity = getUserActivity();
    if (!activity.viewedPosts.includes(postId)) {
      activity.viewedPosts = [postId, ...activity.viewedPosts.slice(0, 49)];
      localStorage.setItem(`youthxp_activity_${userId}`, JSON.stringify(activity));
    }
  }, [userId, getUserActivity]);

  // Initial fetch
  useEffect(() => {
    if (posts.length > 0) {
      fetchForYouFeed();
    }
  }, [posts.length]); // Only refetch when post count changes

  return {
    forYouPosts,
    isLoading,
    error,
    refreshFeed: fetchForYouFeed,
    recordInterest,
    recordPostView
  };
}
