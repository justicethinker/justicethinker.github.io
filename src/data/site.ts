/**
 * The content model.
 * Only things that are true live here: the GitHub record, the Substack
 * essays, and the debate record. Nothing invented.
 */

export const identity = {
  name: 'Ikechukwu Emmanuel Isaac',
  alias: 'Justice Thinker',
  handle: 'justicethinker',
  jobTitle: 'Full-Stack & AI Engineer',
  city: 'Enugu',
  country: 'Nigeria',
  role: 'Full-Stack & AI Engineer · Enugu, Nigeria',
  statement:
    'I build AI products and full-stack apps. I trained as a physicist and I argue for sport. Right now I am building Atelity.',
  email: 'justicethinker@justicethinker.com',
  github: 'https://github.com/justicethinker',
  githubHandle: 'github.com/justicethinker',
  linkedin: 'https://www.linkedin.com/in/justice-thinker/',
  substack: 'https://justicethinker.substack.com',
  substackHandle: 'justicethinker.substack.com',
  site: 'https://justicethinker.com',
} as const;

export const atelity = {
  name: 'Atelity',
  url: 'https://atelity.com',
  x: 'https://x.com/Atelityhq',
  xHandle: '@Atelityhq',
  line: 'An AI memory for the relationships your work depends on.',
  who: 'Built first for real estate agents and recruiters: people whose work runs on remembering people.',
  steps: [
    { title: 'Meet someone', body: 'A client, a candidate, a contact at an event.' },
    { title: 'Record 30 seconds', body: 'Say what you learned in a short voice note.' },
    { title: 'Atelity remembers', body: 'It keeps the details, reminds you when it matters, and drafts the follow-up.' },
  ],
  status: [
    { k: 'Now', v: 'MVP in testing with real users' },
    { k: 'Next', v: 'Public launch planned for December 2026' },
    { k: 'Program', v: 'iDICE Startup Bridge Founders Lab, Cohort 2' },
  ],
  origin:
    'It started when I lost every audio recording on my phone. I built notetoself_app so that could never happen again. Atelity grew out of that.',
};

export const availability = 'Open to remote and contract roles in full-stack, backend and AI engineering.';

export const stack = [
  { group: 'Languages', items: ['Python', 'TypeScript', 'Dart'] },
  { group: 'Front end & mobile', items: ['React', 'React Native', 'Flutter'] },
  { group: 'Back end & data', items: ['Node.js', 'Express', 'PostgreSQL', 'Supabase', 'AWS'] },
  { group: 'AI', items: ['LLM apps', 'AI agents', 'MCP tools', 'Speech-to-text pipelines'] },
];

export type NavItem = {
  href: string;
  label: string;
};

export const navPrimary: NavItem[] = [
  { href: '/work/', label: 'Work' },
  { href: '/debate/', label: 'Debate' },
  { href: '/physics/', label: 'Physics' },
  { href: '/writing/', label: 'Writing' },
];

/* ------------------------------------------------------------------ tech */

export type Repo = {
  name: string;
  url: string;
  language: string;
  body: string;
};

/** Projects with enough behind them to describe honestly. */
export const techFeatured: Repo[] = [
  {
    name: 'offline-task-manager',
    url: 'https://github.com/justicethinker/offline-task-manager',
    language: 'TypeScript · React Native',
    body: 'A task app that works with no connection: local SQLite store, queued background sync with retries, and optimistic UI so it never feels broken offline.',
  },
  {
    name: 'GAT-Frontend',
    url: 'https://github.com/justicethinker/GAT-Frontend',
    language: 'TypeScript · React',
    body: 'Trading platform front end — auth, dashboards, wallets, trading modes and an admin panel — over an Express and PostgreSQL backend.',
  },
  {
    name: 'world-wire',
    url: 'https://github.com/justicethinker/world-wire',
    language: 'TypeScript',
    body: 'Real-time news aggregator: a chronological headline stream over WebSockets with a virtualized feed.',
  },
  {
    name: 'texteria_backend',
    url: 'https://github.com/justicethinker/texteria_backend',
    language: 'Python',
    body: 'Backend for malaria-case tracking — authentication, input validation and database migrations.',
  },
  {
    name: 'Learning-Agent',
    url: 'https://github.com/justicethinker/Learning-Agent',
    language: 'Python',
    body: 'An extensible agent built to take on learning tasks end to end.',
  },
  {
    name: 'Notion-Ghostwriter',
    url: 'https://github.com/justicethinker/Notion-Ghostwriter',
    language: 'MCP · Notion',
    body: 'An MCP-powered assistant that makes a Notion workspace usable as a live dictionary from text fields across apps.',
  },
];

