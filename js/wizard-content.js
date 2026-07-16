// wizard-content.js — pure data for the Getting Started wizard. Copy is
// verbatim from docs/FootballManager_Stage11_WizardCopy.md; edit that doc
// first if the wording needs to change, then mirror it here.

export const WIZARD_STEPS = [
  {
    id: 1,
    icon: '🏈',
    title: 'Welcome to FootballManager!',
    body: "FootballManager helps you run your team's whole season from your phone — roster, schedule, snacks, fundraisers, and parent updates, all in one place. Everything lives right here on your device, so it's fast, private, and works even without a signal.",
    kind: 'standard'
  },
  {
    id: 2,
    icon: '🔄',
    title: 'Not a new user?',
    body: "If you've used FootballManager before and this looks like a fresh start, your phone's browser may have quietly cleared its data — that can happen after clearing browsing history, switching phones, or just going too long without opening the app. If you've exported a backup before, you can restore everything in seconds.",
    kind: 'branch'
  },
  {
    id: 3,
    icon: '🏠',
    title: 'Your Team page',
    body: 'This is home base — your season record, your next game, your next practice, and a "Needs Attention" list for anything that slipped through the cracks. It\'s the first thing you\'ll see every time you open the app.',
    kind: 'standard'
  },
  {
    id: 4,
    icon: '🗓️',
    title: 'Schedule',
    body: 'Add games and practices, track opponents, scores, and status. Upcoming events stay sorted at the top; past ones move below automatically so the list never gets cluttered.',
    kind: 'standard'
  },
  {
    id: 5,
    icon: '👕',
    title: 'Roster',
    body: "Keep every player's jersey number, position, and any balance owed in one list. Tap the star to follow your own player and see them highlighted throughout the app.",
    kind: 'standard'
  },
  {
    id: 6,
    icon: '👪',
    title: 'Parents',
    body: 'Store contact info and link each parent to their kid — including siblings on the same team. This is also where snack duty and fundraiser assignments pull names from.',
    kind: 'standard'
  },
  {
    id: 7,
    icon: '🍊',
    title: 'Snack duty',
    body: 'Assign a parent to bring snacks for each practice. Any unassigned upcoming practice gets flagged automatically, so nothing gets missed.',
    kind: 'standard'
  },
  {
    id: 8,
    icon: '💰',
    title: 'Fundraisers',
    body: 'Track goals and progress for team fundraisers, including multi-date ones like a series of car washes. Link a platform like DoubleGood or GoFundMe if you\'re using one.',
    kind: 'standard'
  },
  {
    id: 9,
    icon: '💬',
    title: 'Weekly updates',
    body: 'Send parents a ready-made weekly update by email or text — upcoming games, practices, and snack assignments, pulled together for you automatically.',
    kind: 'standard'
  },
  {
    id: 10,
    icon: '⚙️',
    title: 'Set up your team',
    body: "Let's get the basics in — you can always change these later in Settings.",
    kind: 'form'
  },
  {
    id: 11,
    icon: '🔒',
    title: 'Make backups a habit',
    body: "Everything you enter lives only on this device — there's no cloud copy. Export a backup regularly from Settings and keep the file somewhere private. If it's been a few days, or you've made a lot of changes, a banner will remind you automatically — you'll never have to remember on your own.",
    kind: 'closing',
    primaryLabel: 'Add your first player!'
  }
];
