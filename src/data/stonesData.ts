export interface StoneData {
  id: string;
  name: string;
  stoneNumber: string;
  category: string;
  title: string;
  day: string;
  time: string;
  venue: string;
  color: string;
  glowColor: string;
  description: string;
  highlights: string[];
  angleIndex: number;
  link?: string;
}

export const STONES_DATA: StoneData[] = [
  {
    id: 'mind',
    name: 'Mind Stone',
    stoneNumber: '01',
    category: 'ACM // COMPETITIVE PROGRAMMING',
    title: 'Codigo',
    day: 'Day 1',
    time: '10:00 AM – 01:30 PM',
    venue: 'Turing Terminal Labs',
    color: '#ffd600', // Pure Yellow
    glowColor: '#fff275',
    description:
      'The ultimate arena of competitive programming and algorithmic supremacy hosted by ACM. Battle through multi-round coding gauntlets, sub-second optimizations, and problem-solving puzzles.',
    highlights: ['Multi-Tier Algorithm Clash', 'Speed Optimization Duel', 'Algorithmic Problem-Solving Arena'],
    angleIndex: 0,
    link: '',
  },
  {
    id: 'time',
    name: 'Time Stone',
    stoneNumber: '02',
    category: 'ACM-W // WOMEN IN TECH',
    title: 'She Solves 3.0',
    day: 'Day 1',
    time: '02:00 PM – 06:30 PM',
    venue: 'Ada Lovelace Tech Arena',
    color: '#00e676', // Pure Green
    glowColor: '#69f0ae',
    description:
      'Empowering female developers and tech innovators hosted by ACM-W. Ideate, prototype, and build transformative digital solutions addressing critical real-world industry challenges.',
    highlights: ['Women In Tech Hackathon', 'Rapid Prototyping Sprint', 'Industry Mentorship Conclave'],
    angleIndex: 1,
    link: '',
  },
  {
    id: 'soul',
    name: 'Soul Stone',
    stoneNumber: '03',
    category: 'OWASP // CYBERSECURITY & CTF',
    title: 'Byte me CTF',
    day: 'Day 2',
    time: '10:00 AM – 03:00 PM',
    venue: 'Cyber Defense Complex',
    color: '#ff6d00', // Pure Orange
    glowColor: '#ffab40',
    description:
      'Test your offensive and defensive security mettle in an elite Capture The Flag warfare arena hosted by OWASP. Decrypt cryptographic ciphers, exploit web vulnerabilities, and reverse-engineer binaries.',
    highlights: ['Capture The Flag (CTF) War', 'Zero-Day Vulnerability Exploits', 'Cryptographic Puzzle Quests'],
    angleIndex: 2,
    link: '',
  },
  {
    id: 'reality',
    name: 'Reality Stone',
    stoneNumber: '04',
    category: 'GDGC // DESIGN & UI/UX',
    title: 'MasterChef UI',
    day: 'Day 2',
    time: '03:30 PM – 07:00 PM',
    venue: 'Holodeck Design Studio',
    color: '#ff1744', // Pure Red
    glowColor: '#ff616f',
    description:
      'Cook up stunning, high-fidelity user experiences and micro-interactions under the clock hosted by GDGC. Blend visual aesthetics, accessibility, and modern component systems to craft award-winning UI.',
    highlights: ['Live UI/UX Cookoff', 'Figma Rapid Prototyping', 'Component System Architecture'],
    angleIndex: 3,
    link: '',
  },
  {
    id: 'space',
    name: 'Space Stone',
    stoneNumber: '05',
    category: 'LFDT // BLOCKCHAIN & WEB3',
    title: 'Decentral Hack',
    day: 'Day 3',
    time: '09:30 AM – 01:30 PM',
    venue: 'Genesis Web3 Labs',
    color: '#00a8ff', // Pure Blue
    glowColor: '#40c4ff',
    description:
      'Pioneer the decentralized frontier hosted by LFDT. Architect smart contracts, engineer zero-knowledge proofs, and forge resilient Web3 protocols for the next era of decentralized finance and web.',
    highlights: ['Smart Contract Security', 'DeFi & Zero-Knowledge Protocols', 'Decentralized Apps Sprint'],
    angleIndex: 4,
    link: '',
  },
  {
    id: 'power',
    name: 'Power Stone',
    stoneNumber: '06',
    category: 'IIRIS // IOT & ROBOTICS',
    title: 'IoThrone',
    day: 'Day 3',
    time: '02:00 PM – 05:30 PM',
    venue: 'Titanium Combat Arena',
    color: '#a855f7', // Pure Purple
    glowColor: '#d8b4fe',
    description:
      'Claim the throne of connected machines and physical computing hosted by IIRIS. Interface microcontrollers, build automated robotics pipelines, and execute real-time sensor telemetry challenges.',
    highlights: ['Hardware Sensor Warfare', 'Microcontroller Automation', 'Embedded Telemetry Duel'],
    angleIndex: 5,
    link: '',
  },
  {
    id: 'art',
    name: 'Soul Stone',
    stoneNumber: '07',
    category: 'ART CLUB // CREATIVE DESIGN',
    title: 'Make a Doodle',
    day: 'Day 3',
    time: '04:00 PM – 07:00 PM',
    venue: 'Cosmic Open-Air Amphitheatre',
    color: '#ffffff', // Pure White Diamond / Cosmic Prism
    glowColor: '#e0f7fa',
    description:
      'Unleash raw creative energy onto the cosmic canvas hosted by ART CLUB. Speed doodling showdowns, character illustration battles, and expressive visual design celebrating imagination and artistic flair.',
    highlights: ['Live Doodle Faceoff', 'Character Illustration Clash', 'Cosmic Canvas Creation'],
    angleIndex: 6,
    link: '',
  },
  {
    id: 'innovatex',
    name: 'Brown Stone',
    stoneNumber: '08',
    category: 'INNOVATEX // FLAGSHIP EXPO',
    title: 'Innovatex',
    day: 'Day 3',
    time: '05:30 PM – 09:30 PM',
    venue: 'Quantum Grand Foundry & Auditorium',
    color: '#8B4513', // Deep Earth Bronze Brown
    glowColor: '#CD853F',
    description:
      'The grand flagship expo and convergence of engineering excellence. Visionary student developers, makers, and innovators demonstrate breakthrough hardware prototypes, AI innovations, and research ventures.',
    highlights: ['Grand Project Expo', 'Startup Pitch Arena', 'Breakthrough Hardware Showcase'],
    angleIndex: 7,
    link: '',
  },
];
