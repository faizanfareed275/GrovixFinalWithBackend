import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Zap, Flame, Star, 
  Github, Linkedin, Twitter, Globe,
  MessageSquare, CheckCircle,
  Briefcase, Target, Users, MapPin, Share2, MoreHorizontal, Flag
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { XPBar } from "@/components/XPBar";
import { FollowButton } from "@/components/FollowButton";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { MessageModal } from "@/components/MessageModal";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { PostActions } from "@/components/PostActions";
import { ReportDialog, ReportDialogTarget } from "@/components/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CandidateProfileData {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  available: boolean;
  bio?: string | null;
  location?: string | null;
  experience?: string | null;
  portfolio?: string | null;
  skills: string[];
  followersCount?: number;
  followingCount?: number;
  challengesCompleted?: number;
  streak?: {
    count: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActivityDate: string | null;
  };
  badges?: { id: string; name: string; icon: string; description: string }[];
  certificates?: { internshipId: number; title: string; company: string; type: string; completedAt: string | null }[];
  recentChallenges?: { title: string; xp: number; date: string }[];
  socialLinks?: {
    github?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    website?: string | null;
  };
}

type CandidatePost = {
  id: number;
  userId: string;
  user: string;
  avatar: string;
  avatarUrl?: string | null;
  timeAgo: string;
  content: string;
  images: string[];
  likes: number;
  liked?: boolean;
  shares: number;
  saved?: boolean;
};

