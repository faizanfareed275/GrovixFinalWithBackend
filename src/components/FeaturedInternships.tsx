import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, ArrowRight, Clock, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import achievementBadge from "@/assets/achievement-badge.png";
import { apiFetch } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function FeaturedInternships() {
  const [userXP, setUserXP] = useState(0);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<{ xp: number }>("/xp/me")
      .then((d) => setUserXP(Number(d.xp) || 0))
      .catch(() => {});

    apiFetch<{ internships: any[] }>("/internships")
      .then((d) => {
        if (Array.isArray(d.internships)) setItems(d.internships);
      })
      .catch(() => {});
  }, []);

  const internships = useMemo(() => {
    return items.slice(0, 4).map((i) => ({
      id: i.id,
      title: i.title,
      company: i.company,
      type: i.type,
      xpRequired: i.xpRequired,
      salary: i.salary,
      duration: i.duration,
      skills: i.skills,
      unlocked: userXP >= i.xpRequired,
    }));
  }, [items, userXP]);

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-card/30 via-transparent to-card/30" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium mb-4">
            INTERNSHIP TRACKS
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Unlock <span className="gradient-text-green">Real Opportunities</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Earn XP, complete challenges, and unlock free and paid internships at top companies
          </p>
        </motion.div>

        {/* Track Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Unlock className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Free Track</span>
            <span className="text-xs text-muted-foreground">Beginner Friendly</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-level-gold/10 border border-level-gold/20">
            <Star className="w-4 h-4 text-level-gold" />
            <span className="text-sm font-medium">Paid Track</span>
            <span className="text-xs text-muted-foreground">Advanced Level</span>
          </div>
        </motion.div>

        {/* Internships Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {internships.map((internship) => (
            <motion.div
              key={internship.id}
              variants={cardVariants}
              className="group relative"
            >
              <div className={`glass-card card-3d p-6 h-full ${!internship.unlocked ? 'opacity-75' : ''}`}>
                {/* Lock Overlay */}
                {!internship.unlocked && (
                  <div className="absolute inset-0 bg-cyber-dark/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {internship.xpRequired.toLocaleString()} XP Required
                      </p>
                    </div>
                  </div>
                )}

                {/* Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={internship.type === 'free' ? 'badge-free' : 'badge-paid'}>
                    {internship.type === 'free' ? 'Free Track' : 'Paid Track'}
                  </span>
                  {internship.unlocked && (
                    <Unlock className="w-4 h-4 text-accent" />
                  )}
                </div>

                {/* Company Logo Placeholder */}
                <div className="w-12 h-12 rounded-lg bg-card border border-white/10 flex items-center justify-center mb-4">
                  <img 
                    src={achievementBadge} 
                    alt="Company" 
                    className="w-8 h-8 object-contain"
                  />
                </div>

                {/* Content */}
                <h3 className="text-lg font-display font-bold mb-1 group-hover:text-primary transition-colors">
                  {internship.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {internship.company}
                </p>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{internship.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-primary" />
                    <span>{internship.xpRequired.toLocaleString()} XP required</span>
                  </div>
                  {internship.salary && (
                    <div className="text-sm font-bold text-accent">
                      {internship.salary}
                    </div>
                  )}
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {internship.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {internship.unlocked && (
                  <Button variant="outline" size="sm" className="w-full">
                    Apply Now
                  </Button>
                )}
              </div>
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
          <Link to="/internships">
            <Button variant="neon-green" size="lg">
              View All Internships
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
