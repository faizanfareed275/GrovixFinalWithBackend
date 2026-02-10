import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { 
  Zap, Trophy, Flame, Star, Target, 
  Users, MessageSquare, ChevronRight, Edit3,
  Heart, MessageCircle, Repeat2, MoreHorizontal, Bookmark,
  Grid3X3, Github, Linkedin, Twitter, Globe, Award, UserPlus, Eye, MapPin, Briefcase
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { XPBar } from "@/components/XPBar";
import { UserAvatar } from "@/components/UserAvatar";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { StreakTracker } from "@/components/StreakTracker";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { apiFetch } from "@/lib/api";
import { InternshipCertificate } from "@/components/InternshipCertificate";
import type { Internship } from "@/data/internships";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PostActions } from "@/components/PostActions";
import { EditPostModal } from "@/components/EditPostModal";
import { toast } from "sonner";

interface UserPost {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  title: string;
  company: string;
  timeAgo: string;
  content: string;
  images: string[];
  xp: number;
  likes: number;
  comments: any[];
  shares: number;
  liked: boolean;
  saved: boolean;
  repostedFrom?: { user: string; avatar: string };
}

interface CompletedChallenge {
  id: number;
  title: string;
  category: string;
  xp: number;
  completedAt: string;
  rating?: number;
}

interface EnrolledInternship {
  id: number;
  title?: string;
  company?: string;
  type?: "free" | "paid";
  enrolledDate?: string;
  status?: string;
  progress?: number;
  tasksCompleted?: number;
  totalTasks?: number;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt?: string;
  description: string;
}

const defaultBadges = [
  { id: "first_challenge", name: "First Challenge", icon: "🏆", description: "Complete your first challenge", locked: true },
  { id: "streak_7", name: "7-Day Streak", icon: "🔥", description: "Maintain a 7-day streak", locked: true },
  { id: "ai_master", name: "AI Master", icon: "🤖", description: "Complete 5 AI challenges", locked: true },
  { id: "web_wizard", name: "Web Wizard", icon: "🌐", description: "Complete 5 Web Dev challenges", locked: true },
  { id: "community_star", name: "Community Star", icon: "⭐", description: "Get 50 likes on posts", locked: true },
  { id: "mentor", name: "Mentor Badge", icon: "🎓", description: "Help 10 community members", locked: true },
];

