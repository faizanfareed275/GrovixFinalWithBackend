import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Lock, Unlock, Zap, Clock, MapPin, DollarSign, 
  Star, ChevronRight, Filter, Building2, Award
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { XPBar } from "@/components/XPBar";
import type { Internship } from "@/data/internships";
import { InternshipCertificate } from "@/components/InternshipCertificate";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface CompletedInternship {
  id: number;
  completionDate: string;
}

function normalizeInternship(raw: any): Internship {
  const skills = Array.isArray(raw?.skills) ? raw.skills.map((s: any) => String(s)) : [];
  const type = raw?.type === "paid" ? "paid" : "free";
  return {
    id: Number(raw?.id) || 0,
    title: String(raw?.title || ""),
    company: String(raw?.company || ""),
    type,
    xpRequired: Number(raw?.xpRequired) || 0,
    salary: raw?.salary ? String(raw.salary) : null,
    duration: String(raw?.duration || ""),
    location: String(raw?.location || ""),
    skills,
    description: String(raw?.description || ""),
    applicants: Number(raw?.applicants) || 0,
  };
}

export default function Internships() {
  const { user } = useAuth();
  const [activeTrack, setActiveTrack] = useState<"all" | "free" | "paid">("all");
  const [completedInternships, setCompletedInternships] = useState<CompletedInternship[]>([]);
  const [showCertificate, setShowCertificate] = useState(false);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [selectedInternship, setSelectedInternship] = useState<(typeof internships)[0] | null>(null);

  const [enrolledIds, setEnrolledIds] = useState<number[]>([]);

  const [userXP, setUserXP] = useState(0);

  useEffect(() => {
    setCompletedInternships([]);
  }, []);

  useEffect(() => {
    apiFetch<{ internships: Internship[] }>("/internships/public")
      .then((data) => {
        const list = Array.isArray((data as any)?.internships) ? (data as any).internships : [];
        setInternships(list.map((x: any) => normalizeInternship(x)).filter((x: Internship) => Number(x.id) > 0));
      })
      .catch(() => setInternships([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setUserXP(0);
      return;
    }
    apiFetch<{ xp: number }>("/xp/me")
      .then((d) => setUserXP(d.xp || 0))
      .catch(() => setUserXP(0));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setEnrolledIds([]);
      return;
    }
    apiFetch<{ enrollments: Array<{ id: number }> }>("/internships/me/enrollments")
      .then((d) => {
        const ids = (Array.isArray(d?.enrollments) ? d.enrollments : [])
          .map((e) => Number((e as any)?.id))
          .filter((n) => Number.isFinite(n));
        setEnrolledIds(ids);
      })
      .catch(() => setEnrolledIds([]));
  }, [user]);

  const filteredInternships = internships.filter((internship) => {
    if (activeTrack === "all") return true;
    return internship.type === activeTrack;
  });

  const isUnlocked = (xpRequired: number) => userXP >= xpRequired;
  const isCompleted = (id: number) => completedInternships.some(c => c.id === id);
  const getCompletionDate = (id: number) => completedInternships.find(c => c.id === id)?.completionDate || "";
  const isEnrolled = (id: number) => enrolledIds.includes(id);

  const handleViewCertificate = (internship: (typeof internships)[0]) => {
    setSelectedInternship(internship);
    setShowCertificate(true);
  };

  const apiUrl = typeof window !== "undefined"
    ? ((import.meta as any).env?.VITE_GROVIX_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`)
    : "http://localhost:4000";

  const imageSrcFor = (it: any) => {
    const url = String(it?.imageUrl || "").trim();
    if (url) return url;
    const fid = String(it?.imageFileId || "").trim();
    if (fid) return `${apiUrl}/files/public/${encodeURIComponent(fid)}`;
    return "";
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
            <span className="inline-block px-4 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium mb-4">
              INTERNSHIPS
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Unlock Your <span className="gradient-text-green">Dream Internship</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Earn XP to unlock exclusive internship opportunities at top companies
            </p>
          </motion.div>

          {/* User Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 mb-8 max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold">Your Progress</span>
              <span className="text-sm text-muted-foreground">
                {internships.filter(i => isUnlocked(i.xpRequired)).length} of {internships.length} unlocked
              </span>
            </div>
            <XPBar currentXP={userXP} maxXP={10000} level={12} />
          </motion.div>

          {/* Track Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center gap-4 mb-12"
          >
            {[
              { id: "all", label: "All Tracks", count: internships.length },
              { id: "free", label: "Free Track", count: internships.filter(i => i.type === "free").length },
              { id: "paid", label: "Paid Track", count: internships.filter(i => i.type === "paid").length },
            ].map((track) => (
              <button
                key={track.id}
                onClick={() => setActiveTrack(track.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTrack === track.id
                    ? track.id === "paid" 
                      ? "bg-gradient-gold text-cyber-dark glow-green"
                      : "bg-primary text-primary-foreground glow-blue"
                    : "bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {track.id === "free" && <Unlock className="w-4 h-4" />}
                {track.id === "paid" && <Star className="w-4 h-4" />}
                {track.label}
                <span className="text-xs opacity-70">({track.count})</span>
              </button>
            ))}
          </motion.div>

          {/* Internships Grid */}
          <motion.div
            layout
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredInternships.map((internship, index) => {
                const unlocked = isUnlocked(internship.xpRequired);
                
                return (
                  <motion.div
                    key={internship.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative group"
                  >
                    <div className={`glass-card card-3d p-6 h-full ${!unlocked ? "opacity-80" : ""}`}>
                      {/* Lock Overlay */}
                      {!unlocked && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-cyber-dark/70 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 p-6"
                        >
                          <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-lg font-display font-bold text-center mb-2">
                            {internship.xpRequired.toLocaleString()} XP Required
                          </p>
                          <p className="text-sm text-muted-foreground text-center">
                            {(internship.xpRequired - userXP).toLocaleString()} XP more to unlock
                          </p>
                          <div className="w-full mt-4">
                            <div className="h-2 rounded-full bg-card overflow-hidden">
                              <div 
                                className="h-full bg-gradient-neon rounded-full"
                                style={{ width: `${Math.min((userXP / internship.xpRequired) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-card border border-white/10 overflow-hidden flex items-center justify-center">
                            {imageSrcFor(internship) ? (
                              <img src={imageSrcFor(internship)} alt={internship.title} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <span className={internship.type === "free" ? "badge-free" : "badge-paid"}>
                              {internship.type === "free" ? "Free" : "Paid"}
                            </span>
                          </div>
                        </div>
                        {unlocked && (
                          <Unlock className="w-5 h-5 text-accent" />
                        )}
                      </div>

                      {/* Content */}
                      <h3 className="text-xl font-display font-bold mb-1 group-hover:text-primary transition-colors">
                        {internship.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3">{internship.company}</p>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {internship.description}
                      </p>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{internship.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{internship.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="w-4 h-4 text-primary" />
                          <span>{internship.xpRequired.toLocaleString()} XP required</span>
                        </div>
                        {internship.salary && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-accent" />
                            <span className="font-bold text-accent">{internship.salary}</span>
                          </div>
                        )}
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {internship.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <span className="text-xs text-muted-foreground">
                          {internship.applicants} applicants
                        </span>
                        {unlocked && (
                          isCompleted(internship.id) ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleViewCertificate(internship)}
                              className="border-accent text-accent hover:bg-accent/10"
                            >
                              <Award className="w-4 h-4 mr-1" />
                              View Certificate
                            </Button>
                          ) : isEnrolled(internship.id) ? (
                            <Button variant={internship.type === "paid" ? "gold" : "neon-green"} size="sm" asChild>
                              <Link to={`/internships/dashboard-v2/${internship.id}`}>
                                Open Dashboard
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </Button>
                          ) : (
                            <Button variant={internship.type === "paid" ? "gold" : "neon-green"} size="sm" asChild>
                              <Link to={`/internships/apply/${internship.id}`}>
                                Apply Now
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
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
            completionDate: getCompletionDate(selectedInternship.id),
          }}
          userName={user?.name || "User"}
        />
      )}

      <Footer />
    </div>
  );
}
