import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { InternshipProgress, EnrolledInternship, InternshipTask, TaskSubmissionData } from "@/components/InternshipProgress";
import { TaskSubmission } from "@/components/TaskUploadModal";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

export default function InternshipDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [enrolledInternship, setEnrolledInternship] = useState<EnrolledInternship | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      apiFetch<any>(`/internships/${id}/me`)
        .then((data) => {
          if (!data?.enrolled) {
            navigate(`/internships/apply/${id}`);
            return;
          }

          const enrollment = data.enrollment;
          const tasks: InternshipTask[] = (data.tasks || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            xpReward: t.xpReward,
            week: t.week,
            completed: !!t.submission,
            submission: t.submission || undefined,
            attachment: t.attachment || undefined,
          }));

          setEnrolledInternship({
            id: data.internship.id,
            title: data.internship.title,
            company: data.internship.company,
            duration: data.internship.duration,
            startDate: new Date(enrollment.startDate).toISOString(),
            endDate: new Date(enrollment.endDate).toISOString(),
            tasks,
            progress: enrollment.progress,
            totalXP: enrollment.totalXP,
            earnedXP: enrollment.earnedXP,
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id, navigate]);

  const handleCompleteTask = (taskId: string, submission?: TaskSubmission) => {
    if (!enrolledInternship) return;

    const internshipId = enrolledInternship.id;

    const task = enrolledInternship.tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;

    // Create submission data
    const submissionData: TaskSubmissionData | undefined = submission ? {
      type: submission.type,
      content: submission.content,
      fileName: submission.fileName,
      notes: submission.notes,
      submittedAt: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    } : undefined;

    if (!submissionData) return;

    apiFetch(`/internships/${internshipId}/tasks/${taskId}/submit`, {
      method: "POST",
      body: JSON.stringify({
        type: submissionData.type,
        content: submissionData.content,
        fileName: submissionData.fileName,
        notes: submissionData.notes,
      }),
    }).catch(() => {});

    // Update task completion with submission (UI)
    const updatedTasks = enrolledInternship.tasks.map(t =>
      t.id === taskId ? { ...t, completed: true, submission: submissionData } : t
    );

    // Calculate new progress
    const completedCount = updatedTasks.filter(t => t.completed).length;
    const progress = Math.round((completedCount / updatedTasks.length) * 100);
    const earnedXP = updatedTasks.filter(t => t.completed).reduce((sum, t) => sum + t.xpReward, 0);

    const updatedInternship = {
      ...enrolledInternship,
      tasks: updatedTasks,
      progress,
      earnedXP,
    };

    setEnrolledInternship(updatedInternship);

  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4 text-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!enrolledInternship) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold mb-4">Internship not found</h1>
            <Button variant="outline" onClick={() => navigate("/internships")}>
              Browse Internships
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
            onClick={() => navigate("/internships")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Internships
          </motion.button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
              INTERNSHIP DASHBOARD
            </span>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              Your <span className="gradient-text">Progress</span>
            </h1>
            <p className="text-muted-foreground">
              Track your tasks, earn XP, and unlock your certificate
            </p>
          </motion.div>

          {/* Progress Component */}
          <div className="max-w-4xl mx-auto">
            <InternshipProgress
              internship={enrolledInternship}
              onCompleteTask={handleCompleteTask}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
