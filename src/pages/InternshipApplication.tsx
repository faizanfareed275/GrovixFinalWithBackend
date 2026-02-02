import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import { 
  Briefcase, User, Mail, Phone, MapPin, FileText, 
  Upload, CheckCircle, ArrowRight, Building, Calendar,
  Zap, Trophy, Star, Loader2
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParams, useNavigate } from "react-router-dom";
import type { Internship } from "@/data/internships";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

type InternshipBatch = {
  id: number;
  internshipId: number;
  batchCode: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

const defaultInternship = {
  id: 0,
  title: "Internship",
  company: "Company",
  type: "free" as const,
  location: "Remote",
  duration: "3 months",
  salary: null,
  xpRequired: 0,
  skills: [],
  description: "",
  applicants: 0,
};

export default function InternshipApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [internshipDetails, setInternshipDetails] = useState<Internship>(defaultInternship);
  const [batches, setBatches] = useState<InternshipBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    portfolio: "",
    linkedin: "",
    github: "",
    coverLetter: "",
    resume: null as File | null,
  });

  useEffect(() => {
    if (id) {
      apiFetch<{ internship: Internship }>(`/internships/${id}`)
        .then((data) => {
          if (data?.internship) setInternshipDetails(data.internship);
        })
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ batches: InternshipBatch[] }>(`/internships/${id}/batches`)
      .then((d) => {
        const list = Array.isArray(d?.batches) ? d.batches : [];
        setBatches(list);

        const preferred =
          list.find((b) => String(b.status || "").toUpperCase() === "OPEN") ||
          list[0] ||
          null;
        setSelectedBatchId(preferred ? preferred.id : null);
      })
      .catch(() => {
        setBatches([]);
        setSelectedBatchId(null);
      });
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setFormData((prev) => {
      const name = String((user as any)?.name || "").trim();
      const email = String((user as any)?.email || "").trim();
      const parts = name ? name.split(/\s+/) : [];
      const firstName = prev.firstName || (parts[0] || "");
      const lastName = prev.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "");
      return {
        ...prev,
        firstName,
        lastName,
        email: prev.email || email,
      };
    });
  }, [user]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData({ ...formData, resume: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await apiFetch(`/internships/${internshipDetails.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          batchId: selectedBatchId,
          portfolio: formData.portfolio,
          linkedin: formData.linkedin,
          github: formData.github,
          location: formData.location,
          phone: formData.phone,
          coverLetter: formData.coverLetter,
        }),
      });
    } catch {
      setIsSubmitting(false);
      return;
    }
    
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  if (submitted) {
    const selectedBatch = batches.find((b) => b.id === selectedBatchId) || null;
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto text-center"
            >
              <div className="glass-card p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-accent" />
                </motion.div>
                <h1 className="text-3xl font-display font-bold mb-4">
                  Application Submitted!
                </h1>
                <p className="text-muted-foreground mb-4">
                  Your application has been submitted successfully. You will be contacted soon after review.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Your application will be reviewed by an admin.
                  {selectedBatch ? (
                    <> Batch: {selectedBatch.batchCode} ({selectedBatch.name}).</>
                  ) : null}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="neon" onClick={() => navigate("/internships")}>
                    Back to Internships
                  </Button>
                </div>
              </div>
            </motion.div>
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
                INTERNSHIP APPLICATION
              </span>
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Apply for <span className="gradient-text">{internshipDetails.title}</span>
              </h1>
            </motion.div>

            {/* Internship Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6 mb-8"
            >
              <div className="flex flex-wrap gap-6 items-center">
                <div className="w-16 h-16 rounded-xl bg-gradient-neon flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-primary-foreground dark:text-cyber-dark" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-display font-bold">{internshipDetails.title}</h2>
                  <p className="text-muted-foreground">{internshipDetails.company}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{internshipDetails.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{internshipDetails.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-primary font-medium">{internshipDetails.xpRequired} XP Required</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm font-medium mb-2">Select Batch</div>
                <select
                  value={selectedBatchId ?? ""}
                  onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-card">
                      {b.batchCode} • {b.name}
                    </option>
                  ))}
                  {batches.length === 0 && (
                    <option value="" className="bg-card">
                      Default batch
                    </option>
                  )}
                </select>
                {selectedBatchId && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {(() => {
                      const b = batches.find((x) => x.id === selectedBatchId);
                      if (!b) return null;
                      return `Dates: ${new Date(b.startDate).toLocaleDateString()} – ${new Date(b.endDate).toLocaleDateString()} • Status: ${b.status}`;
                    })()}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {internshipDetails.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Progress Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-4 mb-8"
            >
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                      s < step
                        ? "bg-accent text-accent-foreground"
                        : s === step
                        ? "bg-primary text-primary-foreground glow-blue"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s < step ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-12 sm:w-20 h-1 rounded-full ${
                        s < step ? "bg-accent" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </motion.div>

            {/* Form */}
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-6 md:p-8"
            >
              <form onSubmit={handleSubmit}>
                {/* Step 1: Personal Info */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold">Personal Information</h3>
                        <p className="text-sm text-muted-foreground">Tell us about yourself</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">First Name *</label>
                        <Input
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="John"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Last Name *</label>
                        <Input
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Doe"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Email Address *</label>
                      <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="john@example.com"
                        required
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Phone Number</label>
                        <Input
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Location</label>
                        <Input
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          placeholder="City, Country"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Professional Info */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <Building className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold">Professional Links</h3>
                        <p className="text-sm text-muted-foreground">Share your online presence</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Portfolio Website</label>
                      <Input
                        name="portfolio"
                        type="url"
                        value={formData.portfolio}
                        onChange={handleInputChange}
                        placeholder="https://yourportfolio.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">LinkedIn Profile</label>
                      <Input
                        name="linkedin"
                        type="url"
                        value={formData.linkedin}
                        onChange={handleInputChange}
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">GitHub Profile</label>
                      <Input
                        name="github"
                        type="url"
                        value={formData.github}
                        onChange={handleInputChange}
                        placeholder="https://github.com/yourusername"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Resume/CV *</label>
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                          id="resume-upload"
                        />
                        <label htmlFor="resume-upload" className="cursor-pointer">
                          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                          {formData.resume ? (
                            <p className="text-primary font-medium">{formData.resume.name}</p>
                          ) : (
                            <>
                              <p className="font-medium">Drop your resume here or click to browse</p>
                              <p className="text-sm text-muted-foreground mt-1">PDF, DOC, DOCX (Max 5MB)</p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Cover Letter */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold">Cover Letter</h3>
                        <p className="text-sm text-muted-foreground">Tell us why you're a great fit</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Cover Letter *</label>
                      <textarea
                        name="coverLetter"
                        value={formData.coverLetter}
                        onChange={handleInputChange}
                        placeholder="Describe your interest in this internship, relevant experience, and what you hope to learn..."
                        className="w-full min-h-[250px] bg-muted/50 rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Minimum 100 characters. Be specific about your skills and goals.
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-display font-bold mb-3">Application Summary</h4>
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium">{formData.email}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Resume:</span>{" "}
                          <span className="font-medium">{formData.resume?.name || "Not uploaded"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Location:</span>{" "}
                          <span className="font-medium">{formData.location || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-border">
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={prevStep}>
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {step < 3 ? (
                    <Button type="button" variant="neon" onClick={nextStep} className="gap-2">
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button type="submit" variant="neon" disabled={isSubmitting} className="gap-2">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Application
                          <CheckCircle className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
