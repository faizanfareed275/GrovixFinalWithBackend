import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Globe, MessageSquare, BookOpen, Calendar, TrendingUp, 
  Users, Award, Flame, ChevronRight, UserPlus, BookmarkCheck 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { apiFetch } from "@/lib/api";

interface CommunitySidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "feed", label: "Feed", icon: Globe, description: "Latest posts" },
  { id: "saved", label: "Saved Posts", icon: BookmarkCheck, description: "Your bookmarks" },
  { id: "discussions", label: "Discussions", icon: MessageSquare, description: "Join conversations" },
  { id: "guidelines", label: "Guidelines", icon: BookOpen, description: "Learn the rules" },
  { id: "events", label: "Events", icon: Calendar, description: "Upcoming events" },
];

type TrendingTopic = { tag: string; posts: number };
type SuggestedUser = { id: string; name: string; xp: number; avatar: string; avatarUrl?: string | null; skills: string[] };
type CommunityStats = { members: number; onlineNow: number; posts: number; discussions: number };

export function CommunitySidebar({ activeTab, onTabChange }: CommunitySidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { followers, following, isFollowing } = useFollow(user?.id || "guest");
  const [followUpdateTrigger, setFollowUpdateTrigger] = useState(0);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);

  // Listen for follow updates to refresh suggestions
  useEffect(() => {
    const handleFollowUpdate = () => {
      setFollowUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener("follow-update", handleFollowUpdate);
    return () => window.removeEventListener("follow-update", handleFollowUpdate);
  }, []);

  useEffect(() => {
    apiFetch<{ topics: TrendingTopic[] }>("/community/trending-topics?limit=5")
      .then((d) => {
        setTrendingTopics(Array.isArray(d?.topics) ? d.topics : []);
      })
      .catch(() => {
        setTrendingTopics([]);
      });
  }, [followUpdateTrigger]);

  useEffect(() => {
    apiFetch<{ users: SuggestedUser[] }>("/community/users/suggested?limit=4")
      .then((d) => {
        const incoming = Array.isArray(d?.users) ? d.users : [];
        setSuggestedUsers(incoming.filter((u) => u.id !== user?.id && !isFollowing(u.id)));
      })
      .catch(() => {
        setSuggestedUsers([]);
      });
  }, [user?.id, isFollowing, followUpdateTrigger]);

  useEffect(() => {
    apiFetch<CommunityStats>("/community/stats")
      .then((d) => {
        setStats(d || null);
      })
      .catch(() => {
        setStats(null);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="glass-card p-4">
        <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">
          Navigation
        </h3>
        <nav className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground glow-blue"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{tab.label}</p>
                <p className={`text-xs truncate ${
                  activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}>
                  {tab.description}
                </p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                activeTab === tab.id ? "translate-x-1" : ""
              }`} />
            </button>
          ))}
        </nav>
      </div>

      {/* Trending Topics */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">
            Trending Topics
          </h3>
        </div>
        <div className="space-y-3">
          {trendingTopics.map((topic, index) => (
            <motion.button
              key={topic.tag}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors text-left group"
            >
              <span className="text-primary font-medium group-hover:underline">
                {topic.tag}
              </span>
              <span className="text-xs text-muted-foreground">
                {topic.posts} posts
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Suggested Users to Follow */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-secondary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">
            Suggested to Follow
          </h3>
        </div>
        {suggestedUsers.length > 0 ? (
          <div className="space-y-3">
            {suggestedUsers.map((suggestedUser, index) => (
              <motion.div
                key={suggestedUser.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="relative">
                  <UserAvatar src={suggestedUser.avatarUrl || undefined} initials={suggestedUser.avatar} size="sm" className="w-10 h-10" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{suggestedUser.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedUser.skills.slice(0, 2).map(skill => (
                      <span key={skill} className="text-xs text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <FollowButton
                  targetUserId={suggestedUser.id}
                  targetUserName={suggestedUser.name}
                  variant="compact"
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            You're following all suggested users!
          </p>
        )}
      </div>

      {/* Your Connections */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-accent" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">
            Your Connections
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button 
            onClick={() => navigate("/connections?tab=followers")}
            className="bg-muted/50 rounded-lg p-3 text-center hover:bg-muted transition-colors"
          >
            <p className="text-2xl font-display font-bold gradient-text">{followers.length}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </button>
          <button 
            onClick={() => navigate("/connections?tab=following")}
            className="bg-muted/50 rounded-lg p-3 text-center hover:bg-muted transition-colors"
          >
            <p className="text-2xl font-display font-bold gradient-text">{following.length}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </button>
        </div>
        <button
          onClick={() => navigate("/connections")}
          className="w-full text-sm text-primary hover:underline"
        >
          View all connections →
        </button>
      </div>

      {/* Community Stats */}
      <div className="glass-card p-4">
        <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">
          Community Stats
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-display font-bold gradient-text">
              {stats ? stats.members.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Members</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-display font-bold gradient-text">
              {stats ? stats.onlineNow.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Online Now</p>
          </div>
        </div>
      </div>
    </div>
  );
}
