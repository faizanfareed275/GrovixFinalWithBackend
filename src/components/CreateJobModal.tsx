import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { X, Briefcase, DollarSign, MapPin, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateJob: (job: JobData) => Promise<boolean>;
}

export type JobPoster = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatar?: string;
};

export interface JobData {
  id: number;
  userId?: string;
  user?: JobPoster | null;
  title: string;
  company: string;
  minLevel: number;
  minXP: number;
  salary: string;
  type: string;
  location: string;
  description: string;
  skills: string[];
  applicants: number;
  createdAt: string;
  updatedAt?: string;
}

export function CreateJobModal({ isOpen, onClose, onCreateJob }: CreateJobModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    minLevel: "",
    minXP: "",
    salaryMin: "",
    salaryMax: "",
    type: "Full-time",
    location: "",
    description: "",
    skills: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.company || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    const salaryMin = Number(formData.salaryMin);
    const salaryMax = Number(formData.salaryMax);
    const hasSalaryMin = Number.isFinite(salaryMin) && salaryMin > 0;
    const hasSalaryMax = Number.isFinite(salaryMax) && salaryMax > 0;
    const salary = hasSalaryMin && hasSalaryMax
      ? `$${salaryMin}K - $${salaryMax}K`
      : hasSalaryMin
        ? `From $${salaryMin}K`
        : hasSalaryMax
          ? `Up to $${salaryMax}K`
          : "Competitive";

    const newJob: JobData = {
      id: Date.now(),
      title: formData.title,
      company: formData.company,
      minLevel: parseInt(formData.minLevel) || 1,
      minXP: parseInt(formData.minXP) || 0,
      salary,
      type: formData.type,
      location: formData.location || "Remote",
      description: formData.description,
      skills: formData.skills.split(",").map(s => s.trim()).filter(Boolean),
      applicants: 0,
      createdAt: new Date().toISOString(),
    };

    const ok = await onCreateJob(newJob);
    if (!ok) return;
    toast.success("Job posted successfully!", {
      description: "Your job listing is now live and visible to candidates.",
    });
    
    // Reset form
    setFormData({
      title: "",
      company: "",
      minLevel: "",
      minXP: "",
      salaryMin: "",
      salaryMax: "",
      type: "Full-time",
      location: "",
      description: "",
      skills: "",
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Post New Job
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Job Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Senior Frontend Developer"
              required
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium mb-2">Company Name *</label>
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Your company name"
              required
            />
          </div>

          {/* Job Type & Location */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Job Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Remote, San Francisco"
              />
            </div>
          </div>

          {/* Requirements */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-primary" />
                  Minimum Level
                </span>
              </label>
              <Input
                type="number"
                value={formData.minLevel}
                onChange={(e) => setFormData({ ...formData, minLevel: e.target.value })}
                placeholder="e.g., 10"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-primary" />
                  Minimum XP
                </span>
              </label>
              <Input
                type="number"
                value={formData.minXP}
                onChange={(e) => setFormData({ ...formData, minXP: e.target.value })}
                placeholder="e.g., 5000"
                min="0"
              />
            </div>
          </div>

          {/* Salary Range */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-accent" />
                Salary Range (in $K/year)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={formData.salaryMin}
                onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                placeholder="Min"
                min="0"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                value={formData.salaryMax}
                onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                placeholder="Max"
                min="0"
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-2">Required Skills</label>
            <Input
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g., React, TypeScript, Node.js (comma-separated)"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Job Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              className="w-full min-h-[120px] bg-muted/50 rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="neon" className="flex-1">
              Post Job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