export default function CandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<CandidateProfileData | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);
  const [posts, setPosts] = useState<CandidatePost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportDialogTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const ensureSignedIn = () => {
    if (user) return true;
    toast.error("Please sign in to continue");
    navigate("/auth");
    return false;
  };

  const openReport = (target: ReportDialogTarget) => {
    if (!ensureSignedIn()) return;
    setReportTarget(target);
    setReportOpen(true);
  };

  useEffect(() => {
    if (!id) return;
    setLoadingCandidate(true);
    apiFetch<{ user: CandidateProfileData }>(`/users/${id}`)
      .then((d) => setCandidate(d?.user ?? null))
      .catch(() => setCandidate(null))
      .finally(() => setLoadingCandidate(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingPosts(true);
    apiFetch<{ posts: CandidatePost[] }>(`/community/posts?userId=${encodeURIComponent(id)}`)
      .then((d) => {
        setPosts(Array.isArray(d?.posts) ? d.posts : []);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [id]);

  const handleMessage = () => {
    setMessageOpen(true);
    toast.info("Opening chat...", {
      description: `Start a conversation with ${candidate?.name}`,
    });
  };

  const handleShareProfile = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = candidate?.name ? `${candidate.name} on Grovix` : "Grovix Profile";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        toast.success("Profile shared");
        return;
      }
    } catch {
    }

    try {
      if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
        return;
      }
    } catch {
    }

    if (url) {
      window.prompt("Copy profile link:", url);
    }
  };

  const handleLikePost = (postId: number) => {
    const existing = posts.find((p) => p.id === postId);
    if (!existing) return;
    const prevLiked = !!existing.liked;
    const prevLikes = Number(existing.likes || 0) || 0;
    const nextLiked = !prevLiked;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: nextLiked, likes: nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1) }
          : p
      )
    );

    apiFetch<{ liked: boolean; likes: number }>(`/community/posts/${encodeURIComponent(String(postId))}/like`, { method: "POST" })
      .then((d) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, liked: d.liked, likes: d.likes } : p)));
      })
      .catch((e: any) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, liked: prevLiked, likes: prevLikes } : p)));
        if (Number(e?.status) === 401) toast.error("Please log in to like posts");
      });
  };

  const handleSavePost = (postId: number) => {
    const existing = posts.find((p) => p.id === postId);
    if (!existing) return;
    const prevSaved = !!existing.saved;
    const nextSaved = !prevSaved;

    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: nextSaved } : p)));

    apiFetch<{ saved: boolean }>(`/community/posts/${encodeURIComponent(String(postId))}/save`, { method: "POST" })
      .then((d) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: !!d.saved } : p)));
      })
      .catch((e: any) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: prevSaved } : p)));
        if (Number(e?.status) === 401) toast.error("Please log in to save posts");
      });
  };

  const handleSharePost = (postId: number) => {
    const existing = posts.find((p) => p.id === postId);
    if (!existing) return;
    const prevShares = Number(existing.shares || 0) || 0;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares: prevShares + 1 } : p)));

    apiFetch(`/community/posts/${encodeURIComponent(String(postId))}/share`, { method: "POST" }).catch(() => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares: prevShares } : p)));
    });
  };

  if (loadingCandidate) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4">
            <div className="glass-card p-6 mb-8">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-24 h-24 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48 mt-3" />
                    <Skeleton className="h-3 w-full mt-6" />
                  </div>
                </div>
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid lg:grid-cols-3 gap-6 mt-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full lg:col-span-2" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold mb-4">Candidate not found</h1>
            <Button variant="outline" onClick={() => navigate("/recruiters")}>
              Back to Recruiters
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/recruiters")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Recruiters
          </motion.button>

          <div className="glass-card p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <UserAvatar src={candidate.avatarUrl || undefined} initials={candidate.avatar} size="xl" rounded="xl" className="w-24 h-24" />
                  <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center text-sm font-bold text-cyber-dark">
                    {candidate.level}
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl lg:text-3xl font-display font-bold truncate">{candidate.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {candidate.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {candidate.location}
                      </span>
                    )}
                    {typeof candidate.available === "boolean" && (
                      <span className={`px-2 py-1 rounded-full text-xs ${candidate.available ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                        {candidate.available ? "Available for hire" : "Not available"}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <XPBar currentXP={candidate.xp} maxXP={20000} level={candidate.level} />
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="w-4 h-4 text-primary" />
                    XP
                  </div>
                  <div className="text-lg font-bold">{candidate.xp.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Target className="w-4 h-4 text-secondary" />
                    Challenges
                  </div>
                  <div className="text-lg font-bold">{candidate.challengesCompleted ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-4 h-4 text-level-gold" />
                    Followers
                  </div>
                  <div className="text-lg font-bold">{candidate.followersCount ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Streak
                  </div>
                  <div className="text-lg font-bold">{candidate.streak?.count ?? 0}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex gap-2">
                  <FollowButton targetUserId={candidate.id} targetUserName={candidate.name} />
                  <Button variant="outline" onClick={handleMessage}>
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={handleShareProfile}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          openReport({
                            targetType: "USER",
                            targetUserId: candidate.id,
                            label: `User ${candidate.name}`,
                          })
                        }
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Report user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {candidate.socialLinks && (
                  <div className="flex items-center gap-2">
                    {candidate.socialLinks.github && (
                      <a href={candidate.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                        <Github className="w-5 h-5" />
                      </a>
                    )}
                    {candidate.socialLinks.linkedin && (
                      <a href={candidate.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                    {candidate.socialLinks.twitter && (
                      <a href={candidate.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {candidate.socialLinks.website && (
                      <a href={candidate.socialLinks.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors">
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="badges">Badges</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="glass-card">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-display font-bold mb-3">About</h2>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{candidate.bio || ""}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {candidate.experience && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {candidate.experience} experience
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card lg:col-span-2">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-display font-bold mb-3">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill) => (
                        <span key={skill} className="px-3 py-1.5 rounded-xl bg-primary/15 text-primary font-medium text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>

                    {candidate.recentChallenges && candidate.recentChallenges.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Recent Challenges</h3>
                        <div className="space-y-2">
                          {candidate.recentChallenges.slice(0, 5).map((challenge, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
                                  <CheckCircle className="w-4 h-4 text-accent" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{challenge.title}</div>
                                  <div className="text-xs text-muted-foreground">{challenge.date}</div>
                                </div>
                              </div>
                              <div className="text-primary font-medium text-sm">+{challenge.xp} XP</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="posts">
              <div className="space-y-4">
                {loadingPosts ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="glass-card p-8 text-center text-muted-foreground">No posts yet.</div>
                ) : (
                  posts.map((p) => (
                    <div key={p.id} className="glass-card p-5">
                      <div className="flex items-start gap-3">
                        <UserAvatar src={p.avatarUrl || undefined} initials={p.avatar} size="sm" className="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold truncate">{p.user}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground shrink-0">{p.timeAgo}</div>
                              <PostActions
                                postId={p.id}
                                isOwner={user?.id === p.userId}
                                onEdit={() => {}}
                                onDelete={() => {}}
                                onReport={() =>
                                  openReport({
                                    targetType: "POST",
                                    targetLegacyId: p.id,
                                    label: `Post #${p.id}`,
                                  })
                                }
                                onReportUser={() =>
                                  openReport({
                                    targetType: "USER",
                                    targetUserId: p.userId,
                                    label: `User ${p.user}`,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="mt-2 text-foreground whitespace-pre-line">{p.content}</div>
                          {Array.isArray(p.images) && p.images.length > 0 && (
                            <div className={`mt-3 grid gap-2 ${p.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                              {p.images.slice(0, 4).map((img, idx) => (
                                <img key={idx} src={img} alt={`Post image ${idx + 1}`} className="w-full h-40 object-cover rounded-xl" />
                              ))}
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1"><Star className="w-4 h-4" />{p.likes}</span>
                              <span className="flex items-center gap-1"><Share2 className="w-4 h-4" />{p.shares}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant={p.liked ? "neon" : "outline"} onClick={() => handleLikePost(p.id)}>
                                Like
                              </Button>
                              <Button size="sm" variant={p.saved ? "neon" : "outline"} onClick={() => handleSavePost(p.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleSharePost(p.id)}>
                                Share
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="badges">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-bold">Badges</h2>
                  <span className="text-sm text-muted-foreground">{candidate.badges?.length || 0} earned</span>
                </div>
                {candidate.badges && candidate.badges.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {candidate.badges.map((b) => (
                      <div key={b.id} className="rounded-xl bg-muted/40 border border-border p-4">
                        <div className="text-3xl mb-2">{b.icon}</div>
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{b.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No badges earned yet.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="certificates">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-bold">Certificates</h2>
                  <span className="text-sm text-muted-foreground">{candidate.certificates?.length || 0} earned</span>
                </div>
                {candidate.certificates && candidate.certificates.length > 0 ? (
                  <div className="space-y-3">
                    {candidate.certificates.map((c) => (
                      <div key={c.internshipId} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.title}</div>
                          <div className="text-sm text-muted-foreground truncate">{c.company}</div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">{c.completedAt || ""}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No certificates earned yet.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      <MessageModal
        isOpen={messageOpen}
        onClose={() => setMessageOpen(false)}
        recipientId={candidate.id}
        recipientName={candidate.name}
        recipientAvatar={String(candidate.name || "?")
          .split(" ")
          .filter(Boolean)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={reportTarget} />
    </div>
  );
}
