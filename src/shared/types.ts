export type GameMode = 'multiplayer' | 'daily-solo' | 'practice-solo' | 'wikiword-4x4';

export interface AuthorizedUser {
  username: string; // clean username without @
  key: string;      // individual admin provided access key
  label?: string;   // optional note or title (e.g. "Main Streamer")
  createdAt?: number;
}

export type TierName = 'common' | 'rare' | 'ultra' | 'three' | 'title';

export type TierPhase = 'common' | 'rare' | 'ultra' | 'complete';

export interface FinderInfo {
  displayName: string;
  platform: 'web' | 'tiktok' | 'discord';
  platformUserId: string;
  profileImage?: string | null;
  isFanClub?: boolean;
}

export interface TitleChip {
  index: number;
  word: string | null; // null if hidden
  length: number;
  revealed: boolean;
  finder: FinderInfo | null;
}

export interface TargetCard {
  position: number; // 1..5
  rank: number | null;
  word: string | null;
  revealed: boolean;
  closeness: number; // 0..1
  finder: FinderInfo | null;
  isTarget?: boolean;
  isPlaceholder?: boolean;
  pointsAwarded?: number;
}

export interface FoundWordEntry {
  word: string;
  tier: TierName;
  points: number;
  displayName: string;
  platform: 'web' | 'tiktok' | 'discord';
  platformUserId: string;
  profileImage?: string | null;
  timestamp: number;
  cells: number[];
  isTitleWord?: boolean;
}

export interface PlayerScore {
  platformUserId: string;
  displayName: string;
  platform: 'web' | 'tiktok' | 'discord';
  profileImage?: string | null;
  score: number;
  xp: number;
  wordCount: number;
  targetCount: number;
  titleWordCount: number;
  likesSent?: number;
  giftsDiamonds?: number;
}

export interface RecentTag {
  id?: string;
  result: 'correct' | 'already_found' | 'miss_in_article' | 'incorrect';
  word: string;
  displayName?: string;
  platform?: 'web' | 'tiktok' | 'discord';
  profileImage?: string | null;
  points?: number;
  tier?: TierName;
  rank?: number | null;
  closeness?: number;
  guessCount?: number;
  ts: number;
}

export interface TierStartCell {
  idx: number;
  tier: 'common' | 'rare' | 'ultra';
  filled?: boolean;
}

export interface HintData {
  tier: 1 | 2 | 3 | 4;
  label: string;
  wordLength: number;
  startCell: number;
  secondCell?: number;
  orientation?: string;
  column?: number;
  row?: number;
  revealedPrefix?: string;
  wordTier: TierName;
}

export interface SearchWordSlot {
  id: string;
  tier: 'title' | 'common' | 'rare' | 'ultra';
  length: number;
  startLetter: string;
  revealed: boolean;
  word: string | null;
  unmaskedWord: string;
  finderName?: string | null;
  points?: number;
  cells?: number[];
}

export interface PublicGameState {
  roundId: string;
  mode: GameMode;
  grid: string[];
  rows: number;
  cols: number;
  minWordLength: number;
  articleTitle: string | null;
  unmaskedArticleTitle: string;
  articleExtract: string | null;
  articleCategory: string;
  articleUrl: string | null;
  titleChips: TitleChip[];
  targets: TargetCard[];
  foundWords: FoundWordEntry[];
  foundCount: number;
  totalGridWords: number;
  titleWordCount: number;
  revealedTitleWordCount: number;
  commonWordCount: number;
  commonWordTarget: number;
  foundCommonCount: number;
  rareWordCount: number;
  rareWordTarget: number;
  foundRareCount: number;
  ultraWordCount: number;
  ultraWordTarget: number;
  foundUltraCount: number;
  currentTierPhase: TierPhase;
  activeTierStartCells: TierStartCell[];
  activeCommonCells: number[];
  topPlayers: PlayerScore[];
  recentTags: RecentTag[];
  searchWords: SearchWordSlot[];
  isComplete: boolean;
  startTime: number;
  roundEndCountdownSec: number | null;
  rankTargetHint: string;
  totalRankedWords: number;
  activeHint?: HintData | null;
}

export interface GuessResult {
  result: 'correct' | 'already_found' | 'miss_in_article' | 'incorrect' | 'too_short';
  word: string;
  cells: number[];
  points: number;
  guessCount: number;
  tierName: TierName | null;
  isTitleWord: boolean;
  rank: number | null;
  closeness: number;
  rankSlotAwarded?: number | null;
  rankPoints?: number;
  finder: FinderInfo;
}

export interface TikTokConnectionStatus {
  connected: boolean;
  mode: 'disconnected' | 'tiktok-live' | 'tikfinity-ws' | 'webhook-ready';
  username: string | null;
  tikfinityUrl: string | null;
  viewerCount: number;
  chatEventsProcessed: number;
  guessesFromChat: number;
  likesCount: number;
  giftsDiamonds: number;
  lastError: string | null;
}

export interface LiveChatItem {
  id: string;
  platform: 'tiktok' | 'web';
  username: string;
  displayName: string;
  profileImage?: string;
  comment: string;
  guessResult?: 'correct' | 'already_found' | 'miss_in_article' | 'incorrect' | 'chat';
  points?: number;
  isTitleWord?: boolean;
  tierName?: TierName | null;
  timestamp: number;
  eventType?: 'chat' | 'like' | 'gift';
  giftName?: string;
  diamondCount?: number;
}
