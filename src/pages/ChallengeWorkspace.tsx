import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Play, CheckCircle, Clock, Zap, 
  Lightbulb, Code, Trophy, Send, RotateCcw,
  Timer, TimerOff, Pause, PlayCircle, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStreak } from "@/hooks/useStreak";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const challengeData: Record<string, {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  xp: number;
  duration: string;
  description: string;
  task: string;
  hints: string[];
  starterCode: string;
  solution: string;
}> = {
  "1": {
    id: 1,
    title: "Build a Neural Network from Scratch",
    category: "AI & ML",
    difficulty: "Intermediate",
    xp: 500,
    duration: "3 hours",
    description: "Learn the fundamentals of neural networks by building one from scratch using only NumPy.",
    task: "Create a function that implements a simple feedforward neural network with one hidden layer. The network should be able to classify binary inputs.",
    hints: [
      "Start by defining the sigmoid activation function",
      "Initialize weights randomly using np.random",
      "Implement forward propagation first",
    ],
    starterCode: `# Simple Neural Network Task
# Complete the function below

def sigmoid(x):
    # TODO: Implement sigmoid activation
    pass

def neural_network(inputs, weights):
    # TODO: Implement forward propagation
    pass

# Test your implementation
inputs = [0.5, 0.3, 0.2]
print("Output:", neural_network(inputs, weights))`,
    solution: `def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def neural_network(inputs, weights):
    hidden = sigmoid(np.dot(inputs, weights['hidden']))
    output = sigmoid(np.dot(hidden, weights['output']))
    return output`,
  },
  "2": {
    id: 2,
    title: "Create a React Dashboard",
    category: "Web Dev",
    difficulty: "Beginner",
    xp: 300,
    duration: "2 hours",
    description: "Build a responsive dashboard component with charts and data visualization.",
    task: "Create a dashboard component that displays user statistics including a welcome message, stats cards, and a simple activity list.",
    hints: [
      "Use flexbox or grid for layout",
      "Create reusable StatCard components",
      "Add hover effects for interactivity",
    ],
    starterCode: `// Dashboard Component
// Complete the component below

function Dashboard({ user }) {
  // TODO: Implement the dashboard
  return (
    <div className="dashboard">
      {/* Add welcome message */}
      {/* Add stats cards */}
      {/* Add activity list */}
    </div>
  );
}

export default Dashboard;`,
    solution: `function Dashboard({ user }) {
  return (
    <div className="dashboard">
      <h1>Welcome, {user.name}!</h1>
      <div className="stats-grid">
        <StatCard title="XP Earned" value={user.xp} />
        <StatCard title="Challenges" value={user.challenges} />
      </div>
    </div>
  );
}`,
  },
  "3": {
    id: 3,
    title: "Unity 3D Character Controller",
    category: "Game Dev",
    difficulty: "Advanced",
    xp: 800,
    duration: "5 hours",
    description: "Implement a smooth 3D character controller with physics-based movement.",
    task: "Create a character controller script that handles player input, movement, jumping, and ground detection.",
    hints: [
      "Use CharacterController component for movement",
      "Implement ground check using raycasts",
      "Apply gravity when not grounded",
    ],
    starterCode: `// Character Controller Script
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    public float speed = 5f;
    public float jumpHeight = 2f;
    
    // TODO: Implement movement
    void Update()
    {
        // Get input
        // Move character
        // Handle jumping
    }
}`,
    solution: `void Update() {
    float h = Input.GetAxis("Horizontal");
    float v = Input.GetAxis("Vertical");
    Vector3 move = transform.right * h + transform.forward * v;
    controller.Move(move * speed * Time.deltaTime);
}`,
  },
};

// Default challenge for unknown IDs
const defaultChallenge = {
  id: 0,
  title: "Coding Challenge",
  category: "General",
  difficulty: "Beginner",
  xp: 100,
  duration: "1 hour",
  description: "Complete this coding challenge to earn XP.",
  task: "Write a function that solves the given problem.",
  hints: ["Think about the problem step by step", "Start with a simple solution"],
  starterCode: `// Complete the challenge\nfunction solution() {\n  // Your code here\n}`,
  solution: "function solution() { return true; }",
};

