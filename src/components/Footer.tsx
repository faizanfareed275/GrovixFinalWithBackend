import { Link } from "react-router-dom";
import { Zap, Github, Twitter, Linkedin, Youtube, Mail } from "lucide-react";

const footerLinks = {
  Platform: [
    { name: "Challenges", href: "/challenges" },
    { name: "Internships", href: "/internships" },
    { name: "Community", href: "/community" },
    { name: "Recruiters", href: "/recruiters" },
  ],
  Resources: [
    { name: "Guidelines", href: "/guidelines" },
    { name: "Blog", href: "/blog" },
    { name: "Help Center", href: "/help" },
    { name: "API Docs", href: "/docs" },
  ],
  Company: [
    { name: "About", href: "/about" },
    { name: "Careers", href: "/careers" },
    { name: "Press", href: "/press" },
    { name: "Partners", href: "/partners" },
  ],
  Legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
    { name: "Cookies", href: "/cookies" },
  ],
};

const socialLinks = [
  { name: "GitHub", icon: Github, href: ((import.meta as any).env?.VITE_GROVIX_GITHUB_URL as string) || "" },
  { name: "Twitter", icon: Twitter, href: ((import.meta as any).env?.VITE_GROVIX_TWITTER_URL as string) || "" },
  { name: "LinkedIn", icon: Linkedin, href: ((import.meta as any).env?.VITE_GROVIX_LINKEDIN_URL as string) || "" },
  { name: "YouTube", icon: Youtube, href: ((import.meta as any).env?.VITE_GROVIX_YOUTUBE_URL as string) || "" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-cyber-darker">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-neon flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyber-dark" />
              </div>
              <span className="font-display text-xl font-bold gradient-text">
                Grovix
              </span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-xs">
              The gamified skill-building platform where youth learn, level up, and get hired.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks
                .filter((s) => typeof s.href === "string" && s.href.trim() && s.href.trim() !== "#")
                .map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-card/60 border border-white/5 flex items-center justify-center hover:bg-primary/10 hover:border-primary/20 transition-colors"
                    aria-label={social.name}
                  >
                    <social.icon className="w-5 h-5 text-muted-foreground hover:text-primary" />
                  </a>
                ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Grovix. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <a href="mailto:hello@grovix.com" className="hover:text-primary transition-colors">
              hello@grovix.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
