export interface Internship {
  id: number;
  title: string;
  company: string;
  type: "free" | "paid";
  xpRequired: number;
  salary: string | null;
  duration: string;
  location: string;
  skills: string[];
  description: string;
  applicants: number;
  imageUrl?: string | null;
  imageFileId?: string | null;
}

export const defaultInternships: Internship[] = [
  // Free Track
  {
    id: 1,
    title: "AI Research Assistant",
    company: "TechAI Labs",
    type: "free",
    xpRequired: 0,
    salary: null,
    duration: "4 weeks",
    location: "Remote",
    skills: ["Python", "TensorFlow", "Data Analysis"],
    description: "Work on cutting-edge AI research projects and learn from industry experts.",
    applicants: 234,
  },
  {
    id: 2,
    title: "Frontend Development Intern",
    company: "WebStudio Pro",
    type: "free",
    xpRequired: 2000,
    salary: null,
    duration: "6 weeks",
    location: "Remote",
    skills: ["React", "TypeScript", "CSS"],
    description: "Build beautiful, responsive web applications using modern frameworks.",
    applicants: 456,
  },
  {
    id: 3,
    title: "Data Science Trainee",
    company: "DataMinds Inc",
    type: "free",
    xpRequired: 3000,
    salary: null,
    duration: "8 weeks",
    location: "Hybrid",
    skills: ["Python", "SQL", "Machine Learning"],
    description: "Analyze datasets and build predictive models for real-world problems.",
    applicants: 189,
  },
  // Paid Track
  {
    id: 4,
    title: "Full Stack Engineer Intern",
    company: "CloudScale",
    type: "paid",
    xpRequired: 5000,
    salary: "$2,000/month",
    duration: "3 months",
    location: "San Francisco, CA",
    skills: ["Node.js", "React", "PostgreSQL"],
    description: "Build scalable cloud applications serving millions of users.",
    applicants: 123,
  },
  {
    id: 5,
    title: "Game Developer Intern",
    company: "GameForge Studios",
    type: "paid",
    xpRequired: 6000,
    salary: "$2,500/month",
    duration: "4 months",
    location: "Los Angeles, CA",
    skills: ["Unity", "C#", "3D Modeling"],
    description: "Create immersive gaming experiences for next-gen consoles.",
    applicants: 98,
  },
  {
    id: 6,
    title: "Blockchain Developer",
    company: "CryptoVentures",
    type: "paid",
    xpRequired: 8000,
    salary: "$3,500/month",
    duration: "6 months",
    location: "Miami, FL",
    skills: ["Solidity", "Web3.js", "Smart Contracts"],
    description: "Build decentralized applications and DeFi protocols.",
    applicants: 67,
  },
  {
    id: 7,
    title: "ML Engineer Intern",
    company: "DeepMind Jr",
    type: "paid",
    xpRequired: 10000,
    salary: "$4,000/month",
    duration: "6 months",
    location: "New York, NY",
    skills: ["PyTorch", "NLP", "Computer Vision"],
    description: "Work on state-of-the-art machine learning models.",
    applicants: 45,
  },
];

export const internships: Internship[] = defaultInternships;
