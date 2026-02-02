import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { WhyYouthXP } from "@/components/WhyYouthXP";
import { SkillDomains } from "@/components/SkillDomains";
import { FeaturedInternships } from "@/components/FeaturedInternships";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <WhyYouthXP />
        <SkillDomains />
        <FeaturedInternships />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
