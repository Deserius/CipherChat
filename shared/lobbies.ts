/** Public themed lounges. Caps are video+chat occupancy; overflow opens "Name 2". */

export interface LobbyTheme {
  slug: string;
  name: string;
  theme: string;
  blurb: string;
  maxUsers: number;
  accent: string;
}

export const LOBBIES: LobbyTheme[] = [
  { slug: 'workout-kingz', name: 'Workout Kingz', theme: 'Fitness', blurb: 'Sets, PRs, and no-ego spotting.', maxUsers: 8, accent: '#2ee6a6' },
  { slug: 'night-owl', name: 'Night Owl Lounge', theme: 'Late night', blurb: 'Insomniacs, night-shift, quiet company.', maxUsers: 10, accent: '#7c5cff' },
  { slug: 'study-hive', name: 'Study Hive', theme: 'Focus', blurb: 'Cameras optional. Headphones on.', maxUsers: 6, accent: '#00e5ff' },
  { slug: 'pixel-arcade', name: 'Pixel Arcade', theme: 'Games', blurb: 'Looking for a squad or a co-op.', maxUsers: 8, accent: '#ffc857' },
  { slug: 'vinyl-nights', name: 'Vinyl Nights', theme: 'Music', blurb: 'What are you spinning.', maxUsers: 8, accent: '#ff4d6d' },
  { slug: 'founders-cafe', name: 'Founders Cafe', theme: 'Builders', blurb: 'Side projects and shipping talk.', maxUsers: 8, accent: '#00e5ff' },
  { slug: 'language-lab', name: 'Language Lab', theme: 'Practice', blurb: 'Swap languages. Be kind to beginners.', maxUsers: 10, accent: '#2ee6a6' },
  { slug: 'cozy-couch', name: 'Cozy Couch', theme: 'Hangout', blurb: 'Low-key hang. Bring a mug.', maxUsers: 6, accent: '#c4a574' },
  { slug: 'code-coffee', name: 'Code & Coffee', theme: 'Developers', blurb: 'Rubber-duck your bug.', maxUsers: 8, accent: '#7c5cff' },
  { slug: 'stargazers', name: 'Stargazers', theme: 'Science', blurb: 'Space, weather, weird facts.', maxUsers: 8, accent: '#9bbcff' },
  { slug: 'book-nook', name: 'Book Nook', theme: 'Reading', blurb: 'What chapter are you on.', maxUsers: 6, accent: '#e8c39e' },
  { slug: 'after-hours', name: 'After Hours', theme: 'General', blurb: 'Open lounge when nothing else fits.', maxUsers: 12, accent: '#00e5ff' },
];

export function lobbyBySlug(slug: string): LobbyTheme | undefined {
  return LOBBIES.find((l) => l.slug === slug);
}

export function lobbyDisplayName(name: string, index: number): string {
  return index <= 1 ? name : `${name} ${index}`;
}

export const LOBBY_RULES = [
  'No nudity, sexual content, or pornographic imagery in common lounges.',
  'No hate, racism, slurs, harassment, or threats.',
  'No illegal content, exploitation, or spam.',
  'Keep it civil. Common lounges are shared and moderated by capacity, not by staff watching you.',
  'If you want an unlisted space, create a private numeric room or buy a Party pass.',
];
