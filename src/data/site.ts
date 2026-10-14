/**
 * The content model.
 * Only things that are true live here: the GitHub record, the Substack
 * essays, and the debate results. Nothing invented.
 */

export const identity = {
  name: 'Justice Thinker',
  legalName: 'Emmanuel Isaac',
  role: 'AI & Software Developer',
  tagline: 'Thought in progress.',
  statement:
    'I build software, study physics, and argue competitively. This site holds the three in one place.',
  email: 'justicethinker2@gmail.com',
  github: 'https://github.com/justicethinker',
  githubHandle: 'github.com/justicethinker',
  linkedin: 'https://www.linkedin.com/in/justicethinker/',
  substack: 'https://justicethinker.substack.com',
  substackHandle: 'justicethinker.substack.com',
  site: 'justicethinker.github.io',
} as const;

export type NavItem = {
  href: string;
  label: string;
};

/** Five sections. Nothing else. */
export const navPrimary: NavItem[] = [
  { href: '/tech', label: 'Tech' },
  { href: '/debate', label: 'Debate' },
  { href: '/writing', label: 'Writing' },
  { href: '/physics', label: 'Physics' },
];

/** Everything, for the menu and the footer. */
export const navAll: NavItem[] = [
  { href: '/', label: 'Me' },
  { href: '/tech', label: 'Tech' },
  { href: '/debate', label: 'Debate' },
  { href: '/writing', label: 'Writing' },
  { href: '/physics', label: 'Physics' },
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
    body: 'Keeps audio recordings from getting lost; helps with memory.',
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
  format: string;
  body: string;
};

export const debateResults: Result[] = [
  {
    event: 'National Debate Championship',
    when: '2024',
    placing: 'Champion',
    format: 'Oxford Union style',
    body: 'Won the final on technology and human rights, against a field of seasoned national competitors.',
  },
  {
    event: 'Regional Parliamentary Series',
    when: '2023 — 2024',
    placing: 'Season winner',
    format: 'British Parliamentary',
    body: 'Highest win rate across the season, in both opening and closing positions, across a wide spread of motions.',
  },
  {
    event: 'International Debate Tournament',
    when: '2023',
    placing: 'Third place',
    format: 'World Schools',
    body: 'Represented the country internationally, carrying research depth into cross-examination.',
  },
];

export const talks = [
  {
    title: 'The ethics of artificial intelligence in decision making',
    venue: 'TEDx University · 2024',
    meta: '18-minute keynote · 100K+ views',
    body: 'What it means to hand a moral decision to a system that cannot be held responsible for it.',
  },
  {
    title: "Bridging science and society: the physicist's responsibility",
    venue: 'National Science Convention · 2024',
    meta: 'Plenary address · 2,000+ attendees',
    body: 'A physicist who cannot explain their work in public has left the work unfinished.',
  },
  {
    title: 'The power of interdisciplinary thinking',
    venue: 'University Graduation Ceremony · 2024',
    meta: 'Valedictorian address',
    body: 'How physics sharpened the code, and how debate sharpened the physics.',
  },
];

export const debateRules = [
  {
    name: 'Precision',
    body: 'Every word carries weight. Say it short, say it once.',
  },
  {
    name: 'Evidence',
    body: 'Claims have to survive scrutiny — sourced and reasoned, not asserted.',
  },
  {
    name: 'Empathy',
    body: 'State the other side in its strongest form before you answer it.',
  },
  {
    name: 'Impact',
    body: 'Arranged to change a position, not to fill an hour.',
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
    name: 'Quantum mechanics',
    body: 'How small systems behave, and what that means for computing with them.',
  },
  {
    name: 'Wave dynamics',
    body: 'Propagation, interference and resonance — the patterns on this page are computed, not drawn.',
  },
  {
    name: 'Computational physics',
    body: 'Numerical models in Python: simulate first, argue with data second.',
  },
  {
    name: 'Instrumentation',
    body: 'Building the measuring apparatus when nothing affordable resolves the effect.',
  },
];

export const background = {
  degree: 'BSc Physics',
  detail: 'First Class Honours · 2020 — 2024',
  thesis: 'Thesis on the quantum-to-classical boundary in mesoscopic systems.',
  coaching: 'Debate coach and judge — 150+ students coached, 50+ competitions judged.',
};
