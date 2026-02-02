import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  X, MapPin, Briefcase, DollarSign, Users, 
  Calendar, Zap, Star, Send 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/FollowButton";
import { JobData } from "./CreateJobModal";
import { toast } from "sonner";

interface JobDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobData | null;
}

export function JobDetailModal({ isOpen, onClose, job }: JobDetailModalProps) {
  if (!job) return null;

  const posterId = String(job.user?.id || job.userId || "");
  const posterName = String(job.user?.name || "").trim();

  const handleApply = () => {
    toast.success("Application submitted!", {
      description: `You've applied for ${job.title} at ${job.company}`,
    });
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="p-0 gap-0 w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto glass-card">
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-r from-primary/20 to-secondary/20">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center shrink-0">
                    <Briefcase className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold mb-1">{job.title}</h2>
                    <p className="text-muted-foreground">{job.company}</p>
                    {posterName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Posted by {posterName}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1 text-accent font-medium">
                        <DollarSign className="w-4 h-4" />
                        {job.salary}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 text-center">
                    <div className="text-lg font-bold text-primary">{job.type}</div>
                    <div className="text-xs text-muted-foreground">Job Type</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-center">
                    <div className="text-lg font-bold text-accent flex items-center justify-center gap-1">
                      <Zap className="w-4 h-4" />
                      {job.minXP.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Min XP</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-center">
                    <div className="text-lg font-bold text-level-gold flex items-center justify-center gap-1">
                      <Star className="w-4 h-4" />
                      {job.minLevel}
                    </div>
                    <div className="text-xs text-muted-foreground">Min Level</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-center">
                    <div className="text-lg font-bold text-secondary flex items-center justify-center gap-1">
                      <Users className="w-4 h-4" />
                      {job.applicants}
                    </div>
                    <div className="text-xs text-muted-foreground">Applicants</div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-display font-bold mb-3">Job Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{job.description}</p>
                </div>

                {/* Skills */}
                {job.skills && job.skills.length > 0 && (
                  <div>
                    <h3 className="font-display font-bold mb-3">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posted Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Posted on {new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-border flex flex-col sm:flex-row gap-3">
                <Button variant="neon" className="flex-1" onClick={handleApply}>
                  <Send className="w-4 h-4 mr-2" />
                  Apply Now
                </Button>
                {posterId ? (
                  <FollowButton
                    targetUserId={posterId}
                    targetUserName={posterName || job.company}
                    className="flex-1"
                  />
                ) : null}
              </div>
      </DialogContent>
    </Dialog>
  );
}
