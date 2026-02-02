import { motion } from "framer-motion";
import { Gamepad2, Trophy, Briefcase, Users, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Gamepad2,
    title: "Gamified Learning",
    description: "Complete challenges, earn XP, and level up your skills in an engaging game-like experience",
    color: "primary",
  },
  {
    icon: Trophy,
    title: "Real Achievements",
    description: "Unlock badges, certificates, and recognition that employers actually value",
    color: "level-gold",
  },
  {
    icon: Briefcase,
    title: "Direct Job Pipeline",
    description: "Your XP profile gets you noticed by recruiters looking for proven talent",
    color: "accent",
  },
  {
    icon: Users,
    title: "Community Driven",
    description: "Learn with peers, get feedback from mentors, and grow together",
    color: "secondary",
  },
  {
    icon: Zap,
    title: "Instant Feedback",
    description: "Get real-time assessments and AI-powered guidance on your submissions",
    color: "primary",
  },
  {
    icon: Shield,
    title: "Verified Skills",
    description: "Every achievement is verified and blockchain-backed for authenticity",
    color: "accent",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function WhyYouthXP() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
            WHY GROVIX?
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            The Future of <span className="gradient-text">Skill Building</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We've reimagined how young professionals learn, prove, and market their skills
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="group"
            >
              <div className="glass-card p-6 h-full border-glow hover:bg-card/80 transition-all duration-300">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-${feature.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-7 h-7 text-${feature.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-display font-bold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
