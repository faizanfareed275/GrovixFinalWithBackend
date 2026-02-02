import { motion } from "framer-motion";
import { Award, Download, Calendar, Building2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CertificateProps {
  isOpen: boolean;
  onClose: () => void;
  internship: {
    title: string;
    company: string;
    duration: string;
    completionDate: string;
  };
  userName: string;
}

export function InternshipCertificate({ isOpen, onClose, internship, userName }: CertificateProps) {
  const handleDownload = () => {
    // Create a simple certificate as downloadable content
    const certificateContent = `
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║                     CERTIFICATE OF COMPLETION                      ║
║                                                                    ║
║                           Grovix                                   ║
║                                                                    ║
║     This is to certify that                                        ║
║                                                                    ║
║                        ${userName}                                 ║
║                                                                    ║
║     has successfully completed the internship program              ║
║                                                                    ║
║                   ${internship.title}                              ║
║                                                                    ║
║     at ${internship.company}                                       ║
║                                                                    ║
║     Duration: ${internship.duration}                               ║
║     Completion Date: ${internship.completionDate}                  ║
║                                                                    ║
║                                                                    ║
║     ___________________                                            ║
║     Certificate ID: ${Date.now().toString(36).toUpperCase()}       ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
    `;
    
    const blob = new Blob([certificateContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Grovix_Certificate_${internship.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            Internship Certificate
          </DialogTitle>
        </DialogHeader>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Certificate Preview */}
          <div className="border-4 border-accent/30 rounded-xl p-8 bg-gradient-to-br from-card via-card to-accent/5 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-accent/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary/10 rounded-full translate-x-1/2 translate-y-1/2" />
            
            <div className="relative text-center space-y-6">
              {/* Header */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-gold flex items-center justify-center">
                  <Award className="w-10 h-10 text-cyber-dark" />
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Certificate of Completion</p>
                <h2 className="text-3xl font-display font-bold gradient-text">Grovix</h2>
              </div>

              <div className="py-4">
                <p className="text-muted-foreground mb-2">This is to certify that</p>
                <p className="text-2xl font-display font-bold text-foreground">{userName}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-2">has successfully completed the internship program</p>
                <p className="text-xl font-display font-bold text-primary">{internship.title}</p>
                <p className="text-muted-foreground mt-1">at {internship.company}</p>
              </div>

              <div className="flex justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{internship.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>{internship.completionDate}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Certificate ID: {Date.now().toString(36).toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-center mt-6">
            <Button variant="neon" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Certificate
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
