import { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (discussion: { title: string; content: string; category: string }) => void;
}

const categories = [
  "AI & ML",
  "Web Dev",
  "Mobile Dev",
  "Blockchain",
  "Game Dev",
  "Internships",
  "Career Advice",
  "General",
];

export function CreateDiscussionModal({ isOpen, onClose, onSubmit }: CreateDiscussionModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const handleSubmit = () => {
    if (title.trim() && content.trim() && category) {
      onSubmit({ title: title.trim(), content: content.trim(), category });
      setTitle("");
      setContent("");
      setCategory("");
      onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-bold">Start a Discussion</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Category
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Title
                </label>
                <Input
                  placeholder="What do you want to discuss?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground mt-1">{title.length}/150</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Content
                </label>
                <Textarea
                  placeholder="Share your thoughts, ask questions, or start a conversation..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1">{content.length}/2000</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="neon"
                  onClick={handleSubmit}
                  disabled={!title.trim() || !content.trim() || !category}
                >
                  Start Discussion
                </Button>
              </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
