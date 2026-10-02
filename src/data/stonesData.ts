import { allEventsData } from '../components/allEventsData';

export interface StoneData {
  id: string;
  eventId?: string;
  name: string;
  stoneNumber: string;
  category: string;
  organizer?: string;
  title: string;
  day: string;
  time?: string;
  venue?: string;
  color: string;
  glowColor: string;
  description: string;
  highlights: string[];
  angleIndex: number;
  link?: string;
  url?: string;
  teamSize?: string;
  prizePool?: string;
  logoUrl?: string;
}

const RAW_STONES_DATA: StoneData[] = [
  {
    id: 'mind',
    eventId: 'codigo',
    name: 'Mind Stone',
    stoneNumber: '01',
    category: 'Competitive Programming',
    organizer: 'CESA-SDW / ACM PCCOE',
    title: 'CODIGO!',
    day: '10 October 2026 (Final Round)',
    color: '#eab308',
    glowColor: '#fde047',
    description: 'Coding competition focused on problem solving.',
    highlights: ['Problem Solving', 'Competitive Coding', 'CESA-SDW'],
    angleIndex: 0,
    url: 'https://pccoe-codigo-2026.vercel.app/',
    link: 'https://pccoe-codigo-2026.vercel.app/',
    prizePool: '₹18K+',
    logoUrl: '/logos/codigo.png',
  },
  {
    id: 'time',
    eventId: 'shesolves-3',
    name: 'Time Stone',
    stoneNumber: '02',
    category: 'Hackathon / Software Dev',
    organizer: 'ACM-W PCCOE',
    title: 'SheSolves 3.0',
    day: '9 October 2026 (Final Round)',
    color: '#22c55e',
    glowColor: '#86efac',
    description: 'Women-focused hackathon based on innovation and problem solving.',
    highlights: ['Women in Tech', 'Software Dev', 'ACM-W'],
    angleIndex: 1,
    url: 'https://shesolves3-0.vercel.app/',
    link: 'https://shesolves3-0.vercel.app/',
    teamSize: '2–4 female students',
    prizePool: '₹16K+',
    logoUrl: '/logos/shesolves-logo.png',
  },
  {
    id: 'soul',
    eventId: 'byteme',
    name: 'Soul Stone',
    stoneNumber: '03',
    category: 'Cybersecurity / CTF',
    organizer: 'OWASP PCCOE',
    title: "BYTE ME CTF '26",
    day: '9 October 2026 | 9AM - 6PM',
    color: '#f97316',
    glowColor: '#fdba74',
    description: 'Cybersecurity CTF covering Web, OSINT, Forensics, Cryptography, Networking, Linux and more.',
    highlights: ['Web Exploits', 'Cryptography', 'Forensics'],
    angleIndex: 2,
    url: 'https://bytemectf.owasppccoe.in/',
    link: 'https://bytemectf.owasppccoe.in/',
    teamSize: '1–2 members',
    prizePool: '₹1.5 LAKH+',
    logoUrl: '/logos/byte.png',
  },
  {
    id: 'reality',
    eventId: 'masterchef-ui',
    name: 'Reality Stone',
    stoneNumber: '04',
    category: 'UI/UX Design',
    organizer: 'GDGC PCCOE',
    title: 'MasterChef UI',
    day: '9 October 2026',
    color: '#ef4444',
    glowColor: '#fca5a5',
    description: '3-round UI/UX design competition. Registration: Free for PCCOE students / ₹100 for other colleges',
    highlights: ['UI/UX Prototyping', 'Design Systems', 'GDGC'],
    angleIndex: 3,
    url: 'https://masterchefui-gdgc.vercel.app/',
    link: 'https://masterchefui-gdgc.vercel.app/',
    teamSize: '1–2 members',
    prizePool: '₹12K+ + Goodies',
    logoUrl: '/logos/masterchefui.png',
  },
  {
    id: 'space',
    eventId: 'decentrahack',
    name: 'Space Stone',
    stoneNumber: '05',
    category: 'Hackathon',
    organizer: 'LFDT PCCOE',
    title: 'DecentraHack 2.0',
    day: '9 October 2026 (Final Pitch)',
    color: '#3b82f6',
    glowColor: '#93c5fd',
    description: '3-round hackathon involving ideation, building and pitching. Tracks: Agentic AI, Blockchain/Web3, Open Source.',
    highlights: ['Agentic AI', 'Blockchain / Web3', 'Open Source'],
    angleIndex: 4,
    url: 'https://decentrahack.vercel.app/',
    link: 'https://decentrahack.vercel.app/',
    teamSize: '2–4 members',
    prizePool: '₹15K+',
    logoUrl: '/logos/Decentra-hack.png',
  },
  {
    id: 'power',
    eventId: 'iothrone',
    name: 'Power Stone',
    stoneNumber: '06',
    category: 'AI/ML/IoT/Hardware',
    organizer: 'IRIS PCCOE',
    title: 'IoThrone 2026',
    day: '9-10 October 2026',
    color: '#a855f7',
    glowColor: '#d8b4fe',
    description: 'Innovation-driven hackathon involving prototype development and real-time integration.',
    highlights: ['Hardware Prototype', 'AI/ML IoT', 'IRIS PCCOE'],
    angleIndex: 5,
    url: 'https://iothrone.vercel.app/',
    link: 'https://iothrone.vercel.app/',
    teamSize: '2–4 members',
    prizePool: '₹15K+',
    logoUrl: '/logos/iothrone.png',
  },
  {
    id: 'art',
    eventId: 'make-a-doodle',
    name: 'Soul Stone',
    stoneNumber: '07',
    category: 'Creative / Art',
    organizer: 'Computer Department Art Circle',
    title: 'Make a Doodle',
    day: '10 October 2026 (Round 2)',
    color: '#f8fafc',
    glowColor: '#ffffff',
    description: 'Creative doodle competition where participants create a doodle based on a given topic, followed by an offline twist round.',
    highlights: ['Live Doodle', 'Creative Art', 'Offline Twist'],
    angleIndex: 6,
    url: 'https://make-a-doodle.vercel.app/',
    link: 'https://make-a-doodle.vercel.app/',
    teamSize: 'Individual (1 member)',
    prizePool: '₹13K+',
    logoUrl: '/logos/make_a_doddle.png',
  },
  {
    id: 'innovatex',
    eventId: 'innovatex',
    name: 'Brown Stone',
    stoneNumber: '08',
    category: 'Flagship Expo',
    organizer: 'PCCOE Innovation Council',
    title: 'Innovatex 2026',
    day: '10 October 2026 | Grand Expo',
    color: '#d97706',
    glowColor: '#fcd34d',
    description: 'Grand flagship expo showcasing cutting-edge engineering prototypes, AI breakthroughs, and venture pitches.',
    highlights: ['Flagship Expo', 'Startup Pitch', 'Prototypes'],
    angleIndex: 7,
    link: '#',
    teamSize: '1–4 members',
    prizePool: '₹50K+',
    logoUrl: '/logos/ANANTYA.png',
  },
];

export const STONES_DATA: StoneData[] = RAW_STONES_DATA.map((stone) => {
  const match = allEventsData.find((e) => e.id === stone.eventId || e.id === stone.id);
  if (!match) return stone;
  const resolvedUrl = match.url || stone.url || stone.link;
  return {
    ...stone,
    title: match.name || stone.title,
    category: match.category || stone.category,
    organizer: match.organizer || stone.organizer,
    day: match.date || stone.day,
    teamSize: match.teamSize || stone.teamSize,
    prizePool: match.prizePool || stone.prizePool,
    description: match.description || stone.description,
    logoUrl: match.logoUrl || stone.logoUrl,
    color: match.accent || stone.color,
    url: resolvedUrl,
    link: resolvedUrl,
  };
});