/** The rest of the public record, each one a real repository. */
export const techMore: Repo[] = [
  {
    name: 'gitpoer',
    url: 'https://github.com/justicethinker/gitpoer',
    language: 'JavaScript',
    body: 'A GitHub repo cleaner with scoring, docs and changelogs.',
  },
  {
    name: 'Echo_AI_Nav',
    url: 'https://github.com/justicethinker/Echo_AI_Nav',
    language: 'JavaScript',
    body: 'AI-assisted navigation experiments.',
  },
  {
    name: 'deriv_trading_bot',
    url: 'https://github.com/justicethinker/deriv_trading_bot',
    language: 'Python',
    body: 'Automated trading bot for Deriv.',
  },
  {
    name: 'solana-audit-agent',
    url: 'https://github.com/justicethinker/solana-audit-agent',
    language: 'Solana',
    body: 'Agent work on auditing Solana programs.',
  },
  {
    name: 'notetoself_app',
    url: 'https://github.com/justicethinker/notetoself_app',
    language: 'Dart · Flutter',
    body: 'Built after I lost every recording on my phone: keeps audio safe and helps you remember what was in it.',
  },
  {
    name: 'First_ML_Projects',
    url: 'https://github.com/justicethinker/First_ML_Projects',
    language: 'Machine learning',
    body: 'Basic machine-learning projects from the start of the road.',
  },
  {
    name: 'ML-competions',
    url: 'https://github.com/justicethinker/ML-competions',
    language: 'Machine learning',
    body: 'Entries into Kaggle machine-learning competitions.',
  },
  {
    name: 'mixology',
    url: 'https://github.com/justicethinker/mixology',
    language: 'TypeScript',
    body: 'Mixing experiments on the web.',
  },
  {
    name: 'RAPID',
    url: 'https://github.com/justicethinker/RAPID',
    language: 'TypeScript',
    body: 'Rapid prototyping work.',
  },
  {
    name: 'WP-Bot',
    url: 'https://github.com/justicethinker/WP-Bot',
    language: 'Python',
    body: 'A WhatsApp bot.',
  },
  {
    name: 'learn-kotlin',
    url: 'https://github.com/justicethinker/learn-kotlin',
    language: 'Kotlin',
    body: 'Learning Kotlin and Android development from zero.',
  },
  {
    name: 'learn-java',
    url: 'https://github.com/justicethinker/learn-java',
    language: 'Java',
    body: 'Learning Java in the open.',
  },
  {
    name: 'simple_python_projects',
    url: 'https://github.com/justicethinker/simple_python_projects',
    language: 'Python',
    body: 'Small Python builds.',
  },
  {
    name: 'weekly-spine',
    url: 'https://github.com/justicethinker/weekly-spine',
    language: 'TypeScript',
    body: 'A weekly publishing backbone.',
  },
  {
    name: 'bmi_calculator',
    url: 'https://github.com/justicethinker/bmi_calculator',
    language: 'Motoko',
    body: 'BMI calculator on the Internet Computer.',
  },
  {
    name: 'johncenachat',
    url: 'https://github.com/justicethinker/johncenachat',
    language: 'Web',
    body: 'A chat experiment.',
  },
  {
    name: 'Gideon',
    url: 'https://github.com/justicethinker/Gideon',
    language: 'Code',
    body: 'Early-stage build, public from day one.',
  },
];

/* ---------------------------------------------------------------- debate */

export type Result = {
  event: string;
  when: string;
  placing: string;
  detail?: string;
};

export type ResultGroup = { title: string; items: Result[] };

export const debateHighlights = [
  { figure: '2', label: 'Championship titles' },
  { figure: '4th', label: 'Best Speaker, ANUDC 2025' },
  { figure: '8', label: 'Elimination-round finishes' },
  { figure: '2nd', label: 'Best Judge, NAUDC 2025' },
];

