/**
 * The content model.
 * Every page renders from this file, so the record is stated once and stays
 * consistent across the whole site.
 */

export const identity = {
  name: 'Justice Thinker',
  legalName: 'Emmanuel Isaac',
  role: 'Physicist · Developer · Polymath',
  statement:
    'I study how things separate when they are measured — quantum systems, arguments, and software. Three disciplines, one method.',
  email: 'justicethinker2@gmail.com',
  github: 'https://github.com/justicethinker',
  linkedin: 'https://www.linkedin.com/in/justicethinker/',
  site: 'justicethinker.github.io',
} as const;

export type NavItem = {
  href: string;
  label: string;
};

/** Four links in the masthead. A menu of nine is not navigation, it is a list. */
export const navPrimary: NavItem[] = [
  { href: '/projects', label: 'Work' },
  { href: '/blog', label: 'Writing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/** Everything, for the menu and the footer. */
export const navAll: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/physics', label: 'Physics' },
  { href: '/programming', label: 'Programming' },
  { href: '/speaking', label: 'Speaking' },
  { href: '/projects', label: 'Work' },
  { href: '/blog', label: 'Writing' },
  { href: '/cv', label: 'Record' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const disciplines = [
  'Quantum mechanics',
  'Computational physics',
  'Machine learning',
  'Systems engineering',
  'Competitive debate',
  'Science communication',
  'Instrumentation',
  'Interdisciplinary method',
];

export type Project = {
  slug: string;
  name: string;
  year: string;
  status: string;
  summary: string;
  detail: string;
  stack: string[];
  category: 'Physics' | 'AI/ML' | 'Web' | 'Interdisciplinary';
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: 'look-out',
    name: 'Look-Out AI',
    year: '2024',
    status: 'Shipped',
    summary: 'Real-time multi-object detection with predictive tracking, tuned for edge hardware.',
    detail:
      'A computer-vision pipeline built around a slimmed detection backbone with multi-camera fusion and an adaptive pass that re-learns a scene on site. Inference was cut hard enough to run without a datacentre behind it.',
    stack: ['Python', 'TensorFlow', 'OpenCV', 'CUDA'],
    category: 'AI/ML',
    featured: true,
  },
  {
    slug: 'quantum-simulator',
    name: 'Quantum Circuit Simulator',
    year: '2024',
    status: 'Research',
    summary: 'Interactive statevector simulator with live amplitude visualisation.',
    detail:
      'A simulator for circuits past twenty qubits that draws amplitudes rather than printing them, so the difference between a working circuit and a lucky one is visible. Built for teaching first and research second.',
    stack: ['Python', 'Qiskit', 'React', 'WebGL'],
    category: 'Physics',
    featured: true,
  },
  {
    slug: 'overmind',
    name: 'Overmind',
    year: '2024',
    status: 'Shipped',
    summary: 'Natural-language orchestration across systems that were never designed to talk.',
    detail:
      'Event-driven workflow engine that turns a sentence into a reliable multi-step operation, with rollback at every hop and a graph view of what the machine thought you meant.',
    stack: ['Node.js', 'GraphQL', 'NLP', 'Queues'],
    category: 'AI/ML',
  },
  {
    slug: 'wave-lab',
    name: 'Wave Dynamics Lab',
    year: '2023',
    status: 'Open source',
    summary: 'Interactive study of propagation, interference and resonance.',
    detail:
      'A numerical playground where boundary conditions are changed by hand and the resulting field is drawn immediately — the fastest way to build intuition for a system you cannot see.',
    stack: ['Python', 'NumPy', 'Matplotlib'],
    category: 'Physics',
  },
  {
    slug: 'nas',
    name: 'Neural Architecture Search',
    year: '2024',
    status: 'Research',
    summary: 'Evolutionary discovery of network topologies under a compute budget.',
    detail:
      'Population-based search with performance-weighted selection, run against a hard budget so the result has to be efficient rather than merely large.',
    stack: ['TensorFlow', 'AutoML', 'Evolutionary'],
    category: 'AI/ML',
  },
  {
    slug: 'debate-tool',
    name: 'Debate Analysis Tool',
    year: '2023',
    status: 'Shipped',
    summary: 'Argument mapping and delivery analysis for competitive debaters.',
    detail:
      'Turns a transcript into a claim-and-response graph, then scores delivery separately from argument — the distinction most coaching gets wrong.',
    stack: ['React', 'NLP', 'Analytics'],
    category: 'Interdisciplinary',
  },
  {
    slug: 'research-assistant',
    name: 'Autonomous Research Assistant',
    year: '2025',
    status: 'In progress',
    summary: 'Literature review and hypothesis generation over a scientific corpus.',
    detail:
      'Retrieval-grounded agent that reads widely, cites precisely, and is explicit about where the evidence stops. Built to surface gaps rather than answer questions.',
    stack: ['LangChain', 'RAG', 'Vector DB'],
    category: 'AI/ML',
  },
  {
    slug: 'em-mapper',
    name: 'EM Field Mapper',
    year: '2023',
    status: 'Open source',
    summary: 'High-resolution electromagnetic field mapping from a sensor array.',
    detail:
      'Custom hardware plus a real-time acquisition path, built because the affordable instruments could not resolve the gradients the experiment needed.',
    stack: ['Arduino', 'Python', '3D Viz'],
    category: 'Physics',
  },
  {
    slug: 'physics-solver',
    name: 'Physics Problem Solver',
    year: '2025',
    status: 'Beta',
    summary: 'Step-by-step symbolic solutions with the reasoning exposed.',
    detail:
      'A model paired with a computer-algebra core so the final answer is verified rather than asserted, and the intermediate work is shown because that is the part that teaches.',
    stack: ['PyTorch', 'Transformers', 'SymPy'],
    category: 'Interdisciplinary',
  },
  {
    slug: 'api-gateway',
    name: 'Universal API Gateway',
    year: '2024',
    status: 'Open source',
    summary: 'Rate limiting, auth and intelligent routing for service fleets.',
    detail:
      'A single ingress that keeps upstream services ignorant of each other, with routing decisions made on measured load rather than configuration guesswork.',
    stack: ['Node.js', 'Redis', 'Docker'],
    category: 'Web',
  },
];

export type Publication = {
  title: string;
  venue: string;
  state: string;
  abstract: string;
};

export const publications: Publication[] = [
  {
    title: 'Decoherence Mechanisms in Mesoscopic Quantum Systems',
    venue: 'Journal of Quantum Physics',
    state: 'Under review · 2024',
    abstract:
      'Decoherence timescales measured against environmental coupling in systems crossing from quantum to classical behaviour, with a scaling relation between device size and decay rate.',
  },
  {
    title: 'Wave-Particle Duality in Modern Interferometry',
    venue: 'Physics Review Letters',
    state: 'Published · 2024',
    abstract:
      'Superposition principles validated through interferometric measurement, and what those measurements imply for the coherence budget of a quantum information system.',
  },
  {
    title: 'Computational Methods in Modern Physics Research',
    venue: 'International Physics Symposium',
    state: 'Proceedings · 2024',
    abstract:
      'A survey of numerical technique from quantum simulation to cosmological modelling, organised around which method survives which kind of problem.',
  },
];

export const researchAreas = [
  {
    name: 'Quantum mechanics',
    body: 'Quantum phenomena and their consequences for computation and information processing.',
  },
  {
    name: 'Wave dynamics',
    body: 'Propagation, interference and resonance across acoustic and electromagnetic systems.',
  },
  {
    name: 'Computational physics',
    body: 'Numerical models built to test theory against data rather than illustrate it.',
  },
  {
    name: 'Instrumentation',
    body: 'Building the measurement apparatus when nothing affordable resolves the effect.',
  },
];

export type Speaking = {
  event: string;
  when: string;
  placing: string;
  format: string;
  body: string;
};

export const speaking: Speaking[] = [
  {
    event: 'National Debate Championship',
    when: '2024',
    placing: 'Champion',
    format: 'Oxford Union style',
    body: 'Took the final on the intersection of technology and human rights, closing against a field of seasoned national competitors.',
  },
  {
    event: 'Regional Parliamentary Series',
    when: '2023 — 2024',
    placing: 'Season winner',
    format: 'British Parliamentary',
    body: 'Held the highest win rate across the season in both opening and closing positions, across an unusually wide spread of motions.',
  },
  {
    event: 'International Debate Tournament',
    when: '2023',
    placing: 'Third place',
    format: 'World Schools',
    body: 'Represented the country internationally, carrying research depth into cross-examination against global fields.',
  },
];

export const talkingPoints = [
  {
    title: 'The ethics of artificial intelligence in decision making',
    venue: 'TEDx University · 2024',
    meta: '18-minute keynote · 100K+ views',
    hook: 'What it means to hand a moral decision to a system that cannot be held responsible for it.',
  },
  {
    title: "Bridging science and society: the physicist's responsibility",
    venue: 'National Science Convention · 2024',
    meta: 'Plenary address · 2,000+ attendees',
    hook: 'The case that a physicist who cannot explain their work in public has left the work unfinished.',
  },
  {
    title: 'The power of interdisciplinary thinking',
    venue: 'University Graduation Ceremony · 2024',
    meta: 'Valedictorian address',
    hook: 'How physics sharpened the code, and how debate sharpened the physics.',
  },
];

export const principles = [
  { name: 'Precision', body: 'Every word carries load. Language that respects the audience enough to be short.' },
  { name: 'Evidence', body: 'Claims built to survive scrutiny, sourced and reasoned rather than asserted.' },
  { name: 'Empathy', body: 'The opposing case understood well enough to be stated in its strongest form.' },
  { name: 'Impact', body: 'Delivery arranged to change a position, not to fill an hour.' },
];

export type Post = {
  title: string;
  date: string;
  iso: string;
  reading: string;
  topics: string[];
  dek: string;
  featured?: boolean;
};

export const posts: Post[] = [
  {
    title: 'The intersection of quantum computing and AI',
    date: 'Dec 15, 2024',
    iso: '2024-12-15',
    reading: '14 min',
    topics: ['Quantum', 'Machine learning'],
    dek: 'Where quantum advantage actually bites on learning problems, and where it is a story we tell about the future.',
    featured: true,
  },
  {
    title: 'Building better debate arguments with AI',
    date: 'Dec 10, 2024',
    iso: '2024-12-10',
    reading: '8 min',
    topics: ['AI', 'Speaking'],
    dek: 'What a decade of coaching taught me about structured argument, and what a model can genuinely add to it.',
  },
  {
    title: 'The future of web development',
    date: 'Dec 5, 2024',
    iso: '2024-12-05',
    reading: '12 min',
    topics: ['Programming', 'Performance'],
    dek: 'Why static delivery keeps winning on the metrics that users actually feel.',
  },
  {
    title: 'Quantum decoherence in mesoscopic systems',
    date: 'Nov 28, 2024',
    iso: '2024-11-28',
    reading: '15 min',
    topics: ['Physics', 'Research'],
    dek: 'The long version of the final-year project: where the quantum world stops and why it stops there.',
  },
  {
    title: 'The ethics of artificial intelligence',
    date: 'Nov 20, 2024',
    iso: '2024-11-20',
    reading: '10 min',
    topics: ['AI', 'Ethics'],
    dek: 'Responsibility is not a feature you can ship. What builders owe the people their systems act on.',
  },
  {
    title: 'The art of persuasive communication',
    date: 'Nov 15, 2024',
    iso: '2024-11-15',
    reading: '7 min',
    topics: ['Speaking', 'Craft'],
    dek: 'Techniques from competitive debate that transfer directly to a design review.',
  },
  {
    title: 'Computational physics with Python',
    date: 'Nov 8, 2024',
    iso: '2024-11-08',
    reading: '11 min',
    topics: ['Physics', 'Python'],
    dek: 'From basic numerical methods to multi-body systems and wave dynamics, without hiding the maths.',
  },
  {
    title: 'What interferometry taught me about debugging',
    date: 'Oct 30, 2024',
    iso: '2024-10-30',
    reading: '9 min',
    topics: ['Physics', 'Engineering'],
    dek: 'Interference is interference. The mental model transfers further than you would expect.',
  },
];


export type RecordEntry = {
  when: string;
  role: string;
  org: string;
  points: string[];
};

export const record: RecordEntry[] = [
  {
    when: '2023 — 2024',
    role: 'Research Assistant',
    org: 'Quantum physics laboratory',
    points: [
      'Experimental work on decoherence in mesoscopic systems',
      'Computational models in Python and MATLAB for acquisition and analysis',
      'Two co-authored papers through review in physics journals',
      'Mentored five undergraduates through their first experimental work',
    ],
  },
  {
    when: 'Summer 2023',
    role: 'Software Development Intern',
    org: 'Computer vision team',
    points: [
      'Machine-learning models for real-time visual detection',
      'Detection pipeline reaching 95% accuracy on production footage',
      'Edge deployment work cutting inference time by roughly 40%',
    ],
  },
  {
    when: '2022 — Present',
    role: 'Debate Coach & Judge',
    org: 'National debate circuit',
    points: [
      'Coached over 150 students across multiple institutions',
      'Judged more than 50 regional and national competitions',
      'Wrote training curricula for argumentation and public speaking',
      'Fifteen students took regional championship titles',
    ],
  },
  {
    when: '2023 — 2024',
    role: 'President',
    org: 'University Physics Society',
    points: [
      'Programmed fifteen seminars and guest lectures',
      'Grew membership by 60% through outreach built for non-physicists',
      'Ran an annual symposium with more than 200 attendees',
    ],
  },
  {
    when: '2021 — Present',
    role: 'Science Communicator',
    org: 'Public engagement',
    points: [
      'Physics demonstrations delivered at over 20 schools',
      'Educational writing and video reaching more than 10,000 students',
      'Science festivals and public engagement events',
    ],
  },
];

export const education = {
  degree: 'BSc Physics',
  honours: 'First Class Honours · GPA 3.9 / 4.0',
  years: '2020 — 2024',
  thesis: 'Quantum-Classical Interface in Mesoscopic Systems',
  coursework: ['Quantum Mechanics', 'Statistical Physics', 'Computational Methods', 'Advanced Mathematics'],
};

export const skills = [
  { group: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'C++', 'MATLAB', 'R'] },
  { group: 'Frameworks', items: ['TensorFlow', 'PyTorch', 'React', 'Node.js', 'Qiskit'] },
  { group: 'Tooling', items: ['Docker', 'Git', 'Redis', 'LaTeX', 'CUDA'] },
  { group: 'Specialism', items: ['Quantum computing', 'Machine learning', 'Scientific computing', 'Instrumentation'] },
];

export const challenges = [
  {
    title: 'Real-time processing at scale',
    context:
      'Thousands of frames per second through Look-Out while holding accuracy and latency at the same time.',
    moves: [
      'GPU-accelerated pipelines on CUDA rather than tuning the CPU path',
      'Streaming-oriented memory management to stop copying frames',
      'Adaptive quality that reads the hardware and lowers its own ceiling',
      'Distributed architecture so horizontal scaling stays horizontal',
    ],
  },
  {
    title: 'Workflow orchestration that cannot silently fail',
    context: 'Overmind had to coordinate dependent systems while staying legible to the person running it.',
    moves: [
      'Event-driven core over a message queue',
      'Rollback and compensation at every step, not only at the end',
      'Natural-language surface over a strictly typed command layer',
      'Workflow visualisation built for debugging, not for demos',
    ],
  },
  {
    title: 'Models that survive contact with users',
    context: 'Deploying AI in production means assuming the input is hostile.',
    moves: [
      'Adversarial training during development rather than after',
      'Input validation and sanitisation as a hard boundary',
      'Versioning and rollback as first-class operations',
      'Anomaly monitoring that watches the data, not just the server',
    ],
  },
];

export const stats = [
  { value: '25', unit: 'projects', label: 'Shipped and running' },
  { value: '12', unit: 'titles', label: 'Debate championships' },
  { value: '150', unit: 'students', label: 'Coached to competition' },
  { value: '3', unit: 'papers', label: 'Through review' },
];

export const channels = [
  {
    label: 'Email',
    value: identity.email,
    href: `mailto:${identity.email}`,
    note: 'Direct line. Best for collaboration, research, and anything long.',
  },
  {
    label: 'GitHub',
    value: 'github.com/justicethinker',
    href: identity.github,
    note: 'Source, experiments and the projects still in progress.',
  },
  {
    label: 'LinkedIn',
    value: 'linkedin.com/in/justicethinker',
    href: identity.linkedin,
    note: 'Professional record and the shorter version of everything.',
  },
];