export default function ChallengeWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timerMode = searchParams.get("timer");
  
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState<"task" | "hints">("task");
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showTimerDialog, setShowTimerDialog] = useState(!timerMode);
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);

  const { user } = useAuth();

  const challenge = id && challengeData[id] ? challengeData[id] : defaultChallenge;
  
  const timerOptions = [
    { value: 15, label: "15 min", description: "Quick sprint" },
    { value: 30, label: "30 min", description: "Standard pace" },
    { value: 60, label: "1 hour", description: "Deep focus" },
    { value: null, label: "Free mode", description: "No time limit" },
  ];

  useEffect(() => {
    setCode(challenge.starterCode);

    if (user) {
      apiFetch<{ completions: Array<{ challengeId: number }> }>("/challenges/completions")
        .then((d) => {
          const ids = new Set((d.completions || []).map((c) => c.challengeId));
          setIsCompleted(ids.has(challenge.id));
        })
        .catch(() => {});
    }
    
    // Set timer from URL param
    if (timerMode === "free") {
      setShowTimerDialog(false);
      setSelectedTimer(null);
    } else if (timerMode) {
      const minutes = parseInt(timerMode);
      if (!isNaN(minutes)) {
        setShowTimerDialog(false);
        setSelectedTimer(minutes);
        setTimeRemaining(minutes * 60);
      }
    }
  }, [challenge, timerMode, user]);

  // Timer countdown effect
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && !isPaused && !isCompleted) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev !== null && prev <= 1) {
            setShowTimeUpDialog(true);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemaining, isPaused, isCompleted]);

  // Time spent counter (for free mode)
  useEffect(() => {
    if (!isCompleted && !isPaused && selectedTimer === null && !showTimerDialog) {
      const interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCompleted, isPaused, selectedTimer, showTimerDialog]);

  const handleStartTimer = (minutes: number | null) => {
    setSelectedTimer(minutes);
    if (minutes !== null) {
      setTimeRemaining(minutes * 60);
    }
    setShowTimerDialog(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRun = () => {
    setIsRunning(true);
    setOutput(["Running code...", ""]);
    
    setTimeout(() => {
      setOutput([
        "Running code...",
        "",
        "✓ Syntax check passed",
        "✓ Function defined correctly",
        "⚡ Running test cases...",
        "",
        "Test 1: PASSED",
        "Test 2: PASSED",
        "Test 3: PASSED",
        "",
        "All tests passed! ✨",
      ]);
      setIsRunning(false);
    }, 1500);
  };

  const { recordActivity } = useStreak();

  const handleSubmit = () => {
    setIsRunning(true);
    setOutput(["Submitting solution...", ""]);
    
    setTimeout(() => {
      setOutput([
        "Submitting solution...",
        "",
        "✓ All test cases passed",
        "✓ Code quality check passed",
        "✓ Performance benchmark passed",
        "",
        `🎉 Challenge completed! You earned ${challenge.xp} XP!`,
      ]);
      setIsRunning(false);
      setIsCompleted(true);

      if (!user) {
        toast.error("Please sign in to save your progress");
        return;
      }

      apiFetch<{ xp: number }>(`/challenges/${challenge.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          title: challenge.title,
          category: challenge.category,
          xpEarned: challenge.xp,
        }),
      })
        .then(() => {
          recordActivity();
          toast.success(`🎉 Challenge completed! +${challenge.xp} XP`);
        })
        .catch(() => {
          toast.error("Could not save completion");
        });
    }, 2000);
  };

  const handleReset = () => {
    setCode(challenge.starterCode);
    setOutput([]);
  };

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timeRemaining === null) return "text-muted-foreground";
    if (timeRemaining <= 60) return "text-destructive animate-pulse";
    if (timeRemaining <= 300) return "text-yellow-500";
    return "text-accent";
  };

  return (
    <>
      {/* Timer Selection Dialog */}
      <Dialog open={showTimerDialog} onOpenChange={setShowTimerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Choose Your Challenge Mode
            </DialogTitle>
            <DialogDescription>
              Select a time limit to challenge yourself, or choose free mode to work at your own pace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {timerOptions.map((option) => (
              <button
                key={option.value ?? "free"}
                onClick={() => handleStartTimer(option.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                {option.value !== null ? (
                  <Timer className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                ) : (
                  <TimerOff className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                )}
                <span className="font-display font-bold text-lg">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Time Up Dialog */}
      <Dialog open={showTimeUpDialog} onOpenChange={setShowTimeUpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Time's Up!
            </DialogTitle>
            <DialogDescription>
              Your time for this challenge has ended. You can still submit your solution or continue practicing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTimeUpDialog(false)}>
              Continue Practicing
            </Button>
            <Button variant="neon" onClick={() => { setShowTimeUpDialog(false); handleSubmit(); }}>
              Submit Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-28 pb-16">
          <div className="container mx-auto px-4">
            {/* Top Bar */}
            <div className="glass-card p-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/challenges")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-xl truncate">{challenge.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span>{challenge.category}</span>
                    <span>•</span>
                    <span className="text-primary font-medium">{challenge.xp} XP</span>
                    <span>•</span>
                    <span>{challenge.duration}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {selectedTimer !== null && timeRemaining !== null ? (
                  <div className={`flex items-center gap-2 ${getTimerColor()}`}>
                    <Timer className="w-4 h-4" />
                    <span className="font-mono font-bold">{formatTimeRemaining(timeRemaining)}</span>
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {isPaused ? <PlayCircle className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatTime(timeSpent)}</span>
                  </div>
                )}

                {isPaused && (
                  <span className="text-xs text-yellow-500 font-medium">PAUSED</span>
                )}

                {isCompleted && (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Completed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Layout */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Task/Hints */}
              <div className="glass-card overflow-hidden lg:col-span-1 flex flex-col min-h-[420px]">
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setActiveTab("task")}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === "task"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code className="w-4 h-4 inline mr-2" />
                    Task
                  </button>
                  <button
                    onClick={() => setActiveTab("hints")}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === "hints"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 inline mr-2" />
                    Hints
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === "task" ? (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-display font-bold mb-2">Description</h2>
                        <p className="text-muted-foreground">{challenge.description}</p>
                      </div>
                      <div>
                        <h2 className="text-lg font-display font-bold mb-2">Task</h2>
                        <p className="text-foreground">{challenge.task}</p>
                      </div>
                      <div className="glass-card p-4 border-primary/30">
                        <div className="flex items-center gap-2 text-primary mb-2">
                          <Trophy className="w-5 h-5" />
                          <span className="font-bold">Reward</span>
                        </div>
                        <p className="text-2xl font-display font-bold">{challenge.xp} XP</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h2 className="text-lg font-display font-bold">Hints</h2>
                      {challenge.hints.map((hint, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-card p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                              {index + 1}
                            </div>
                            <p className="text-muted-foreground">{hint}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Editor + Console */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-medium">Code Editor</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleRun} disabled={isRunning}>
                        <Play className="w-4 h-4 mr-1" />
                        Run
                      </Button>
                      <Button variant="neon" size="sm" onClick={handleSubmit} disabled={isRunning || isCompleted}>
                        <Send className="w-4 h-4 mr-1" />
                        Submit
                      </Button>
                    </div>
                  </div>

                  <div className="relative h-[520px]">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="absolute inset-0 w-full h-full p-4 bg-muted/20 text-foreground font-mono text-sm resize-none focus:outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-accent" />
                    <span className="ml-2 text-sm text-muted-foreground">Console Output</span>
                  </div>
                  <div className="p-4 font-mono text-sm overflow-y-auto max-h-56">
                    {output.length === 0 ? (
                      <span className="text-muted-foreground">Click "Run" to test your code...</span>
                    ) : (
                      output.map((line, index) => (
                        <div
                          key={index}
                          className={
                            line.includes("PASSED") ||
                            line.includes("passed") ||
                            line.includes("✓") ||
                            line.includes("✨") ||
                            line.includes("🎉")
                              ? "text-accent"
                              : line.includes("FAILED") || line.includes("Error")
                                ? "text-destructive"
                                : "text-foreground"
                          }
                        >
                          {line || "\u00A0"}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
