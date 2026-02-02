import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientAvatar: string;
  callType: "audio" | "video";
  isIncoming?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function CallModal({
  isOpen,
  onClose,
  recipientName,
  recipientAvatar,
  callType,
  isIncoming = false,
  onAccept,
  onDecline,
}: CallModalProps) {
  const [callStatus, setCallStatus] = useState<"ringing" | "connected" | "ended">("ringing");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video");

  useEffect(() => {
    if (!isOpen) {
      setCallStatus("ringing");
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoEnabled(callType === "video");
      return;
    }

    // Simulate call connecting after 3 seconds for outgoing calls
    if (!isIncoming) {
      const connectTimer = setTimeout(() => {
        setCallStatus("connected");
      }, 3000);

      return () => clearTimeout(connectTimer);
    }
  }, [isOpen, isIncoming, callType]);

  useEffect(() => {
    if (callStatus !== "connected") return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleAccept = () => {
    setCallStatus("connected");
    onAccept?.();
  };

  const handleDecline = () => {
    setCallStatus("ended");
    onDecline?.();
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="glass-card w-full max-w-sm overflow-hidden">
              {/* Video Preview Area (for video calls) */}
              {callType === "video" && callStatus === "connected" && (
                <div className="relative aspect-video bg-muted">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UserAvatar initials={recipientAvatar} size="xl" className="w-24 h-24" />
                  </div>
                  {/* Self preview */}
                  <div className="absolute bottom-4 right-4 w-24 h-32 bg-muted/80 rounded-lg border border-border flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">You</span>
                  </div>
                </div>
              )}

              {/* Call Info */}
              <div className="p-8 text-center">
                {/* Avatar */}
                {(callType === "audio" || callStatus === "ringing") && (
                  <motion.div
                    animate={callStatus === "ringing" ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mx-auto mb-6"
                  >
                    <UserAvatar initials={recipientAvatar} size="xl" className="w-24 h-24" />
                  </motion.div>
                )}

                <h2 className="font-display text-xl font-bold mb-2">{recipientName}</h2>

                <p className="text-muted-foreground">
                  {callStatus === "ringing" && (isIncoming ? "Incoming call..." : "Calling...")}
                  {callStatus === "connected" && formatDuration(callDuration)}
                  {callStatus === "ended" && "Call ended"}
                </p>

                {/* Ringing animation */}
                {callStatus === "ringing" && (
                  <div className="flex justify-center gap-1 mt-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                        className="w-2 h-2 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Call Controls */}
              <div className="p-6 border-t border-border">
                {isIncoming && callStatus === "ringing" ? (
                  <div className="flex justify-center gap-8">
                    <Button
                      onClick={handleDecline}
                      variant="destructive"
                      size="lg"
                      className="rounded-full w-16 h-16"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                    <Button
                      onClick={handleAccept}
                      variant="neon"
                      size="lg"
                      className="rounded-full w-16 h-16 bg-accent hover:bg-accent/90"
                    >
                      {callType === "video" ? (
                        <Video className="w-6 h-6" />
                      ) : (
                        <Phone className="w-6 h-6" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={() => setIsMuted(!isMuted)}
                      variant={isMuted ? "destructive" : "outline"}
                      size="lg"
                      className="rounded-full w-14 h-14"
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>

                    {callType === "video" && (
                      <Button
                        onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                        variant={!isVideoEnabled ? "destructive" : "outline"}
                        size="lg"
                        className="rounded-full w-14 h-14"
                      >
                        {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                      </Button>
                    )}

                    <Button
                      onClick={handleEndCall}
                      variant="destructive"
                      size="lg"
                      className="rounded-full w-14 h-14"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
