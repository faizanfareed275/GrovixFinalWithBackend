import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import skillAI from "@/assets/skill-ai.png";
import skillWebDev from "@/assets/skill-webdev.png";
import skillGameDev from "@/assets/skill-gamedev.png";

const skills = [
  {
    name: "Artificial Intelligence",
    description: "Master machine learning, neural networks, and AI applications",
    image: skillAI,
    xp: "5,000+ XP",
    challenges: 45,
    color: "neon-purple",
  },
  {
    name: "Web Development",
    description: "Build modern web apps with React, Node.js, and cloud technologies",
    image: skillWebDev,
    xp: "4,500+ XP",
    challenges: 52,
    color: "neon-green",
  },
  {
    name: "Game Development",
    description: "Create immersive games with Unity, Unreal, and WebGL",
    image: skillGameDev,
    xp: "4,800+ XP",
    challenges: 38,
    color: "neon-blue",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function SkillDomains() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium mb-4">
            SKILL DOMAINS
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Master <span className="gradient-text">In-Demand Skills</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your path and start leveling up with hands-on challenges
          </p>
        </motion.div>

        {/* Skills Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {skills.map((skill) => (
            <motion.div
              key={skill.name}
              variants={cardVariants}
              className="group"
            >
              <Link to="/challenges" className="block">
                <div className="glass-card card-3d border-glow p-6 h-full relative overflow-hidden">
                  {/* Glow Effect */}
                  <div className={`absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-${skill.color}/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  {/* Image */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <img
                      src={skill.image}
                      alt={skill.name}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-neon rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-display font-bold mb-2 text-center group-hover:text-primary transition-colors">
                    {skill.name}
                  </h3>
                  <p className="text-muted-foreground text-center mb-6 text-sm">
                    {skill.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{skill.xp}</div>
                      <div className="text-xs text-muted-foreground">Available</div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent">{skill.challenges}</div>
                      <div className="text-xs text-muted-foreground">Challenges</div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore Path <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-12"
        >
          <Link 
            to="/challenges"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            View All Skill Domains
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
