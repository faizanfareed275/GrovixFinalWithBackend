import { useState, useRef, type ChangeEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Upload, File, Image, Link, Video, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TaskUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  onSubmit: (submission: TaskSubmission) => void;
}

export interface TaskSubmission {
  type: "file" | "link" | "text";
  content: string;
  fileName?: string;
  notes: string;
}

export function TaskUploadModal({ isOpen, onClose, taskTitle, onSubmit }: TaskUploadModalProps) {
  const [uploadType, setUploadType] = useState<"file" | "link" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [textContent, setTextContent] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    let content = "";
    let fileName = "";

    if (uploadType === "file" && !file) {
      toast.error("Please select a file");
      return;
    }
    if (uploadType === "link" && !link.trim()) {
      toast.error("Please enter a link");
      return;
    }
    if (uploadType === "text" && !textContent.trim()) {
      toast.error("Please enter your submission");
      return;
    }

    setIsSubmitting(true);

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (uploadType === "file" && file) {
      content = URL.createObjectURL(file);
      fileName = file.name;
    } else if (uploadType === "link") {
      content = link;
    } else {
      content = textContent;
    }

    onSubmit({
      type: uploadType,
      content,
      fileName,
      notes,
    });

    setIsSubmitting(false);
    resetForm();
    onClose();
    toast.success("Task submitted successfully!");
  };

  const resetForm = () => {
    setFile(null);
    setLink("");
    setTextContent("");
    setNotes("");
    setUploadType("file");
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-8 h-8 text-muted-foreground" />;
    
    const type = file.type;
    if (type.startsWith("image/")) return <Image className="w-8 h-8 text-primary" />;
    if (type.startsWith("video/")) return <Video className="w-8 h-8 text-secondary" />;
    return <File className="w-8 h-8 text-accent" />;
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="p-0 gap-0 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto glass-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-display font-bold">Upload Task Submission</h2>
            <p className="text-sm text-muted-foreground">{taskTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
                {/* Upload Type Tabs */}
                <div className="flex gap-2">
                  {[
                    { type: "file", label: "File", icon: File },
                    { type: "link", label: "Link", icon: Link },
                    { type: "text", label: "Text", icon: File },
                  ].map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => setUploadType(type as "file" | "link" | "text")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        uploadType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>

                {/* File Upload */}
                {uploadType === "file" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.zip"
                    />
                    <div className="flex flex-col items-center gap-3">
                      {getFileIcon()}
                      {file ? (
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">Click to upload</p>
                          <p className="text-sm text-muted-foreground">
                            Images, videos, documents (max 50MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Link Input */}
                {uploadType === "link" && (
                  <Input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://github.com/your-project or any URL"
                    className="bg-muted/50"
                  />
                )}

                {/* Text Input */}
                {uploadType === "text" && (
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Describe your work, paste code, or explain your solution..."
                    className="min-h-[150px] bg-muted/50"
                  />
                )}

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Additional Notes (optional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional context or notes about your submission..."
                    className="min-h-[80px] bg-muted/50"
                  />
                </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="neon" 
            className="flex-1" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Submit Task
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
