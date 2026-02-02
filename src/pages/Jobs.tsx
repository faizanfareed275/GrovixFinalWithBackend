import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Eye,
  Filter,
  MapPin,
  Search,
  Star,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobDetailModal } from "@/components/JobDetailModal";
import type { JobData } from "@/components/CreateJobModal";
import { apiFetch } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { toast } from "sonner";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const JOBS_PAGE_SIZE = 9;

export default function Jobs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);

  const canLoadMore = useMemo(() => jobs.length < total, [jobs.length, total]);

  const fetchFirstPage = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) setLoading(true);

      try {
        const q = searchQuery.trim();
        const params = new URLSearchParams();
        params.set("limit", String(JOBS_PAGE_SIZE));
        params.set("offset", "0");
        if (q) params.set("q", q);

        const d = await apiFetch<{ jobs: JobData[]; total: number }>(`/jobs?${params.toString()}`);
        const rows = Array.isArray(d?.jobs) ? d.jobs : [];
        setJobs(rows);
        setTotal(typeof d?.total === "number" ? d.total : rows.length);
      } catch {
        setJobs([]);
        setTotal(0);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    fetchFirstPage({ silent: true })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [fetchFirstPage]);

  useAutoRefresh({
    enabled: true,
    intervalMs: 30000,
    onRefresh: () => {
      if (!searchQuery.trim()) {
        fetchFirstPage({ silent: true }).catch(() => {});
      }
    },
  });

  const handleShowMore = async () => {
    if (!canLoadMore) return;
    setLoadingMore(true);
    try {
      const q = searchQuery.trim();
      const params = new URLSearchParams();
      params.set("limit", String(JOBS_PAGE_SIZE));
      params.set("offset", String(jobs.length));
      if (q) params.set("q", q);

      const d = await apiFetch<{ jobs: JobData[]; total: number }>(`/jobs?${params.toString()}`);
      const rows = Array.isArray(d?.jobs) ? d.jobs : [];
      setJobs((prev) => [...prev, ...rows]);
      setTotal(typeof d?.total === "number" ? d.total : Math.max(total, jobs.length + rows.length));
    } catch {
      toast.error("Failed to load more jobs");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
              JOB POSTS
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Explore <span className="gradient-text">Open Roles</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Browse opportunities posted by the community and recruiters
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search jobs by title, company, skill, or location..."
                  className="pl-10 bg-card/60 border-white/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="md:w-auto">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <div>
                Showing {Math.min(jobs.length, total)} of {total}
              </div>
              {loading && <div>Loading…</div>}
            </div>
          </motion.div>

          {jobs.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              No job posts found.
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job, index) => {
              const posterInitials =
                job.user?.avatar ||
                (job.user?.name
                  ? job.user.name
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : job.company
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase());

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.03 }}
                  className="glass-card p-6 hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start gap-4">
                    <UserAvatar
                      src={job.user?.avatarUrl || undefined}
                      initials={posterInitials}
                      size="lg"
                      rounded="xl"
                      className="w-14 h-14"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display font-bold leading-tight truncate">{job.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">{job.company}</p>
                          {job.user?.name && (
                            <p className="text-xs text-muted-foreground truncate">Posted by {job.user.name}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                          <Building2 className="w-3 h-3" />
                          {job.type}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary">
                          <Zap className="w-3 h-3" />
                          {Number(job.minXP || 0).toLocaleString()} XP
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-level-gold/15 text-level-gold">
                          <Star className="w-3 h-3" />
                          LVL {job.minLevel}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground truncate">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                        <span className="text-accent font-medium shrink-0">{job.salary}</span>
                      </div>
                    </div>
                  </div>

                  {job.skills?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 rounded-xl bg-card/60 border border-white/10 text-xs text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-center pt-10">
            {canLoadMore && (
              <Button variant="outline" onClick={() => void handleShowMore()} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Show more"}
              </Button>
            )}
          </div>
        </div>
      </main>

      <Footer />

      <JobDetailModal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        job={selectedJob}
      />
    </div>
  );
}
