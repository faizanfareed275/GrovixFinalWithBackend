import { motion } from "framer-motion";
import { ArrowRight, Play, Zap, Trophy, Users, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XPBar } from "@/components/XPBar";
import heroBg from "@/assets/hero-bg.jpg";

const stats = [
  { icon: Users, value: "50K+", label: "Active Learners" },
  { icon: Zap, value: "1M+", label: "XP Earned" },
  { icon: Trophy, value: "10K+", label: "Challenges Completed" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Background - Light Theme Optimized */}
      <div className="absolute inset-0">
        {/* Dark mode: show image */}
        <img
          src={heroBg}
          alt="Futuristic background"
          className="w-full h-full object-cover opacity-0 dark:opacity-40 transition-opacity"
        />
        
        {/* Light mode: gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 dark:from-cyber-dark/60 dark:via-cyber-dark/80 dark:to-cyber-dark" />
        
        {/* Decorative circles for light mode */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl dark:bg-neon-purple/10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl dark:bg-neon-blue/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl dark:bg-neon-green/5" />
      </div>

      {/* Animated Grid Lines */}
      <div className="absolute inset-0 opacity-10 dark:opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--primary) / 0.2) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--primary) / 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Floating decorative elements for light mode */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 right-1/4 hidden lg:block"
      >
        <Sparkles className="w-8 h-8 text-primary/30 dark:text-neon-blue/30" />
      </motion.div>
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/3 left-1/4 hidden lg:block"
      >
        <Rocket className="w-10 h-10 text-secondary/30 dark:text-neon-purple/30" />
      </motion.div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-sm font-medium text-foreground">
              Join 50,000+ learners leveling up their skills
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-black mb-6 leading-tight"
          >
            <span className="text-foreground">Learn.</span>{" "}
            <span className="gradient-text">Level Up.</span>{" "}
            <span className="text-foreground">Get</span>{" "}
            <span className="gradient-text-green">Hired.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            The gamified skill-building platform where you complete challenges, 
            earn XP, unlock internships, and get hired by top companies.
          </motion.p>

          {/* XP Demo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-md mx-auto mb-10"
          >
            <XPBar currentXP={7500} maxXP={10000} level={12} />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button variant="neon" size="xl" className="group">
              Start Free Internship Track
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="glass" size="xl" className="group">
              <Play className="w-5 h-5" />
              Explore Challenges
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-card/60 border border-white/10 mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl md:text-4xl font-display font-bold gradient-text mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Floating Elements */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-10 top-1/3 w-20 h-20 rounded-full bg-secondary/20 dark:bg-neon-purple/20 blur-xl"
      />
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-10 bottom-1/3 w-32 h-32 rounded-full bg-primary/20 dark:bg-neon-blue/20 blur-xl"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/4 bottom-1/4 w-24 h-24 rounded-full bg-accent/15 dark:bg-neon-green/15 blur-xl hidden lg:block"
      />
    </section>
  );
}
