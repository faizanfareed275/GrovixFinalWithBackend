import { useState, useEffect, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  variant?: "default" | "compact" | "icon";
  className?: string;
}

export function FollowButton({ 
  targetUserId, 
  targetUserName, 
  variant = "default",
  className = ""
}: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, follow, unfollow } = useFollow(user?.id || "guest");
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(isFollowing(targetUserId));
  }, [isFollowing, targetUserId]);

  // Listen for follow updates
  useEffect(() => {
    const handleFollowUpdate = (e: CustomEvent) => {
      if (e.detail.targetUserId === targetUserId) {
        setFollowing(e.detail.action === "follow");
      }
    };
    window.addEventListener("follow-update", handleFollowUpdate as EventListener);
    return () => window.removeEventListener("follow-update", handleFollowUpdate as EventListener);
  }, [targetUserId]);

  const handleFollowToggle = (e: MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast.error("Please log in to follow users");
      return;
    }

    if (user.id === targetUserId) {
      toast.error("You cannot follow yourself");
      return;
    }

    if (following) {
      unfollow(targetUserId);
      setFollowing(false);
      toast.success(`Unfollowed ${targetUserName}`);
    } else {
      follow(targetUserId);
      setFollowing(true);
      toast.success(`Now following ${targetUserName}`);
    }
  };

  // Don't show follow button for own profile
  if (user?.id === targetUserId) {
    return null;
  }

  if (variant === "icon") {
    return (
      <Button
        variant={following ? "outline" : "ghost"}
        size="icon"
        className={`h-8 w-8 ${className}`}
        onClick={handleFollowToggle}
      >
        {following ? (
          <UserCheck className="w-4 h-4 text-primary" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
      </Button>
    );
  }

  if (variant === "compact") {
    return (
      <Button
        variant={following ? "outline" : "neon"}
        size="sm"
        className={`h-7 text-xs ${className}`}
        onClick={handleFollowToggle}
      >
        {following ? (
          <>
            <UserCheck className="w-3 h-3 mr-1" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="w-3 h-3 mr-1" />
            Follow
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={following ? "outline" : "neon"}
      className={className}
      onClick={handleFollowToggle}
    >
      {following ? (
        <>
          <UserCheck className="w-4 h-4 mr-2" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  );
}
