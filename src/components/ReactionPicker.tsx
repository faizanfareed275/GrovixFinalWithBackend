import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ReactionType = "like" | "love" | "laugh" | "fire" | "clap";

interface Reaction {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
}

export const REACTIONS: Reaction[] = [
  { type: "like", emoji: "👍", label: "Like", color: "text-blue-500" },
  { type: "love", emoji: "❤️", label: "Love", color: "text-red-500" },
  { type: "laugh", emoji: "😂", label: "Haha", color: "text-yellow-500" },
  { type: "fire", emoji: "🔥", label: "Fire", color: "text-orange-500" },
  { type: "clap", emoji: "👏", label: "Clap", color: "text-purple-500" },
];

interface ReactionPickerProps {
  onReact: (type: ReactionType) => void;
  currentReaction?: ReactionType | null;
  reactionCounts: Record<ReactionType, number>;
}

export function ReactionPicker({ onReact, currentReaction, reactionCounts }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => setShowPicker(false), 300);
    setHoverTimeout(timeout);
  };

  const handleReact = (type: ReactionType) => {
    onReact(type);
    setShowPicker(false);
  };

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
  const topReactions = REACTIONS
    .filter(r => reactionCounts[r.type] > 0)
    .sort((a, b) => reactionCounts[b.type] - reactionCounts[a.type])
    .slice(0, 3);

  const currentReactionData = currentReaction 
    ? REACTIONS.find(r => r.type === currentReaction) 
    : null;

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Reaction Button */}
      <button
        onClick={() => handleReact(currentReaction || "like")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          currentReaction 
            ? currentReactionData?.color || "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <span className="text-lg">
          {currentReactionData?.emoji || "👍"}
        </span>
        <span className="text-sm font-medium hidden sm:inline">
          {currentReactionData?.label || "Like"}
        </span>
      </button>

      {/* Reaction Picker Popup */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute bottom-full left-0 mb-2 glass-card p-2 flex gap-1 z-50"
          >
            {REACTIONS.map((reaction, index) => (
              <motion.button
                key={reaction.type}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleReact(reaction.type)}
                whileHover={{ scale: 1.3, y: -5 }}
                whileTap={{ scale: 0.9 }}
                className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-2xl ${
                  currentReaction === reaction.type ? "bg-muted ring-2 ring-primary" : ""
                }`}
                title={reaction.label}
              >
                {reaction.emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction Summary */}
      {totalReactions > 0 && (
        <div className="absolute -top-1 -right-1 flex items-center">
          <div className="flex -space-x-1">
            {topReactions.map(r => (
              <span key={r.type} className="text-xs">{r.emoji}</span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">{totalReactions}</span>
        </div>
      )}
    </div>
  );
}
