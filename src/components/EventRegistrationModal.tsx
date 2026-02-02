import { useState } from "react";
import { X, Calendar, MapPin, Users, Trophy, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Event {
  id: number;
  title: string;
  date: string | null;
  participants: number;
  prize: string | null;
  type: string;
  description?: string;
  venue?: string;
  link?: string;
  enrolled?: boolean;
}

interface EventRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
}

export function EventRegistrationModal({ isOpen, onClose, event }: EventRegistrationModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    reason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!event) return null;

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("Please sign in to register");
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/events/${event.id}/enroll`, {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          reason: formData.reason,
        }),
      });

      toast.success("Registration successful!", {
        description: `You're registered for ${event.title}`,
      });

      try {
        window.dispatchEvent(new Event("event-registered"));
      } catch {}

      setFormData({ name: "", email: "", phone: "", reason: "" });
      onClose();
    } catch {
      toast.error("Failed to register for event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="p-0 gap-0 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto glass-card">
        {/* Header with Event Info */}
        <div className="relative p-6 bg-gradient-to-r from-primary/20 to-accent/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-neon flex items-center justify-center shrink-0">
              <Calendar className="w-7 h-7 text-primary-foreground dark:text-cyber-dark" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold mb-1">{event.title}</h2>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {event.date}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {event.participants} participants
                </span>
                {event.prize && (
                  <span className="flex items-center gap-1 text-accent">
                    <Trophy className="w-4 h-4" />
                    {event.prize}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <div className="p-6 space-y-4">
          <h3 className="font-display font-bold text-lg">Register for this Event</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Full Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                className="bg-muted/50"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email Address *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@example.com"
                className="bg-muted/50"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="bg-muted/50"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Why do you want to attend?</label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Tell us why you're interested in this event..."
                className="min-h-[100px] bg-muted/50"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-border flex gap-3">
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
                Registering...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Register Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
