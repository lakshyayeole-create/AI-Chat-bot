import { getImageUrl } from '../utils/assets';

export type EventItem = {
  id: string;
  name: string;
  category: string;
  organizer: string;
  date: string;
  teamSize?: string;
  prizePool: string;
  description: string;
  logoUrl?: string;
  accent: string; // Used for subtle borders/glows
  url?: string;
};

export const allEventsData: EventItem[] = [
  {
    id: "masterchef-ui",
    name: "MasterChef UI",
    category: "UI/UX Design",
    organizer: "GDGC PCCOE",
    date: "9 October 2026",
    teamSize: "1–2 members",
    prizePool: "₹12K+ + Goodies",
    description: "3-round UI/UX design competition. Registration: Free for PCCOE students / ₹100 for other colleges",
    accent: "#ef4444", // Red
    logoUrl: getImageUrl("/logos/masterchefui.webp", "/logos/masterchefui.webp"),
    url: "https://masterchefui-gdgc.vercel.app/"
  },
  {
    id: "shesolves-3",
    name: "SheSolves 3.0",
    category: "Hackathon / Software Dev",
    organizer: "ACM-W PCCOE",
    date: "9 October 2026 (Final Round)",
    teamSize: "2–4 female students",
    prizePool: "₹16K+",
    description: "Women-focused hackathon based on innovation and problem solving.",
    logoUrl: getImageUrl("/logos/shesolves-logo.webp", "/logos/shesolves-logo.webp"),
    accent: "#22c55e", // Green
    url: "https://shesolves3-0.vercel.app/"
  },
  {
    id: "codigo",
    name: "CODIGO!",
    category: "Competitive Programming",
    organizer: "CESA-SDW / ACM PCCOE",
    date: "10 October 2026 (Final Round)",
    teamSize: "Individual (1 member)",
    prizePool: "₹18K+",
    logoUrl: getImageUrl("/logos/codigo.webp", "/logos/codigo.webp"),
    description: "Coding competition focused on problem solving.",
    accent: "#eab308", // Yellow/Gold
    url: "https://pccoe-codigo-2026.vercel.app/"
  },
  {
    id: "byteme",
    name: "BYTE ME CTF '26",
    category: "Cybersecurity / CTF",
    organizer: "OWASP PCCOE",
    date: "9 October 2026 | 9AM - 6PM",
    teamSize: "1–2 members",
    prizePool: "₹1.5 LAKH+",
    description: "Cybersecurity CTF covering Web, OSINT, Forensics, Cryptography, Networking, Linux and more.",
    accent: "#f97316", // Orange
    logoUrl: getImageUrl("/logos/byte.webp", "/logos/byte.webp"),
    url: "https://bytemectf.owasppccoe.in/"
  },
  {
    id: "decentrahack",
    name: "DecentraHack 2.0",
    category: "Hackathon",
    organizer: "LFDT PCCOE",
    date: "9 October 2026 (Final Pitch)",
    teamSize: "2–4 members",
    prizePool: "₹15K+",
    description: "3-round hackathon involving ideation, building and pitching. Tracks: Agentic AI, Blockchain/Web3, Open Source.",
    accent: "#3b82f6", // Blue
    logoUrl: getImageUrl("/logos/Decentra-hack.webp", "/logos/Decentra-hack.webp"),
    url: "https://decentrahack.vercel.app/"
  },
  {
    id: "iothrone",
    name: "IoThrone 2026",
    category: "AI/ML/IoT/Hardware",
    organizer: "IRIS PCCOE",
    date: "9-10 October 2026",
    teamSize: "2–4 members",
    prizePool: "₹15K+",
    logoUrl: getImageUrl("/logos/iothrone.webp", "/logos/iothrone.webp"),
    description: "Innovation-driven hackathon involving prototype development and real-time integration.",
    accent: "#a855f7", // Purple
    url: "https://iothrone.vercel.app/"
  },
  {
    id: "make-a-doodle",
    name: "Make a Doodle",
    category: "Creative / Art",
    organizer: "Computer Department Art Circle",
    date: "10 October 2026 (Round 2)",
    prizePool: "₹13K+",
    description: "Creative doodle competition where participants create a doodle based on a given topic, followed by an offline twist round.",
    accent: "#f8fafc", // White/Silver
    logoUrl: getImageUrl("/logos/make_a_doddle.webp", "/logos/make_a_doddle.webp"),
    url: "https://make-a-doodle.vercel.app/"
  },
  {
    id: "innovate-x",
    name: "INNOVATE-X",
    category: "Capstone Project & System Architecture",
    organizer: "Dept of Computer Engineering / CESA, ACM, ACM-W, OWASP, GDGC, IRIS",
    date: "6 & 10 October 2026",
    teamSize: "Max 4 members (Compulsory for B.Tech Final-Year)",
    prizePool: "₹12,000 (1st: ₹6K | 2nd: ₹4K | 3rd: ₹2K)",
    description: "B.Tech final-year capstone project presentation and system architecture showcase before an expert evaluation panel. Round 1: Online PPT submission (6 Oct). Round 2: Offline final presentation (10 Oct).",
    accent: "#06b6d4",
    logoUrl: getImageUrl("/logos/ANANTYA.webp", "/logos/ANANTYA.webp"),
    url: "https://innovate-x-blue.vercel.app/"
  }
];
