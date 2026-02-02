import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Filter, Zap, Clock, Star, ChevronRight, Trophy, ChevronDown, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import skillAI from "@/assets/skill-ai.png";
import skillWebDev from "@/assets/skill-webdev.png";
import skillGameDev from "@/assets/skill-gamedev.png";
import skillBlockchain from "@/assets/skill-blockchain.png";

const categories = ["All", "AI & ML", "Web Dev", "Game Dev", "Blockchain", "Data Science"];
const difficulties = ["All Levels", "Beginner", "Intermediate", "Advanced", "Expert"];

const challenges = [
  {
    id: 1,
    title: "Build a Neural Network from Scratch",
    category: "AI & ML",
    difficulty: "Intermediate",
    xp: 500,
    duration: "3 hours",
    participants: 1234,
    rating: 4.8,
    image: skillAI,
    status: "new",
  },
  {
    id: 2,
    title: "Create a React Dashboard",
    category: "Web Dev",
    difficulty: "Beginner",
    xp: 300,
    duration: "2 hours",
    participants: 2567,
    rating: 4.9,
    image: skillWebDev,
    status: "popular",
  },
  {
    id: 3,
    title: "Unity 3D Character Controller",
    category: "Game Dev",
    difficulty: "Advanced",
    xp: 800,
    duration: "5 hours",
    participants: 876,
    rating: 4.7,
    image: skillGameDev,
    status: "in-progress",
  },
  {
    id: 4,
    title: "Smart Contract Development",
    category: "Blockchain",
    difficulty: "Expert",
    xp: 1000,
    duration: "6 hours",
    participants: 543,
    rating: 4.6,
    image: skillBlockchain,
    status: "new",
  },
  {
    id: 5,
    title: "REST API with Node.js",
    category: "Web Dev",
    difficulty: "Intermediate",
    xp: 450,
    duration: "3 hours",
    participants: 1890,
    rating: 4.8,
    image: skillWebDev,
    status: "completed",
  },
  {
    id: 6,
    title: "Machine Learning Pipeline",
    category: "AI & ML",
    difficulty: "Advanced",
    xp: 700,
    duration: "4 hours",
    participants: 765,
    rating: 4.5,
    image: skillAI,
    status: null,
  },
];

const difficultyColors: Record<string, string> = {
  Beginner: "badge-easy",
  Intermediate: "badge-medium",
  Advanced: "badge-hard",
  Expert: "badge-expert",
};

const statusBadges: Record<string, { label: string; className: string }> = {
  new: { label: "NEW", className: "bg-accent/20 text-accent" },
  popular: { label: "POPULAR", className: "bg-secondary/20 text-secondary" },
  "in-progress": { label: "IN PROGRESS", className: "bg-primary/20 text-primary" },
  completed: { label: "COMPLETED", className: "bg-accent/20 text-accent" },
};

export default function Challenges() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All Levels");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setCompletedIds(new Set());
      return;
    }
    apiFetch<{ completions: Array<{ challengeId: number }> }>("/challenges/completions")
      .then((d) => setCompletedIds(new Set((d.completions || []).map((c) => c.challengeId))))
      .catch(() => setCompletedIds(new Set()));
  }, [user]);

  const challengesWithCompletion = useMemo(() => {
    return challenges.map((c) => {
      const isDone = completedIds.has(c.id);
      return {
        ...c,
        status: isDone ? "completed" : c.status,
      };
    });
  }, [completedIds]);

  const filteredChallenges = challengesWithCompletion.filter((challenge) => {
    const matchesCategory = selectedCategory === "All" || challenge.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === "All Levels" || challenge.difficulty === selectedDifficulty;
    const matchesSearch = challenge.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  const activeFiltersCount = (selectedCategory !== "All" ? 1 : 0) + (selectedDifficulty !== "All Levels" ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory("All");
    setSelectedDifficulty("All Levels");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
              CHALLENGES
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Complete <span className="gradient-text">Challenges</span>, Earn XP
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Test your skills with real-world challenges and level up your career
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4 md:p-6 mb-8"
          >
            {/* Mobile Layout */}
            <div className="flex flex-col gap-4 md:hidden">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search challenges..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card/60 border-white/10"
                />
              </div>

              {/* Filter Dropdown Button */}
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-card/60 border border-white/10 text-left"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Collapsible Filters */}
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-2">
                      {/* Category Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-card/60 border border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {categories.map((category) => (
                            <option key={category} value={category} className="bg-card text-foreground">
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Difficulty Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Difficulty</label>
                        <select
                          value={selectedDifficulty}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-card/60 border border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {difficulties.map((difficulty) => (
                            <option key={difficulty} value={difficulty} className="bg-card text-foreground">
                              {difficulty}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Clear Filters */}
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={clearFilters}
                          className="flex items-center gap-2 text-sm text-destructive hover:underline"
                        >
                          <X className="w-4 h-4" />
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Filter Tags */}
              {activeFiltersCount > 0 && !isFilterOpen && (
                <div className="flex flex-wrap gap-2">
                  {selectedCategory !== "All" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                      {selectedCategory}
                      <button onClick={() => setSelectedCategory("All")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedDifficulty !== "All Levels" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm">
                      {selectedDifficulty}
                      <button onClick={() => setSelectedDifficulty("All Levels")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:block">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search challenges..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card/60 border-white/10"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === category
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Filter */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
                <Filter className="w-5 h-5 text-muted-foreground mr-2" />
                {difficulties.map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedDifficulty === difficulty
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Challenges Grid */}
          <motion.div
            layout
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredChallenges.map((challenge, index) => (
                <motion.div
                  key={challenge.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <div className="glass-card card-3d border-glow overflow-hidden h-full">
                    {/* Image Header */}
                    <div className="relative h-32 bg-gradient-to-br from-card to-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={challenge.image}
                        alt={challenge.category}
                        className="w-20 h-20 object-contain opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      
                      {/* Status Badge */}
                      {challenge.status && statusBadges[challenge.status] && (
                        <span className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold ${statusBadges[challenge.status].className}`}>
                          {statusBadges[challenge.status].label}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Category & Difficulty */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-muted-foreground">{challenge.category}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${difficultyColors[challenge.difficulty]}`}>
                          {challenge.difficulty}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-display font-bold mb-3 group-hover:text-primary transition-colors">
                        {challenge.title}
                      </h3>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-primary" />
                          <span className="font-bold text-primary">{challenge.xp} XP</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{challenge.duration}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Star className="w-4 h-4 text-level-gold" />
                          <span>{challenge.rating}</span>
                        </div>
                      </div>

                      {/* Participants */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {challenge.participants.toLocaleString()} participants
                        </span>
                        <Button variant="outline" size="sm" className="group/btn" asChild>
                          {/* Open challenge workspace in free timer mode so user can start coding immediately */}
                          <Link to={`/challenges/${challenge.id}?timer=free`}>
                            {challenge.status === "in-progress" ? "Continue" : challenge.status === "completed" ? "Review" : "Start"}
                            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Empty State */}
          {filteredChallenges.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold mb-2">No challenges found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search query</p>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