function UserPostCard({ 
  post, 
  onOpenLightbox,
  userName,
  userAvatarUrl,
  userInitials,
  isOwner,
  onEdit,
  onDelete
}: { 
  post: UserPost;
  onOpenLightbox: (images: string[], index: number) => void;
  userName: string;
  userAvatarUrl: string | null;
  userInitials: string;
  isOwner: boolean;
  onEdit: (postId: number) => void;
  onDelete: (postId: number) => void;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likes, setLikes] = useState(post.likes);
  const [shares, setShares] = useState(post.shares);

  useEffect(() => {
    setLiked(!!post.liked);
    setSaved(!!post.saved);
    setLikes(Number(post.likes || 0) || 0);
    setShares(Number(post.shares || 0) || 0);
  }, [post.liked, post.saved, post.likes, post.shares]);

  const handleLike = () => {
    const prevLiked = liked;
    const prevLikes = likes;
    const nextLiked = !prevLiked;
    setLiked(nextLiked);
    setLikes(nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1));

    apiFetch<{ liked: boolean; likes: number }>(`/community/posts/${encodeURIComponent(String(post.id))}/like`, { method: "POST" })
      .then((d) => {
        if (typeof d?.liked === "boolean") setLiked(d.liked);
        if (typeof d?.likes === "number") setLikes(d.likes);
      })
      .catch(() => {
        setLiked(prevLiked);
        setLikes(prevLikes);
      });
  };

  const handleSave = () => {
    const prev = saved;
    setSaved(!prev);
    apiFetch<{ saved: boolean }>(`/community/posts/${encodeURIComponent(String(post.id))}/save`, { method: "POST" })
      .then((d) => {
        if (typeof d?.saved === "boolean") setSaved(d.saved);
      })
      .catch(() => setSaved(prev));
  };

  const handleShare = () => {
    setShares((s) => s + 1);
    apiFetch(`/community/posts/${encodeURIComponent(String(post.id))}/share`, { method: "POST" }).catch(() => {
      setShares((s) => Math.max(0, s - 1));
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Repost indicator */}
      {post.repostedFrom && (
        <div className="px-4 pt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Repeat2 className="w-4 h-4" />
          <span>Reposted from {post.repostedFrom.user}</span>
        </div>
      )}

      {/* Post Header */}
      <div className="p-4 flex items-start gap-3">
        <UserAvatar src={userAvatarUrl || undefined} initials={userInitials} size="sm" className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{userName}</h3>
            {post.xp && (
              <span className="text-xs text-primary font-medium">+{post.xp} XP</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{post.timeAgo}</p>
        </div>
        <PostActions
          postId={post.id}
          isOwner={isOwner}
          onEdit={() => onEdit(post.id)}
          onDelete={() => onDelete(post.id)}
        />
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-foreground whitespace-pre-line">{post.content}</p>
      </div>

      {/* Post Images */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-1 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {post.images.slice(0, 4).map((image, index) => (
            <div 
              key={index} 
              className="relative cursor-pointer group"
              onClick={() => onOpenLightbox(post.images, index)}
            >
              <img 
                src={image} 
                alt={`Post image ${index + 1}`}
                className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
              />
              {index === 3 && post.images.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">+{post.images.length - 4}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground border-t border-border">
        <div className="flex items-center gap-1">
          <Heart className="w-4 h-4 text-destructive fill-destructive" />
          <span>{likes}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{post.comments?.length || 0} comments</span>
          <span>{shares} shares</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-border">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            liked ? "text-destructive" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-destructive" : ""}`} />
          <span className="text-sm font-medium">Like</span>
        </button>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Comment</span>
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Repeat2 className="w-4 h-4" />
          <span className="text-sm font-medium">Share</span>
        </button>
        <button 
          onClick={handleSave}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            saved ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? "fill-primary" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || "guest";
  const [internships, setInternships] = useState<Internship[]>([]);
  const { followersCount, followingCount } = useFollow(userId);

  const [editingPost, setEditingPost] = useState<UserPost | null>(null);

  const sseSourceRef = useRef<EventSource | null>(null);
  const sseRefetchTimer = useRef<number | null>(null);

  const apiUrl = useMemo(() => {
    const defaultApiUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:4000` : "http://localhost:4000";
    return (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;
  }, []);

  const [activeTab, setActiveTab] = useState<"posts" | "challenges" | "badges" | "internships" | "certificates">("posts");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userXP, setUserXP] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [completedInternships, setCompletedInternships] = useState<{id: number; completionDate: string}[]>([]);
  const [enrolledInternships, setEnrolledInternships] = useState<EnrolledInternship[]>([]);
  const [showCertificate, setShowCertificate] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<typeof internships[0] | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [totalLikesReceived, setTotalLikesReceived] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [streakData, setStreakData] = useState<{ count: number; longestStreak: number; totalActiveDays: number; lastActivityDate: string | null } | null>(null);
  const [profileData, setProfileData] = useState({
    name: user?.name || "Guest User",
    bio: "",
    avatarUrl: "",
    location: "",
    experience: "",
    portfolio: "",
    available: true,
    skills: [] as string[],
    socialLinks: {
      github: "",
      linkedin: "",
      twitter: "",
      website: "",
    },
  });

  const initialsFromName = (name: string) =>
    String(name || "?")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Load all user data
  useEffect(() => {
    const loadData = () => {
      if (userId && user) {
        apiFetch<{ completions: any[] }>("/challenges/completions")
          .then((d) => {
            const items = (d.completions || []).map((c: any) => ({
              id: c.challengeId,
              title: c.title,
              category: c.category,
              xp: c.xpEarned,
              completedAt: c.completedAt,
            }));
            setCompletedChallenges(items);
          })
          .catch(() => setCompletedChallenges([]));
      }

      // Load user posts from community posts
      apiFetch<{ posts: UserPost[] }>(`/community/posts?userId=${encodeURIComponent(userId)}`)
        .then((d) => {
          const all = Array.isArray(d.posts) ? d.posts : [];
          setUserPosts(all);
        })
        .catch(() => {
          setUserPosts([]);
        });

      apiFetch<{ user: any }>("/users/me")
        .then((d) => {
          const u = d?.user;
          if (!u) return;
          setProfileData({
            name: String(u.name || ""),
            bio: String(u.bio || ""),
            avatarUrl: String(u.avatarUrl || ""),
            location: String(u.location || ""),
            experience: String(u.experience || ""),
            portfolio: String(u.portfolio || ""),
            available: typeof u.available === "boolean" ? u.available : true,
            skills: Array.isArray(u.skills) ? u.skills : [],
            socialLinks: {
              github: String(u.socialLinks?.github || ""),
              linkedin: String(u.socialLinks?.linkedin || ""),
              twitter: String(u.socialLinks?.twitter || ""),
              website: String(u.socialLinks?.website || ""),
            },
          });

          setUserXP(Number(u.xp || 0) || 0);
          setStreakData(u.streak || null);
          setEarnedBadges(Array.isArray(u.badges) ? u.badges : []);

          const certs = Array.isArray(u.certificates) ? u.certificates : [];
          setCompletedInternships(
            certs.map((c: any) => ({ id: Number(c.internshipId), completionDate: String(c.completedAt || "") }))
          );
        })
        .catch(() => {});

      apiFetch<{ enrollments: EnrolledInternship[] }>("/internships/me/enrollments")
        .then((d) => {
          setEnrolledInternships(Array.isArray(d?.enrollments) ? d.enrollments : []);
        })
        .catch(() => setEnrolledInternships([]));
    };
    
    loadData();

    apiFetch<{ internships: Internship[] }>("/internships/public")
      .then((d) => setInternships(d.internships || []))
      .catch(() => setInternships([]));
    
    return () => {};
  }, [userId]);

  useEffect(() => {
    setTotalLikesReceived(userPosts.reduce((acc, p) => acc + (Number(p.likes || 0) || 0), 0));
  }, [userPosts]);

  useEffect(() => {
    if (userId === "guest") return;
    if (typeof window === "undefined") return;

    if (sseSourceRef.current) {
      try {
        sseSourceRef.current.close();
      } catch {
      }
      sseSourceRef.current = null;
    }

    const url = `${apiUrl}/community/events`;
    const es = new EventSource(url, { withCredentials: true } as any);
    sseSourceRef.current = es;

    const scheduleRefetch = () => {
      if (sseRefetchTimer.current) return;
      sseRefetchTimer.current = window.setTimeout(() => {
        sseRefetchTimer.current = null;
        apiFetch<{ posts: UserPost[] }>(`/community/posts?userId=${encodeURIComponent(userId)}`)
          .then((d) => {
            if (Array.isArray(d?.posts)) setUserPosts(d.posts);
          })
          .catch(() => {});
      }, 350);
    };

    es.addEventListener("posts_changed", scheduleRefetch as any);
    es.onerror = () => {
      // Let the browser auto-reconnect.
    };

    return () => {
      if (sseRefetchTimer.current) {
        window.clearTimeout(sseRefetchTimer.current);
        sseRefetchTimer.current = null;
      }
      try {
        es.close();
      } catch {
      }
      sseSourceRef.current = null;
    };
  }, [apiUrl, userId]);

  const handleEditPost = (postId: number) => {
    const post = userPosts.find((p) => p.id === postId);
    if (post) setEditingPost(post);
  };

  const handleSaveEdit = (content: string, images: string[]) => {
    if (!editingPost) return;
    if (!user) {
      toast.error("Please log in to edit posts");
      return;
    }

    apiFetch<{ post: UserPost }>(`/community/posts/${encodeURIComponent(String(editingPost.id))}`, {
      method: "PATCH",
      body: JSON.stringify({ content, images }),
    })
      .then((d) => {
        if (d?.post) setUserPosts((prev) => prev.map((p) => (p.id === d.post.id ? d.post : p)));
        setEditingPost(null);
        toast.success("Post updated successfully!");
      })
      .catch(() => {
        toast.error("Failed to update post");
      });
  };

  const handleDeletePost = (postId: number) => {
    if (!user) {
      toast.error("Please log in to delete posts");
      return;
    }

    apiFetch(`/community/posts/${encodeURIComponent(String(postId))}`, { method: "DELETE" })
      .then(() => {
        setUserPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success("Post deleted successfully!");
      })
      .catch(() => {
        toast.error("Failed to delete post");
      });
  };

  const handleSaveProfile = (data: typeof profileData) => {
    setProfileData(data);
    apiFetch<{ user: any }>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: data.name,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        location: data.location,
        experience: data.experience,
        portfolio: data.portfolio,
        available: data.available,
        skills: data.skills,
        socialLinks: data.socialLinks,
      }),
    })
      .then(() => {
        window.dispatchEvent(new Event("profile-updated"));
      })
      .catch(() => {});
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const level = Math.floor(userXP / 1000) + 1;
  const currentLevelXP = userXP % 1000;

  // Merge earned badges with default badges for display
  const allBadges = useMemo(() => {
    return defaultBadges.map(badge => {
      const earned = earnedBadges.find(b => b.id === badge.id);
      return {
        ...badge,
        earned: !!earned,
        earnedAt: earned?.earnedAt,
      };
    });
  }, [earnedBadges]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row items-start gap-8">
              {/* Avatar */}
              <div className="relative">
                <UserAvatar src={profileData.avatarUrl || undefined} initials={initialsFromName(profileData.name)} size="xl" rounded="xl" className="w-32 h-32" />
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center text-sm font-bold text-primary-foreground dark:text-cyber-dark">
                  {level}
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-primary/10 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-display font-bold">{profileData.name}</h1>
                  <span className="level-badge">
                    <Zap className="w-4 h-4" />
                    Level {level}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                  {!!profileData.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {profileData.location}
                    </span>
                  )}
                  {!!profileData.experience && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {profileData.experience}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs ${profileData.available ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {profileData.available ? "Available for hire" : "Not available"}
                  </span>
                </div>
                <p className="text-muted-foreground mb-4">
                  {profileData.bio}
                </p>

                {!!profileData.portfolio && (
                  <div className="mb-4">
                    <a
                      href={profileData.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      Portfolio
                    </a>
                  </div>
                )}
                
                {/* Followers/Following */}
                <div className="flex items-center gap-4 mb-4">
                  <button 
                    onClick={() => navigate("/connections?tab=followers")}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-bold">{followersCount}</span>
                    <span className="text-muted-foreground">Followers</span>
                  </button>
                  <button 
                    onClick={() => navigate("/connections?tab=following")}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="font-bold">{followingCount}</span>
                    <span className="text-muted-foreground">Following</span>
                  </button>
                </div>
                
                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {profileData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 text-xs rounded-full bg-primary/20 text-primary font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3 mb-4">
                  {profileData.socialLinks.github && (
                    <a href={profileData.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {profileData.socialLinks.linkedin && (
                    <a href={profileData.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {profileData.socialLinks.twitter && (
                    <a href={profileData.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {profileData.socialLinks.website && (
                    <a href={profileData.socialLinks.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
                
                {/* XP Progress */}
                <div className="max-w-md">
                  <XPBar currentXP={currentLevelXP} maxXP={1000} level={level} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total XP: {userXP.toLocaleString()} • {1000 - currentLevelXP} XP to Level {level + 1}
                  </p>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-2 mt-4">
                  <div className="streak-badge">
                    <Flame className="w-4 h-4" />
                    {streakData?.count ?? 0} Day Streak
                  </div>
                  {(streakData?.count ?? 0) > 0 && <span className="text-sm text-muted-foreground">Keep it up!</span>}
                </div>
              </div>

              {/* Action */}
              <Button variant="neon" onClick={() => setIsEditModalOpen(true)}>
                Edit Profile
              </Button>
            </div>
          </motion.div>

          <ProfileEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            profileData={profileData}
            onSave={handleSaveProfile}
          />

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            {[
              { icon: Trophy, label: "Challenges", value: completedChallenges.length.toString() },
              { icon: Flame, label: "Day Streak", value: String(streakData?.count ?? 0) },
              { icon: Star, label: "XP Earned", value: userXP.toLocaleString() },
              { icon: Award, label: "Badges", value: earnedBadges.length.toString() },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="glass-card p-6 text-center"
              >
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <div className="text-3xl font-display font-bold gradient-text mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-2 mb-8 border-b border-border pb-4"
          >
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "posts"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
              Posts ({userPosts.length})
            </button>
            <button
              onClick={() => setActiveTab("challenges")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "challenges"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Target className="w-5 h-5" />
              Challenges ({completedChallenges.length})
            </button>
            <button
              onClick={() => setActiveTab("badges")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "badges"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Trophy className="w-5 h-5" />
              Badges ({earnedBadges.length}/{defaultBadges.length})
            </button>
            <button
              onClick={() => setActiveTab("certificates")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "certificates"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Award className="w-5 h-5" />
              Certificates ({completedInternships.length})
            </button>

            <button
              onClick={() => setActiveTab("internships")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === "internships"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Trophy className="w-5 h-5" />
              Internship Dashboard ({enrolledInternships.length})
            </button>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Posts Tab */}
              {activeTab === "posts" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-display font-bold">My Posts</h2>
                    <Link to="/community">
                      <Button variant="outline" size="sm">
                        Create Post
                      </Button>
                    </Link>
                  </div>
                  {userPosts.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                      <Grid3X3 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">You haven't posted anything yet</p>
                      <Link to="/community">
                        <Button variant="neon">Create Your First Post</Button>
                      </Link>
                    </div>
                  ) : (
                    userPosts.map((post) => (
                      <UserPostCard 
                        key={post.id} 
                        post={post} 
                        onOpenLightbox={openLightbox}
                        userName={profileData.name}
                        userAvatarUrl={profileData.avatarUrl || null}
                        userInitials={initialsFromName(profileData.name)}
                        isOwner={post.userId === userId}
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                      />
                    ))
                  )}
                </motion.div>
              )}

              {/* Challenges Tab */}
              {activeTab === "challenges" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold">Completed Challenges</h2>
                    <Link to="/challenges">
                      <Button variant="ghost" size="sm">
                        Find Challenges <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  {completedChallenges.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">No challenges completed yet</p>
                      <Link to="/challenges">
                        <Button variant="neon">Start a Challenge</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedChallenges.map((challenge, index) => (
                        <motion.div
                          key={challenge.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 rounded-xl bg-card/40 hover:bg-card/60 transition-colors cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium group-hover:text-primary transition-colors">
                              {challenge.title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-primary" />
                                {challenge.xp} XP
                              </span>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-secondary/20 text-secondary">
                                {challenge.category}
                              </span>
                              {challenge.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-level-gold" />
                                  {challenge.rating}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Badges Tab */}
              {activeTab === "badges" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold">Badges</h2>
                    <span className="text-sm text-muted-foreground">
                      {earnedBadges.length} of {defaultBadges.length} earned
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {allBadges.map((badge) => (
                      <motion.div
                        key={badge.id}
                        whileHover={{ scale: 1.05 }}
                        className={`relative aspect-square rounded-xl flex flex-col items-center justify-center p-4 transition-all ${
                          badge.earned
                            ? "bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30"
                            : "bg-card/40 border border-border opacity-50"
                        }`}
                      >
                        <span className="text-4xl mb-2">{badge.icon}</span>
                        <span className="text-sm text-center font-medium">
                          {badge.name}
                        </span>
                        <span className="text-xs text-center text-muted-foreground mt-1">
                          {badge.description}
                        </span>
                        {!badge.earned && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                            <span className="text-3xl">🔒</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Certificates Tab */}
              {activeTab === "certificates" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold">Internship Certificates</h2>
                    <span className="text-sm text-muted-foreground">
                      {completedInternships.length} earned
                    </span>
                  </div>

                  {completedInternships.length === 0 ? (
                    <div className="text-center py-12">
                      <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">
                        Complete internships to earn certificates
                      </p>
                      <Link to="/internships">
                        <Button variant="neon">Browse Internships</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedInternships.map((completed, index) => {
                        const internship = internships.find(i => i.id === completed.id);
                        if (!internship) return null;
                        
                        return (
                          <motion.div
                            key={completed.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-4 p-4 rounded-xl bg-card/40 hover:bg-card/60 transition-colors cursor-pointer group"
                            onClick={() => {
                              setSelectedInternship(internship);
                              setShowCertificate(true);
                            }}
                          >
                            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                              <Award className="w-6 h-6 text-accent" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium group-hover:text-primary transition-colors">
                                {internship.title}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{internship.company}</span>
                                <span>•</span>
                                <span>Completed {completed.completionDate}</span>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="border-accent text-accent">
                              View
                            </Button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Internships Dashboard Tab */}
              {activeTab === "internships" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold">Your Internship Dashboards</h2>
                    <span className="text-sm text-muted-foreground">
                      {enrolledInternships.length} enrolled
                    </span>
                  </div>

                  {enrolledInternships.length === 0 ? (
                    <div className="text-center py-12">
                      <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">
                        You haven&apos;t enrolled in any internships yet.
                      </p>
                      <Link to="/internships">
                        <Button variant="neon">Browse Internships</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {enrolledInternships.map((enrolled) => {
                        const fallback = internships.find(i => i.id === enrolled.id);
                        const title = enrolled.title || fallback?.title || `Internship #${enrolled.id}`;
                        const company = enrolled.company || fallback?.company || "";
                        const progress = typeof enrolled.progress === "number" ? enrolled.progress : null;

                        return (
                          <div
                            key={enrolled.id}
                            className="p-4 rounded-xl border border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{title}</div>
                              <div className="text-sm text-muted-foreground truncate">{company}</div>
                              {progress !== null && (
                                <div className="text-xs text-muted-foreground mt-1">Progress: {progress}%</div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => navigate(`/internships/dashboard-v2/${enrolled.id}`)}
                            >
                              Open Dashboard
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Streak Tracker */}
              <StreakTracker streakData={streakData || undefined} />

              {/* Community Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6"
              >
                <h2 className="text-xl font-display font-bold mb-6">Community</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/40">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-destructive" />
                      <span className="text-sm">Likes Received</span>
                    </div>
                    <span className="font-bold">{totalLikesReceived}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/40">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-secondary" />
                      <span className="text-sm">Posts</span>
                    </div>
                    <span className="font-bold">{userPosts.length}</span>
                  </div>
                  <button 
                    onClick={() => navigate("/connections?tab=followers")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="text-sm">Followers</span>
                    </div>
                    <span className="font-bold">{followersCount}</span>
                  </button>
                  <button 
                    onClick={() => navigate("/connections?tab=following")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus className="w-5 h-5 text-accent" />
                      <span className="text-sm">Following</span>
                    </div>
                    <span className="font-bold">{followingCount}</span>
                  </button>
                </div>
              </motion.div>

              {/* Internship Progress */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-card p-6"
              >
                <h2 className="text-xl font-display font-bold mb-6">Internship Track</h2>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-accent/30 bg-accent/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge-free">Free Track</span>
                      <span className="text-accent text-sm font-medium">Unlocked</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      2 internships available
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-level-gold/30 bg-level-gold/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge-paid">Paid Track</span>
                      <span className="text-level-gold text-sm font-medium">
                        {userXP >= 10000 ? "Unlocked" : `${(10000 - userXP).toLocaleString()} XP needed`}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{Math.min(100, Math.round((userXP / 10000) * 100))}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-card overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (userXP / 10000) * 100)}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                          className="h-full bg-gradient-gold rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Link to="/internships">
                  <Button variant="gold" className="w-full mt-4">
                    View Internships
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Certificate Modal */}
      {selectedInternship && (
        <InternshipCertificate
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
          internship={{
            title: selectedInternship.title,
            company: selectedInternship.company,
            duration: selectedInternship.duration,
            completionDate: completedInternships.find(c => c.id === selectedInternship.id)?.completionDate || "",
          }}
          userName={profileData.name}
        />
      )}

      {/* Image Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <Footer />

      <EditPostModal
        isOpen={!!editingPost}
        onClose={() => setEditingPost(null)}
        onSave={handleSaveEdit}
        initialContent={editingPost?.content || ""}
        initialImages={editingPost?.images || []}
      />
    </div>
  );
}
