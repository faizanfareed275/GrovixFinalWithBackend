import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, Filter, Star, Zap, Award, Users, 
  ChevronRight, Building2, Briefcase, TrendingUp, Plus, Trash2,
  MessageSquare, Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateJobModal, JobData } from "@/components/CreateJobModal";
import { JobDetailModal } from "@/components/JobDetailModal";
import { MessageModal } from "@/components/MessageModal";
import { FollowButton } from "@/components/FollowButton";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type CandidateListItem = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  skills: string[];
  available: boolean;
};

const CANDIDATES_PAGE_SIZE = 8;

export default function Recruiters() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCandidateCount, setVisibleCandidateCount] = useState(CANDIDATES_PAGE_SIZE);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [jobPosts, setJobPosts] = useState<JobData[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);

  const fetchCandidates = useCallback(async () => {
    try {
      const d = await apiFetch<{ users: CandidateListItem[] }>(`/users?limit=100`);
      setCandidates(Array.isArray(d?.users) ? d.users : []);
    } catch {
      setCandidates([]);
    }
  }, []);

  const fetchMyJobs = useCallback(async () => {
    if (!user?.id) {
      setJobPosts([]);
      return;
    }
    try {
      const d = await apiFetch<{ jobs: JobData[] }>(`/jobs/mine`);
      setJobPosts(Array.isArray(d?.jobs) ? d.jobs : []);
    } catch {
      setJobPosts([]);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCandidates().catch(() => {});
  }, [fetchCandidates]);

  useEffect(() => {
    fetchMyJobs().catch(() => {});
  }, [fetchMyJobs]);

  useAutoRefresh({
    enabled: true,
    intervalMs: 45000,
    onRefresh: () => {
      fetchCandidates().catch(() => {});
      fetchMyJobs().catch(() => {});
    },
  });

  useEffect(() => {
    setVisibleCandidateCount(CANDIDATES_PAGE_SIZE);
  }, [searchQuery]);

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const pool = user?.id ? candidates.filter((c) => c.id !== user.id) : candidates;
    if (!query) return pool;
    return pool.filter((candidate) =>
      candidate.name.toLowerCase().includes(query) ||
      candidate.skills.some((skill) => String(skill).toLowerCase().includes(query)) ||
      String(candidate.level).includes(query)
    );
  }, [candidates, searchQuery, user?.id]);

  const rankedCandidates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const normalize = (s: string) => String(s || "").trim().toLowerCase();
    const jobs = Array.isArray(jobPosts) ? jobPosts : [];

    const scored = filteredCandidates.map((c) => {
      let score = 0;
      if (c.available) score += 1_000_000;

      const level = Number(c.level) || 0;
      const xp = Number(c.xp) || 0;
      score += xp * 10;
      score += level * 1_000;

      if (query) {
        if (c.name.toLowerCase().includes(query)) score += 20_000;
        if (String(level).includes(query)) score += 5_000;
        if (Array.isArray(c.skills) && c.skills.some((sk) => normalize(sk).includes(query))) score += 30_000;
      }

      if (jobs.length) {
        const candSkills = new Set((c.skills || []).map(normalize));
        let bestJobScore = 0;
        for (const job of jobs) {
          let jobScore = 0;
          const minLevel = Number(job.minLevel) || 0;
          const minXP = Number(job.minXP) || 0;
          if (level >= minLevel) jobScore += 25_000;
          if (xp >= minXP) jobScore += 25_000;

          const jobSkills = Array.isArray(job.skills) ? job.skills : [];
          let overlap = 0;
          for (const sk of jobSkills) {
            if (candSkills.has(normalize(sk))) overlap += 1;
          }
          jobScore += overlap * 10_000;

          if (jobScore > bestJobScore) bestJobScore = jobScore;
        }
        score += bestJobScore;
      }

      return { c, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.c.xp || 0) !== (a.c.xp || 0)) return (b.c.xp || 0) - (a.c.xp || 0);
      return String(a.c.name || "").localeCompare(String(b.c.name || ""));
    });

    return scored.map((x) => x.c);
  }, [filteredCandidates, jobPosts, searchQuery]);

  const visibleCandidates = useMemo(
    () => rankedCandidates.slice(0, visibleCandidateCount),
    [rankedCandidates, visibleCandidateCount]
  );

  const handleViewProfile = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`);
  };

  const handleCreateJob = async (job: JobData) => {
    if (!user?.id) {
      toast.error("Please log in to post a job");
      return false;
    }

    try {
      const d = await apiFetch<{ ok: boolean; job: JobData }>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          minLevel: job.minLevel,
          minXP: job.minXP,
          salary: job.salary,
          type: job.type,
          location: job.location,
          description: job.description,
          skills: job.skills,
        }),
      });

      if (!d?.job) throw new Error("missing_job");
      setJobPosts((prev) => [d.job, ...prev]);
      return true;
    } catch {
      toast.error("Failed to post job");
      return false;
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!user?.id) {
      toast.error("Please log in to delete job posts");
      return;
    }

    const prev = jobPosts;
    setJobPosts((curr) => curr.filter((j) => j.id !== jobId));
    try {
      await apiFetch<{ ok: boolean }>(`/jobs/${jobId}`, { method: "DELETE" });
      toast.success("Job post deleted");
    } catch {
      setJobPosts(prev);
      toast.error("Failed to delete job post");
    }
  };

  const handleMessageCandidate = (candidate: { id: string; name: string; avatar: string }) => {
    setMessageCandidate(candidate);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1 rounded-full bg-level-gold/20 text-level-gold text-sm font-medium mb-4">
              FOR RECRUITERS
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Hire <span className="gradient-text">Verified Talent</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find candidates with proven skills, verified through real challenges and XP scores
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
          >
            {[
              { icon: Users, value: "50K+", label: "Candidates" },
              { icon: Award, value: "10K+", label: "Verified Skills" },
              { icon: Briefcase, value: "500+", label: "Companies Hiring" },
              { icon: TrendingUp, value: "95%", label: "Placement Rate" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="glass-card p-6 text-center"
              >
                <stat.icon className="w-8 h-8 text-level-gold mx-auto mb-3" />
                <div className="text-3xl font-display font-bold gradient-text mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Candidate Search */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6 mb-6"
              >
                <h2 className="text-xl font-display font-bold mb-4">Find Candidates</h2>
                
                {/* Search */}
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="Search by skills, level, or name..."
                      className="pl-10 bg-card/60 border-white/10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>

                </div>

                {/* Candidates List */}
                <div className="space-y-4">
                  {visibleCandidates.map((candidate, index) => (
                    <motion.div
                      key={candidate.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="p-4 rounded-xl bg-card/40 hover:bg-card/60 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative">
                          <UserAvatar src={candidate.avatarUrl || undefined} initials={candidate.avatar} size="lg" rounded="xl" className="w-14 h-14" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-md bg-gradient-gold flex items-center justify-center text-xs font-bold text-cyber-dark">
                            {candidate.level}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display font-bold group-hover:text-primary transition-colors">
                              {candidate.name}
                            </h3>
                            {candidate.available ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-accent/20 text-accent">
                                Available
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                Hired
                              </span>
                            )}
                          </div>
                          
                          {/* Skills */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {candidate.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-primary" />
                              {candidate.xp.toLocaleString()} XP
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-level-gold" />
                              LVL {candidate.level}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <FollowButton
                            targetUserId={candidate.id}
                            targetUserName={candidate.name}
                            variant="icon"
                          />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageCandidate({ id: candidate.id, name: candidate.name, avatar: candidate.avatar });
                            }}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleViewProfile(candidate.id)}
                          >
                            View Profile
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {rankedCandidates.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No candidates found matching your search.
                    </div>
                  )}

                  {rankedCandidates.length > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-muted-foreground">
                        Showing {Math.min(visibleCandidateCount, rankedCandidates.length)} of {rankedCandidates.length}
                      </div>
                      {visibleCandidateCount < rankedCandidates.length && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setVisibleCandidateCount((prev) =>
                              Math.min(prev + CANDIDATES_PAGE_SIZE, rankedCandidates.length)
                            )
                          }
                        >
                          Show more
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Job Posts Sidebar */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-display font-bold">Your Job Posts</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate("/jobs")}>All Jobs</Button>
                    <Button
                      variant="neon"
                      size="sm"
                      onClick={() => {
                        if (!user?.id) {
                          toast.error("Please log in to post a job");
                          return;
                        }
                        setShowCreateJob(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Post Job
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {jobPosts.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      No job posts yet.
                    </div>
                  )}
                  {jobPosts.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="p-4 rounded-xl border border-white/5 hover:border-primary/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display font-bold text-sm">{job.title}</h3>
                          <p className="text-xs text-muted-foreground">{job.company}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteJob(job.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground mb-3">
                        <div className="flex items-center justify-between">
                          <span>Min Level: {job.minLevel}</span>
                          <span>Min XP: {job.minXP.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{job.type}</span>
                          <span className="text-accent font-medium">{job.salary}</span>
                        </div>
                      </div>

                      {job.skills && job.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {job.skills.slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{job.applicants} applicants</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Create Job Modal */}
      <CreateJobModal
        isOpen={showCreateJob}
        onClose={() => setShowCreateJob(false)}
        onCreateJob={handleCreateJob}
      />

      {/* Job Detail Modal */}
      <JobDetailModal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        job={selectedJob}
      />

      {/* Message Modal */}
      <MessageModal
        isOpen={!!messageCandidate}
        onClose={() => setMessageCandidate(null)}
        recipientId={String(messageCandidate?.id || "")}
        recipientName={messageCandidate?.name || ""}
        recipientAvatar={messageCandidate?.avatar || ""}
      />
    </div>
  );
}
