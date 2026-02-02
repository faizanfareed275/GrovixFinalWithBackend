import { useState, useRef, type ChangeEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { Image, Video, Smile, MapPin, Send, Loader2, Plus, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { PollCreator, Poll } from "@/components/PollCreator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (post: { content: string; images: string[]; poll?: Poll | null }) => void;
}

export function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImages(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onSubmit({ content, images: selectedImages, poll });
    setContent("");
    setSelectedImages([]);
    setPoll(null);
    setShowPollCreator(false);
    setIsSubmitting(false);
    onClose();
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Backdrop */}
      {/* Modal */}
      <DialogContent className="p-0 gap-0 max-w-lg glass-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <DialogTitle className="text-xl font-display font-bold">Create Post</DialogTitle>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            <UserAvatar isCurrentUser size="lg" className="w-12 h-12" />
            <div>
              <p className="font-semibold">{user?.name || "Guest User"}</p>
              <p className="text-sm text-muted-foreground">Posting to Community</p>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share your progress, ask questions, or celebrate your wins..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[150px] text-lg"
            autoFocus
          />

                {poll && !showPollCreator && (
                  <div className="mt-4 border border-border rounded-xl p-4 bg-muted/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          <span className="font-medium truncate">{poll.question}</span>
                        </div>
                        <div className="space-y-1">
                          {poll.options.map((o) => (
                            <div key={o.id} className="text-sm text-muted-foreground truncate">
                              {o.text}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setPoll(null)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {showPollCreator && (
                    <PollCreator
                      onCreatePoll={(p) => {
                        setPoll(p);
                        setShowPollCreator(false);
                      }}
                      onCancel={() => setShowPollCreator(false)}
                    />
                  )}
                </AnimatePresence>

          {/* Selected Images Preview - Grid Layout like Facebook */}
          {selectedImages.length > 0 && (
            <div className={`mt-4 gap-2 grid ${
              selectedImages.length === 1 ? 'grid-cols-1' : 
              selectedImages.length === 2 ? 'grid-cols-2' :
              selectedImages.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {selectedImages.map((image, index) => (
                <div 
                  key={index}
                  className={`relative rounded-xl overflow-hidden ${
                    selectedImages.length === 3 && index === 0 ? 'row-span-2' : ''
                  }`}
                >
                  <img
                    src={image}
                    alt={`Selected ${index + 1}`}
                    className="w-full h-full object-cover"
                    style={{ 
                      minHeight: selectedImages.length === 1 ? '300px' : '150px',
                      maxHeight: selectedImages.length === 1 ? '400px' : 
                                 (selectedImages.length === 3 && index === 0) ? '312px' : '150px'
                    }}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-upload"
                      multiple
                    />
                    <label
                      htmlFor="image-upload"
                      className="p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer text-primary flex items-center gap-1"
                    >
                      <Image className="w-6 h-6" />
                      {selectedImages.length > 0 && (
                        <span className="text-xs">{selectedImages.length}</span>
                      )}
                    </label>
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors text-secondary">
                      <Video className="w-6 h-6" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors text-accent">
                      <Smile className="w-6 h-6" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive">
                      <MapPin className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setShowPollCreator(true)}
                      disabled={!!poll || showPollCreator}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BarChart3 className="w-6 h-6" />
                    </button>
            </div>

            <Button
              variant="neon"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
