import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface FollowData {
  followers: string[];
  following: string[];
}

export function useFollow(userId: string) {
  const [followData, setFollowData] = useState<FollowData>({
    followers: [],
    following: [],
  });

  const canUseApi = userId && userId !== "guest";

  useEffect(() => {
    if (!canUseApi) {
      setFollowData({ followers: [], following: [] });
      return;
    }

    apiFetch<{ followers: string[]; following: string[] }>("/community/follow")
      .then((d) => {
        setFollowData({
          followers: Array.isArray(d?.followers) ? d.followers : [],
          following: Array.isArray(d?.following) ? d.following : [],
        });
      })
      .catch(() => {
        setFollowData({ followers: [], following: [] });
      });
  }, [userId]);

  const follow = useCallback((targetUserId: string) => {
    if (!canUseApi) return;
    if (!targetUserId) return;
    if (targetUserId === userId) return;
    if (followData.following.includes(targetUserId)) return;

    const prev = followData;
    setFollowData({ ...followData, following: [...followData.following, targetUserId] });

    apiFetch(`/community/follow/${encodeURIComponent(targetUserId)}`, { method: "POST" }).catch(() => {
      setFollowData(prev);
    });

    window.dispatchEvent(
      new CustomEvent("follow-update", {
        detail: { userId, targetUserId, action: "follow" },
      })
    );
  }, [canUseApi, followData, userId]);

  const unfollow = useCallback((targetUserId: string) => {
    if (!canUseApi) return;
    if (!targetUserId) return;
    if (!followData.following.includes(targetUserId)) return;

    const prev = followData;
    setFollowData({ ...followData, following: followData.following.filter((id) => id !== targetUserId) });

    apiFetch(`/community/follow/${encodeURIComponent(targetUserId)}`, { method: "DELETE" }).catch(() => {
      setFollowData(prev);
    });

    window.dispatchEvent(
      new CustomEvent("follow-update", {
        detail: { userId, targetUserId, action: "unfollow" },
      })
    );
  }, [canUseApi, followData, userId]);

  const isFollowing = useCallback((targetUserId: string) => {
    return followData.following.includes(targetUserId);
  }, [followData]);

  const isFollowedBy = useCallback((targetUserId: string) => {
    return followData.followers.includes(targetUserId);
  }, [followData]);

  return {
    followers: followData.followers,
    following: followData.following,
    followersCount: followData.followers.length,
    followingCount: followData.following.length,
    follow,
    unfollow,
    isFollowing,
    isFollowedBy,
  };
}