export const debateGroups: ResultGroup[] = [
  {
    title: 'Championships',
    items: [
      { event: 'ANUDC Novice Championship (All Nigerian Universities Debating Championship)', when: '2024', placing: 'Champion' },
      { event: 'World Spars League Debate Tournament', when: 'Online', placing: 'Champion' },
    ],
  },
  {
    title: 'Finals',
    items: [
      { event: 'All Nigerian Universities Debating Championship (ANUDC)', when: '2025', placing: 'First Runner-up', detail: 'On-site · 3rd breaking team' },
      { event: 'Rivers State University Debate Open', when: '2025', placing: 'First Runner-up', detail: 'On-site · 3rd breaking team' },
      { event: 'Africa Top Universities Debating Championship (ATUDC)', when: '2026', placing: 'Finalist', detail: 'Online · 3rd breaking team' },
      { event: 'Africa Inter-Varsities Debating Championship', when: '2026', placing: 'Finalist', detail: 'Online · 5th breaking team' },
    ],
  },
  {
    title: 'Semifinals',
    items: [
      { event: 'West African Universities Debating Championship (WAUDC)', when: '2025', placing: 'Semifinalist', detail: 'Online · 13th breaking team' },
      { event: 'All Nigerian Youth Debating Championship (ANYDC)', when: '2026', placing: 'Semifinalist', detail: 'On-site · 7th breaking team' },
    ],
  },
  {
    title: 'Speaker awards',
    items: [
      { event: 'All Nigerian Universities Debating Championship (ANUDC)', when: '2025', placing: '4th Best Speaker' },
      { event: 'All Nigerian Youth Debating Championship (ANYDC)', when: '2025', placing: '7th Best Speaker' },
    ],
  },
  {
    title: 'Adjudication',
    items: [
      { event: 'Nigerian Universities Debating Championship (NAUDC)', when: '2025', placing: 'Final Judge' },
      { event: 'Nigerian Universities Debating Championship (NAUDC)', when: '2025', placing: '2nd Best Judge' },
      { event: 'US online debate tournaments', when: '2025', placing: 'Judge', detail: 'Volunteer adjudicator' },
      { event: 'West African Universities Debating Championship (WA-UDC)', when: '2024', placing: 'Judge' },
    ],
  },
  {
    title: 'Recognition & service',
    items: [
      { event: "Débatteur d'Or, Nigerian debating award", when: '2025 · 2026', placing: 'Nominee' },
      { event: 'Tournament of Champions', when: '2024', placing: 'Organiser', detail: 'Brought in sponsorship' },
      { event: 'Coaching', when: 'Ongoing', placing: 'Coach', detail: 'About 50 students coached' },
    ],
  },
];

export const debateRules = [
  {
    name: 'Precision',
    body: 'Say it short, say it once.',
  },
  {
    name: 'Evidence',
    body: 'Claims must survive scrutiny.',
  },
  {
    name: 'Empathy',
    body: 'State the other side in its strongest form before you answer it.',
  },
  {
    name: 'Impact',
    body: 'Meant to change a position.',
  },
];

/* ---------------------------------------------------------------- writing */

export type Essay = {
  title: string;
  date: string;
  iso: string;
  url: string;
  body: string;
};

/** Every essay on the Substack, newest first. */
export const essays: Essay[] = [
  {
    title: 'The Nature of Subjectivity and Why It Doesn’t Make You Right',
    date: 'Aug 29, 2026',
    iso: '2026-08-29',
    url: 'https://justicethinker.substack.com/p/the-nature-of-subjectivity-and-why',
    body: 'Feeling something strongly and being right are different things. Part one on where subjective experience ends and claims about the world begin.',
  },
  {
    title: 'How to Call Someone Stupid',
    date: 'Jul 20, 2026',
    iso: '2026-07-20',
    url: 'https://justicethinker.substack.com/p/how-to-call-someone-stupid',
    body: 'On the careful, generous-sounding language people use to fix a judgment about someone — and what it costs.',
  },
  {
    title: 'The Fear You Choose',
    date: 'Jul 13, 2026',
    iso: '2026-07-13',
    url: 'https://justicethinker.substack.com/p/the-fear-you-choose',
    body: 'Becoming someone new means outgrowing who you are. On choosing that fear on purpose — including the choice behind this name.',
  },
];

/* ---------------------------------------------------------------- physics */

export const physicsInterests = [
  {
    name: 'Electromagnetism',
    body: 'Fields, induction and resonance: the physics that makes wireless power work.',
  },
  {
    name: 'Quantum mechanics',
    body: 'How small systems behave, and what that means for computing with them.',
  },
  {
    name: 'Wave dynamics',
    body: 'Propagation, interference and resonance. The field drawn on the home page is two interfering waves, computed live.',
  },
  {
    name: 'Computational physics',
    body: 'Numerical models in Python. Model first, then argue from the data.',
  },
];

export const background = {
  degree: 'BSc Physics',
  detail: 'Federal University of Technology Owerri (FUTO) · 2025',
  thesis: 'Thesis on wireless energy transmission.',
  coaching: 'About 50 students coached.',
};
