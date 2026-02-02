import { useState, useEffect, type ChangeEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Image, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string, images: string[]) => void;
  initialContent: string;
  initialImages: string[];
}

export function EditPostModal({ isOpen, onClose, onSave, initialContent, initialImages }: EditPostModalProps) {
  const [content, setContent] = useState(initialContent);
  const [selectedImages, setSelectedImages] = useState<string[]>(initialImages);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setSelectedImages(initialImages);
  }, [initialContent, initialImages]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    
    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSave(content, selectedImages);
    setIsSaving(false);
    onClose();
  };

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
      <DialogContent className="p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-xl font-display font-bold">Edit Post</DialogTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full h-40 p-4 bg-muted/50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-foreground placeholder:text-muted-foreground"
        />

        {/* Image Preview Grid */}
        {selectedImages.length > 0 && (
          <div className={`mt-4 grid gap-2 ${
            selectedImages.length === 1 ? 'grid-cols-1' :
            selectedImages.length === 2 ? 'grid-cols-2' :
            selectedImages.length === 3 ? 'grid-cols-2' :
            'grid-cols-2'
          }`}>
            {selectedImages.map((img, index) => (
              <div 
                key={index} 
                className={`relative rounded-xl overflow-hidden ${
                  selectedImages.length === 3 && index === 0 ? 'col-span-2' : ''
                }`}
              >
                <img 
                  src={img} 
                  alt={`Selected ${index + 1}`} 
                  className="w-full h-40 object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-primary">
            <Plus className="w-5 h-5" />
            <span className="text-sm">Add Photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </label>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="neon" 
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}