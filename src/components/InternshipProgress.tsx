import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle, Circle, Award,
  Zap, Target, Calendar, Upload, FileText, Link as LinkIcon, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InternshipCertificate } from "./InternshipCertificate";
import { TaskUploadModal, TaskSubmission } from "./TaskUploadModal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type TaskAttachment =
  | { type: "image"; url: string; name?: string }
  | { type: "document"; url: string; name?: string }
  | { type: "link"; url: string; name?: string };

export interface TaskSubmissionData {
  type: "file" | "link" | "text";
  content: string;
  fileName?: string;
  notes: string;
  submittedAt: string;
}

export interface InternshipTask {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
  week: number;
  attachment?: TaskAttachment;
  submission?: TaskSubmissionData;
}

export interface EnrolledInternship {
  id: number;
  title: string;
  company: string;
  duration: string;
  startDate: string;
  endDate: string;
  tasks: InternshipTask[];
  progress: number;
  totalXP: number;
  earnedXP: number;
}

interface InternshipProgressProps {
  internship: EnrolledInternship;
  onCompleteTask: (taskId: string, submission?: TaskSubmission) => void;
}

export function InternshipProgress({ internship, onCompleteTask }: InternshipProgressProps) {
  const { user } = useAuth();
  const [showCertificate, setShowCertificate] = useState(false);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<InternshipTask | null>(null);
  const [viewingTask, setViewingTask] = useState<InternshipTask | null>(null);
  const [openedTaskIds, setOpenedTaskIds] = useState<string[]>([]);

  const openedSet = useMemo(() => new Set(openedTaskIds), [openedTaskIds]);
  
  const completedTasks = internship.tasks.filter(t => t.completed).length;
  const totalTasks = internship.tasks.length;
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);
  
  // Check if eligible for certificate (80% completion)
  const isEligibleForCertificate = progressPercent >= 80;
  
  // Calculate time remaining
  const endDate = new Date(internship.endDate);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  const handleTaskUpload = (taskId: string) => {
    if (!openedSet.has(taskId)) {
      toast.error("Please open the task details first.");
      return;
    }
    setUploadingTaskId(taskId);
  };

  const handleOpenTask = (task: InternshipTask) => {
    setViewingTask(task);
    setOpenedTaskIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
  };

  const handleSubmitTask = (submission: TaskSubmission) => {
    if (uploadingTaskId) {
      onCompleteTask(uploadingTaskId, submission);
      setUploadingTaskId(null);
    }
  };

  const getUploadingTask = () => {
    return internship.tasks.find(t => t.id === uploadingTaskId);
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-display font-bold">{internship.title}</h2>
            <p className="text-muted-foreground">{internship.company}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{daysRemaining} days remaining</span>
            </div>
            <div className="flex items-center gap-1 text-primary">
              <Zap className="w-4 h-4" />
              <span className="font-medium">{internship.earnedXP}/{internship.totalXP} XP</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-bold text-primary">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-xl bg-muted/50">
            <div className="text-2xl font-bold text-primary">{completedTasks}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/50">
            <div className="text-2xl font-bold text-accent">{totalTasks - completedTasks}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/50">
            <div className="text-2xl font-bold text-level-gold">{internship.earnedXP}</div>
            <div className="text-xs text-muted-foreground">XP Earned</div>
          </div>
        </div>

        {/* Certificate Status */}
        {isEligibleForCertificate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-accent" />
                <div>
                  <h3 className="font-bold text-accent">Certificate Available!</h3>
                  <p className="text-sm text-muted-foreground">
                    You've completed {progressPercent}% of tasks
                  </p>
                </div>
              </div>
              <Button variant="neon" onClick={() => setShowCertificate(true)}>
                View Certificate
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Tasks List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Internship Tasks
        </h3>

        <div className="space-y-4">
          {internship.tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-xl border transition-all ${
                task.completed 
                  ? "bg-accent/10 border-accent/30" 
                  : "bg-muted/50 border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {task.completed ? (
                    <CheckCircle className="w-6 h-6 text-accent" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium ${task.completed ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Week {task.week}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  
                  {/* Submission Info */}
                  {task.submission && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-accent">
                      {task.submission.type === "file" && <FileText className="w-3 h-3" />}
                      {task.submission.type === "link" && <LinkIcon className="w-3 h-3" />}
                      {task.submission.type === "text" && <FileText className="w-3 h-3" />}
                      <span>Submitted: {task.submission.fileName || task.submission.type}</span>
                      <button
                        onClick={() => setViewingSubmission(task)}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    <Zap className="w-4 h-4" />
                    +{task.xpReward} XP
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenTask(task)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Open
                  </Button>
                  
                  {!task.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTaskUpload(task.id)}
                      className="flex items-center gap-1"
                      disabled={!openedSet.has(task.id)}
                      title={!openedSet.has(task.id) ? "Open the task first" : "Upload submission"}
                    >
                      <Upload className="w-3 h-3" />
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Task Viewer Modal */}
      {viewingTask && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setViewingTask(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl glass-card overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Week {viewingTask.week}</div>
                  <div className="text-xl font-display font-bold truncate">{viewingTask.title}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewingTask(null)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground whitespace-pre-line">
                {viewingTask.description}
              </div>

              {viewingTask.attachment && (
                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="text-sm font-medium mb-3">Task Attachment</div>

                  {viewingTask.attachment.type === "image" && (
                    <div className="space-y-2">
                      <img
                        src={viewingTask.attachment.url}
                        alt={viewingTask.attachment.name || viewingTask.title}
                        className="w-full max-h-[420px] object-contain rounded-lg border border-border bg-background"
                      />
                      <a
                        href={viewingTask.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Open image in new tab
                      </a>
                    </div>
                  )}

                  {viewingTask.attachment.type === "document" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">{viewingTask.attachment.name || "Document"}</span>
                      </div>
                      <a
                        href={viewingTask.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Open document
                      </a>
                    </div>
                  )}

                  {viewingTask.attachment.type === "link" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <LinkIcon className="w-4 h-4" />
                        <span className="font-medium">{viewingTask.attachment.name || "Link"}</span>
                      </div>
                      <a
                        href={viewingTask.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
                        {viewingTask.attachment.url}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {!viewingTask.attachment && (
                <div className="text-sm text-muted-foreground">
                  No attachment provided for this task.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Task Upload Modal */}
      <TaskUploadModal
        isOpen={uploadingTaskId !== null}
        onClose={() => setUploadingTaskId(null)}
        taskTitle={getUploadingTask()?.title || ""}
        onSubmit={handleSubmitTask}
      />

      {/* Submission Viewer Modal */}
      {viewingSubmission && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setViewingSubmission(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{viewingSubmission.title} - Submission</h3>
            
            {viewingSubmission.submission && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{viewingSubmission.submission.type}</p>
                </div>
                
                {viewingSubmission.submission.type === "file" && viewingSubmission.submission.fileName && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">File:</span>
                    <p className="font-medium">{viewingSubmission.submission.fileName}</p>
                  </div>
                )}
                
                {viewingSubmission.submission.type === "link" && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Link:</span>
                    <a 
                      href={viewingSubmission.submission.content} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline block truncate"
                    >
                      {viewingSubmission.submission.content}
                    </a>
                  </div>
                )}
                
                {viewingSubmission.submission.type === "text" && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Content:</span>
                    <p className="font-medium whitespace-pre-wrap">{viewingSubmission.submission.content}</p>
                  </div>
                )}
                
                {viewingSubmission.submission.notes && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Notes:</span>
                    <p className="font-medium">{viewingSubmission.submission.notes}</p>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Submitted:</span>
                  <p className="font-medium">{viewingSubmission.submission.submittedAt}</p>
                </div>
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full mt-4" 
              onClick={() => setViewingSubmission(null)}
            >
              Close
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Certificate Modal */}
      <InternshipCertificate
        isOpen={showCertificate}
        onClose={() => setShowCertificate(false)}
        internship={{
          title: internship.title,
          company: internship.company,
          duration: internship.duration,
          completionDate: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
        }}
        userName={user?.name || "User"}
      />
    </div>
  );
}
