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
    logoUrl: "/logos/masterchefui.webp",
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
    logoUrl: "/logos/shesolves-logo.webp",
    accent: "#22c55e", // Green
    url: "https://shesolves3-0.vercel.app/"
  },
  {
    id: "codigo",
    name: "CODIGO!",
    category: "Competitive Programming",
    organizer: "CESA-SDW / ACM PCCOE",
    date: "10 October 2026 (Final Round)",
    prizePool: "₹18K+",
    logoUrl: "/logos/codigo.webp",
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
    logoUrl: "/logos/byte.webp",
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
    logoUrl: "/logos/Decentra-hack.webp",
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
    logoUrl: "/logos/iothrone.webp",
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
    logoUrl: "/logos/make_a_doddle.webp",
    url: "https://make-a-doodle.vercel.app/"
  }
];
