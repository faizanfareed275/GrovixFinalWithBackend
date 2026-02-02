import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVote?: number | null;
  expiresAt?: string;
}

interface PollCreatorProps {
  onCreatePoll: (poll: Poll) => void;
  onCancel: () => void;
}

export function PollCreator({ onCreatePoll, onCancel }: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) return;
    
    const poll: Poll = {
      question: question.trim(),
      options: options.filter(o => o.trim()).map((text, index) => ({
        id: index + 1,
        text: text.trim(),
        votes: 0
      })),
      totalVotes: 0,
      userVote: null
    };
    
    onCreatePoll(poll);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border border-border rounded-xl p-4 bg-muted/30"
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="font-medium">Create a Poll</span>
        <button onClick={onCancel} className="ml-auto p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Input
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="mb-3 bg-background"
      />

      <div className="space-y-2 mb-3">
        {options.map((option, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
              {index + 1}
            </span>
            <Input
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              className="flex-1 bg-background"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(index)}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {options.length < 4 && (
        <button
          onClick={addOption}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <Plus className="w-4 h-4" />
          Add option
        </button>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="neon" 
          size="sm" 
          onClick={handleCreate}
          disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
        >
          Add Poll
        </Button>
      </div>
    </motion.div>
  );
}

interface PollDisplayProps {
  poll: Poll;
  onVote: (optionId: number) => void;
}

export function PollDisplay({ poll, onVote }: PollDisplayProps) {
  const hasVoted = poll.userVote !== null && poll.userVote !== undefined;

  return (
    <div className="border border-border rounded-xl p-4 bg-muted/20 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="font-medium">{poll.question}</span>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = poll.totalVotes > 0 
            ? Math.round((option.votes / poll.totalVotes) * 100) 
            : 0;
          const isSelected = poll.userVote === option.id;

          return (
            <motion.button
              key={option.id}
              onClick={() => !hasVoted && onVote(option.id)}
              disabled={hasVoted}
              className={`w-full relative overflow-hidden rounded-lg p-3 text-left transition-all ${
                hasVoted 
                  ? "cursor-default" 
                  : "hover:bg-muted cursor-pointer"
              } ${isSelected ? "ring-2 ring-primary" : "border border-border"}`}
              whileHover={!hasVoted ? { scale: 1.01 } : {}}
              whileTap={!hasVoted ? { scale: 0.99 } : {}}
            >
              {/* Progress bar */}
              {hasVoted && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`absolute inset-y-0 left-0 ${
                    isSelected ? "bg-primary/30" : "bg-muted"
                  }`}
                />
              )}
              
              <div className="relative flex items-center justify-between">
                <span className={isSelected ? "font-medium text-primary" : ""}>
                  {option.text}
                </span>
                {hasVoted && (
                  <span className="text-sm text-muted-foreground">
                    {percentage}%
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
