import {
  FinderInfo,
  FoundWordEntry,
  GameMode,
  GuessResult,
  HintData,
  PlayerScore,
  PublicGameState,
  RecentTag,
  SearchWordSlot,
  TargetCard,
  TierName,
  TierPhase,
  TierStartCell,
  TitleChip,
} from '../shared/types';
import {
  fetchWikipediaRoundArticle,
  getFrequencyMap,
  getTrie,
  singularizeForTitleAlias,
  WikiArticleSeed,
} from './wordlist';
import { buildGrid } from './grid';

const ZIPF_COMMON_THRESHOLD = 4.2;
const ZIPF_ULTRA_THRESHOLD = 3.0;

const SCRABBLE_LETTER_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4,
  i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3,
  q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8,
  y: 4, z: 10,
};

const TITLE_BONUSES = [50000, 35000, 25000, 20000, 15000];
const SLOT_BASE: Record<number, number> = {
  1: 16000,
  2: 11000,
  3: 8000,
  4: 5600,
  5: 4000,
};

function getTitleBonus(findIndex: number): number {
  return TITLE_BONUSES[findIndex] || 12000;
}

function getWordLengthBonus(word: string): number {
  const len = word.length;
  if (len <= 3) return 0;
  if (len === 4) return 150;
  if (len === 5) return 350;
  if (len === 6) return 700;
  if (len === 7) return 1200;
  return 2000;
}

function getLetterRarityBonus(word: string): number {
  let sum = 0;
  for (const ch of word) {
    sum += (SCRABBLE_LETTER_VALUES[ch] || 1) * 25;
  }
  return sum;
}

export function wordSimilarity(a: string, b: string): number {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bagA: Record<string, number> = {};
  const bagB: Record<string, number> = {};
  for (const c of a) bagA[c] = (bagA[c] || 0) + 1;
  for (const c of b) bagB[c] = (bagB[c] || 0) + 1;
  let shared = 0;
  for (const c in bagA) {
    if (bagB[c]) shared += Math.min(bagA[c], bagB[c]);
  }
  const overlap = shared / Math.max(a.length, b.length);
  const lenPen = 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length);
  let bonus = 0;
  for (let n = 2; n <= Math.min(a.length, b.length); n++) {
    let found = false;
    for (let i = 0; i <= a.length - n && !found; i++) {
      if (b.includes(a.slice(i, i + n))) {
        found = true;
        bonus = Math.max(bonus, n / Math.max(a.length, b.length));
      }
    }
  }
  return Math.min(0.99, 0.50 * overlap + 0.20 * lenPen + 0.35 * bonus);
}

export class WiKirecGame {
  roundId: string;
  mode: GameMode;
  grid: string[] = [];
  rows = 0;
  cols = 0;
  minWordLength = 3;
  article!: WikiArticleSeed;
  allWords: Map<string, number[]> = new Map();
  targetPaths: Record<string, number[]> = {};
  titleWords: string[] = [];
  titleWordSet: Set<string> = new Set();
  titleSingularToPlural: Map<string, string> = new Map();
  revealedTitleWords: Map<string, FinderInfo> = new Map();

  commonWords: Map<string, number[]> = new Map();
  rareWords: Map<string, number[]> = new Map();
  ultraRareWords: Map<string, number[]> = new Map();
  threeLetterWords: Map<string, number[]> = new Map();

  foundWords: Map<string, FoundWordEntry> = new Map();
  foundCommon: Map<string, FinderInfo> = new Map();
  foundRare: Map<string, FinderInfo> = new Map();
  foundUltra: Map<string, FinderInfo> = new Map();

  playerScores: Map<string, PlayerScore> = new Map();
  recentTags: RecentTag[] = [];
  guessCounts: Map<string, number> = new Map();

  rankTarget: string = '';
  totalRankedWords = 50000;
  rankedGuesses: Map<
    string,
    {
      word: string;
      rank: number;
      closeness: number;
      finder: FinderInfo;
      timestamp: number;
      pointsAwarded: number;
    }
  > = new Map();
  rankSlotsPaid: Set<number> = new Set();
  articleWordSet: Set<string> = new Set();

  startTime = Date.now();
  roundEndCountdownSec: number | null = null;
  activeHint: HintData | null = null;
  hintStepCounter = 0;

  constructor(roundId: string, mode: GameMode) {
    this.roundId = roundId;
    this.mode = mode;
  }

  initialize(article: WikiArticleSeed, built: {
    grid: string[];
    rows: number;
    cols: number;
    allWords: Map<string, number[]>;
    targetPaths: Record<string, number[]>;
  }) {
    this.article = article;
    this.grid = built.grid;
    this.rows = built.rows;
    this.cols = built.cols;
    this.allWords = built.allWords;
    this.targetPaths = built.targetPaths;
    this.startTime = Date.now();

    const freq = getFrequencyMap();
    const seenTitle = new Set<string>();
    this.titleWords = [];
    for (const raw of article.titleWords) {
      const clean = raw.toLowerCase().replace(/[^a-z]/g, '');
      if (clean && !seenTitle.has(clean)) {
        seenTitle.add(clean);
        this.titleWords.push(clean);
      }
    }
    this.titleWordSet = new Set(this.titleWords);
    this.titleSingularToPlural.clear();

    // Build article word set for semantic boost + miss_in_article detection
    this.articleWordSet.clear();
    const tokens = (article.title + ' ' + article.extract + ' ' + article.keywords.join(' '))
      .toLowerCase()
      .match(/[a-z]{3,14}/g) || [];
    for (const t of tokens) {
      this.articleWordSet.add(t);
    }

    // Classify all solvable grid words into Common, Rare, Ultra, or Three-letter
    this.commonWords.clear();
    this.rareWords.clear();
    this.ultraRareWords.clear();
    this.threeLetterWords.clear();

    const sortedWords = Array.from(this.allWords.entries());
    for (const [word, path] of sortedWords) {
      if (word.length === 3) {
        this.threeLetterWords.set(word, path);
        continue;
      }
      const z = freq.get(word) ?? 3.2;
      const isArticleKeyword = article.keywords.includes(word) || this.titleWordSet.has(word);
      if (word.length >= 6 && (z < ZIPF_ULTRA_THRESHOLD || this.titleWordSet.has(word))) {
        this.ultraRareWords.set(word, path);
      } else if (z < ZIPF_COMMON_THRESHOLD || isArticleKeyword || word.length >= 6) {
        this.rareWords.set(word, path);
      } else {
        this.commonWords.set(word, path);
      }
    }

    // Ensure every tier has a healthy distribution on any board size
    if (this.mode !== 'wikiword-4x4') {
      if (this.rareWords.size < 4) {
        for (const [w, p] of this.commonWords.entries()) {
          if (w.length >= 5) {
            this.rareWords.set(w, p);
            this.commonWords.delete(w);
            if (this.rareWords.size >= 8) break;
          }
        }
      }
      if (this.ultraRareWords.size === 0) {
        for (const [w, p] of this.rareWords.entries()) {
          if (w.length >= 5) {
            this.ultraRareWords.set(w, p);
            this.rareWords.delete(w);
            if (this.ultraRareWords.size >= 3) break;
          }
        }
      }
    }

    this.rankTarget = this.titleWords[0] || 'planet';
  }

  private pickNextRankTarget() {
    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        if (this.rankTarget !== tw) {
          this.rankTarget = tw;
          this.rankedGuesses.clear();
          this.rankSlotsPaid.clear();
        }
        return;
      }
    }
  }

  private computeSemanticRank(word: string): { rank: number; closeness: number } {
    const target = this.rankTarget || this.titleWords[0] || '';
    if (!target) return { rank: 25000, closeness: 0.1 };
    if (word === target) {
      return { rank: 1, closeness: 1.0 };
    }
    const lexSim = wordSimilarity(word, target);
    const inArticle = this.articleWordSet.has(word);
    const isKeyword = this.article.keywords.includes(word);
    const isTitle = this.titleWordSet.has(word);

    let score = lexSim * 0.65;
    if (isTitle) score += 0.32;
    else if (isKeyword) score += 0.28;
    else if (inArticle) score += 0.18;

    score = Math.min(0.98, Math.max(0.02, score));
    const rank = Math.max(2, Math.round(Math.pow(1 - score, 2.6) * this.totalRankedWords));
    return { rank, closeness: score };
  }

  guess(wordRaw: string, finder: FinderInfo): GuessResult {
    const norm = String(wordRaw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!norm || norm.length < this.minWordLength) {
      return {
        result: 'too_short',
        word: norm,
        cells: [],
        points: 0,
        guessCount: 0,
        tierName: null,
        isTitleWord: false,
        rank: null,
        closeness: 0,
        finder,
      };
    }

    const gc = (this.guessCounts.get(norm) || 0) + 1;
    this.guessCounts.set(norm, gc);

    const chipKey = norm;
    const isUnrevealedTitle =
      this.titleWordSet.has(norm) && !this.revealedTitleWords.has(chipKey);

    const { rank, closeness } = this.computeSemanticRank(norm);

    if (this.foundWords.has(norm) && !isUnrevealedTitle) {
      this.pushTag({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        result: 'already_found',
        word: norm,
        displayName: finder.displayName,
        platform: finder.platform,
        profileImage: finder.profileImage,
        rank,
        closeness,
        guessCount: gc,
        ts: Date.now(),
      });
      return {
        result: 'already_found',
        word: norm,
        cells: this.foundWords.get(norm)?.cells || [],
        points: 0,
        guessCount: gc,
        tierName: null,
        isTitleWord: false,
        rank,
        closeness,
        finder,
      };
    }

    let rankSlotAwarded: number | null = null;
    let rankPoints = 0;

    if (!this.rankedGuesses.has(norm)) {
      this.rankedGuesses.set(norm, {
        word: norm,
        rank,
        closeness,
        finder,
        timestamp: Date.now(),
        pointsAwarded: 0,
      });

      // Check if this guess landed in the Top 5 closest guesses
      const top5 = this.getTargetCards();
      const slotIdx = top5.findIndex((c) => c.word === norm);
      if (slotIdx !== -1) {
        const slot = slotIdx + 1;
        if (!this.rankSlotsPaid.has(slot)) {
          this.rankSlotsPaid.add(slot);
          const base = SLOT_BASE[slot] || 0;
          const mult = Math.max(0.25, 1 - Math.log10(Math.max(1, rank)) / 5);
          rankPoints = Math.floor(base * mult);
          rankSlotAwarded = slot;
          const entry = this.rankedGuesses.get(norm);
          if (entry) entry.pointsAwarded = rankPoints;
        }
      }
    }

    const inGrid = this.allWords.has(norm);

    if (!inGrid) {
      if (isUnrevealedTitle) {
        this.revealedTitleWords.set(chipKey, finder);
        const titleBonus = getTitleBonus(this.revealedTitleWords.size - 1);
        const path = this.targetPaths[chipKey] || [];
        const entry: FoundWordEntry = {
          word: chipKey,
          tier: 'title',
          points: titleBonus,
          displayName: finder.displayName,
          platform: finder.platform,
          platformUserId: finder.platformUserId,
          profileImage: finder.profileImage,
          timestamp: Date.now(),
          cells: path,
          isTitleWord: true,
        };
        this.foundWords.set(chipKey, entry);
        this.creditPlayer(finder, titleBonus, 1, true);
        this.pushTag({
          id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          result: 'correct',
          word: chipKey,
          displayName: finder.displayName,
          platform: finder.platform,
          profileImage: finder.profileImage,
          points: titleBonus,
          tier: 'title',
          rank: 1,
          closeness: 1,
          guessCount: gc,
          ts: Date.now(),
        });
        this.pickNextRankTarget();
        return {
          result: 'correct',
          word: chipKey,
          cells: path,
          points: titleBonus,
          guessCount: gc,
          tierName: 'title',
          isTitleWord: true,
          rank: 1,
          closeness: 1,
          rankSlotAwarded,
          rankPoints: 0,
          finder,
        };
      }

      const inArticle = this.articleWordSet.has(norm);
      const resType = inArticle ? 'miss_in_article' : 'incorrect';
      this.pushTag({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        result: resType,
        word: norm,
        displayName: finder.displayName,
        platform: finder.platform,
        profileImage: finder.profileImage,
        rank,
        closeness,
        guessCount: gc,
        ts: Date.now(),
      });
      return {
        result: resType,
        word: norm,
        cells: [],
        points: 0,
        guessCount: gc,
        tierName: null,
        isTitleWord: false,
        rank,
        closeness,
        rankSlotAwarded,
        rankPoints: 0,
        finder,
      };
    }

    // Word is in the grid!
    let tierName: TierName = 'common';
    if (this.ultraRareWords.has(norm)) tierName = 'ultra';
    else if (this.rareWords.has(norm)) tierName = 'rare';
    else if (this.commonWords.has(norm)) tierName = 'common';
    else if (norm.length === 3) tierName = 'three';

    let baseScore = 1000;
    if (tierName === 'three') baseScore = 100;
    else if (tierName === 'common') baseScore = 1000;
    else if (tierName === 'rare') baseScore = 2500;
    else if (tierName === 'ultra') baseScore = 5000;

    const lengthBonus = getWordLengthBonus(norm);
    const rarityBonus = getLetterRarityBonus(norm);
    let titleBonus = 0;

    if (isUnrevealedTitle) {
      this.revealedTitleWords.set(chipKey, finder);
      titleBonus = getTitleBonus(this.revealedTitleWords.size - 1);
      tierName = 'title';
      this.pickNextRankTarget();
    }

    const totalPoints = baseScore + lengthBonus + rarityBonus + titleBonus;
    const cells = this.allWords.get(norm) || [];

    const entry: FoundWordEntry = {
      word: norm,
      tier: tierName,
      points: totalPoints,
      displayName: finder.displayName,
      platform: finder.platform,
      platformUserId: finder.platformUserId,
      profileImage: finder.profileImage,
      timestamp: Date.now(),
      cells,
      isTitleWord: isUnrevealedTitle,
    };

    this.foundWords.set(norm, entry);
    if (this.commonWords.has(norm)) this.foundCommon.set(norm, finder);
    if (this.rareWords.has(norm)) this.foundRare.set(norm, finder);
    if (this.ultraRareWords.has(norm)) this.foundUltra.set(norm, finder);

    this.creditPlayer(finder, totalPoints, 1, isUnrevealedTitle);
    this.pushTag({
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      result: 'correct',
      word: norm,
      displayName: finder.displayName,
      platform: finder.platform,
      profileImage: finder.profileImage,
      points: totalPoints,
      tier: tierName,
      rank: isUnrevealedTitle ? 1 : rank,
      closeness: isUnrevealedTitle ? 1 : closeness,
      guessCount: gc,
      ts: Date.now(),
    });

    // Clear hint if the hinted word was just found
    if (this.activeHint && cells[0] === this.activeHint.startCell) {
      this.activeHint = null;
    }

    return {
      result: 'correct',
      word: norm,
      cells,
      points: totalPoints,
      guessCount: gc,
      tierName,
      isTitleWord: isUnrevealedTitle,
      rank,
      closeness,
      rankSlotAwarded,
      rankPoints,
      finder,
    };
  }

  requestHint(): HintData | null {
    // Pick an unfound word in the active tier or an unrevealed title word
    let targetWord: string | null = null;
    let targetCells: number[] | null = null;
    let wordTier: TierName = 'title';

    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        targetWord = tw;
        targetCells = this.allWords.get(tw) || this.targetPaths[tw] || null;
        wordTier = 'title';
        break;
      }
    }

    if (!targetWord) {
      const phase = this.getCurrentTierPhase();
      const map =
        phase === 'ultra'
          ? this.ultraRareWords
          : phase === 'rare'
          ? this.rareWords
          : this.commonWords;
      const found =
        phase === 'ultra'
          ? this.foundUltra
          : phase === 'rare'
          ? this.foundRare
          : this.foundCommon;
      for (const [w, c] of map.entries()) {
        if (!found.has(w)) {
          targetWord = w;
          targetCells = c;
          wordTier = phase === 'complete' ? 'common' : phase;
          break;
        }
      }
    }

    if (!targetWord || !targetCells || targetCells.length === 0) return null;

    this.hintStepCounter = (this.hintStepCounter % 4) + 1;
    const tier = this.hintStepCounter as 1 | 2 | 3 | 4;
    const startCell = targetCells[0];
    const secondCell = targetCells[1];
    const r0 = Math.floor(startCell / this.cols);
    const c0 = startCell % this.cols;

    let orientation = '8-Connected Snake';
    if (typeof secondCell === 'number') {
      const r1 = Math.floor(secondCell / this.cols);
      const c1 = secondCell % this.cols;
      const dr = r1 - r0;
      const dc = c1 - c0;
      if (dr === 0) orientation = dc > 0 ? 'Starts Horizontal Right (→)' : 'Starts Horizontal Left (←)';
      else if (dc === 0) orientation = dr > 0 ? 'Starts Vertical Down (↓)' : 'Starts Vertical Up (↑)';
      else orientation = `Starts Diagonal (${dr > 0 ? 'Down' : 'Up'}-${dc > 0 ? 'Right' : 'Left'})`;
    }

    const hint: HintData = {
      tier,
      label:
        tier === 1
          ? `Tier 1 Hint: Starting letter '${targetWord[0].toUpperCase()}' highlighted at Row ${r0 + 1}, Col ${c0 + 1}`
          : tier === 2
          ? `Tier 2 Hint: ${orientation} (${targetWord.length} letters)`
          : tier === 3
          ? `Tier 3 Hint: Starts in Column ${c0 + 1} with "${targetWord.slice(0, 2).toUpperCase()}..."`
          : `Tier 4 Hint: First 3 letters "${targetWord.slice(0, 3).toUpperCase()}..." (${targetWord.length} letters)`,
      wordLength: targetWord.length,
      startCell,
      secondCell,
      orientation,
      column: c0 + 1,
      row: r0 + 1,
      revealedPrefix: targetWord.slice(0, Math.min(tier, 3)).toUpperCase(),
      wordTier,
    };

    this.activeHint = hint;
    return hint;
  }

  recordEngagement(user: FinderInfo, type: 'like' | 'gift', count = 1) {
    const prev = this.playerScores.get(user.platformUserId);
    if (!prev) return;
    if (type === 'like') {
      prev.likesSent = (prev.likesSent || 0) + count;
      prev.xp += count * 2;
    } else {
      prev.giftsDiamonds = (prev.giftsDiamonds || 0) + count;
      prev.xp += count * 25;
    }
    this.playerScores.set(user.platformUserId, prev);
  }

  private creditPlayer(finder: FinderInfo, points: number, wordsFound: number, isTitle: boolean) {
    const prev = this.playerScores.get(finder.platformUserId) || {
      platformUserId: finder.platformUserId,
      displayName: finder.displayName,
      platform: finder.platform,
      profileImage: finder.profileImage,
      score: 0,
      xp: 0,
      wordCount: 0,
      targetCount: 0,
      titleWordCount: 0,
      likesSent: 0,
      giftsDiamonds: 0,
    };
    prev.displayName = finder.displayName || prev.displayName;
    prev.profileImage = finder.profileImage || prev.profileImage;
    prev.score += points;
    prev.xp += Math.round(points / 10);
    prev.wordCount += wordsFound;
    if (isTitle) prev.titleWordCount += 1;
    this.playerScores.set(finder.platformUserId, prev);
  }

  private pushTag(tag: RecentTag) {
    this.recentTags.push(tag);
    if (this.recentTags.length > 18) {
      this.recentTags.shift();
    }
  }

  getCommonWordTarget(): number {
    if (this.mode === 'wikiword-4x4') return 0;
    const count = this.commonWords.size;
    return count > 0 ? Math.max(3, Math.ceil(count * 0.25)) : 0;
  }

  getRareWordTarget(): number {
    if (this.mode === 'wikiword-4x4') return 0;
    const count = this.rareWords.size;
    return count > 0 ? Math.max(2, Math.ceil(count * 0.12)) : 0;
  }

  getUltraWordTarget(): number {
    if (this.mode === 'wikiword-4x4') return 0;
    const count = this.ultraRareWords.size;
    return count > 0 ? Math.min(3, count) : 0;
  }

  getCurrentTierPhase(): TierPhase {
    const cTarget = this.getCommonWordTarget();
    if (cTarget > 0 && this.foundCommon.size < cTarget) return 'common';
    const rTarget = this.getRareWordTarget();
    if (rTarget > 0 && this.foundRare.size < rTarget) return 'rare';
    const uTarget = this.getUltraWordTarget();
    if (uTarget > 0 && this.foundUltra.size < uTarget) return 'ultra';
    return 'complete';
  }

  isComplete(): boolean {
    return this.titleWords.length > 0 && this.revealedTitleWords.size >= this.titleWords.length;
  }

  getTitleChips(): TitleChip[] {
    return this.titleWords.map((w, index) => ({
      index,
      word: this.revealedTitleWords.has(w) ? w : null,
      length: w.length,
      revealed: this.revealedTitleWords.has(w),
      finder: this.revealedTitleWords.get(w) || null,
    }));
  }

  getTargetCards(): TargetCard[] {
    const sorted = Array.from(this.rankedGuesses.values()).sort(
      (a, b) => a.rank - b.rank || a.word.localeCompare(b.word)
    );
    const out: TargetCard[] = [];
    for (let i = 0; i < 5; i++) {
      const g = sorted[i];
      if (g) {
        out.push({
          position: i + 1,
          rank: g.rank,
          word: g.word,
          revealed: true,
          closeness: g.closeness,
          finder: g.finder,
          isTarget: g.word === this.rankTarget,
          pointsAwarded: g.pointsAwarded,
        });
      } else {
        out.push({
          position: i + 1,
          rank: null,
          word: null,
          revealed: false,
          closeness: 0,
          finder: null,
          isPlaceholder: true,
        });
      }
    }
    return out;
  }

  getActiveTierStartCells(): TierStartCell[] {
    const out: TierStartCell[] = [];
    const seen = new Set<number>();
    const pushIfNew = (idx: number, tier: 'common' | 'rare' | 'ultra', filled?: boolean) => {
      if (seen.has(idx)) return;
      seen.add(idx);
      out.push({ idx, tier, filled });
    };

    if (this.mode === 'wikiword-4x4') {
      const commonTotal = this.commonWords.size;
      const found = this.foundCommon.size;
      for (const tw of this.titleWords) {
        if (this.revealedTitleWords.has(tw)) continue;
        const cells = this.allWords.get(tw) || this.targetPaths[tw];
        if (cells && cells.length > 0) {
          pushIfNew(cells[0], 'common', commonTotal > 0 && found * 4 >= commonTotal * 3);
        }
      }
      return out;
    }

    const phase = this.getCurrentTierPhase();
    if (phase === 'common' || phase === 'rare' || phase === 'ultra') {
      const map =
        phase === 'rare'
          ? this.rareWords
          : phase === 'ultra'
          ? this.ultraRareWords
          : this.commonWords;
      const found =
        phase === 'rare'
          ? this.foundRare
          : phase === 'ultra'
          ? this.foundUltra
          : this.foundCommon;
      for (const [word, cells] of map.entries()) {
        if (found.has(word)) continue;
        if (cells.length > 0) pushIfNew(cells[0], phase);
      }
      return out;
    }

    // When tier goals are met, outline remaining unrevealed title words
    for (const tw of this.titleWords) {
      if (this.revealedTitleWords.has(tw)) continue;
      const cells = this.allWords.get(tw) || this.targetPaths[tw];
      if (cells && cells.length > 0) {
        pushIfNew(cells[0], 'ultra');
      }
    }
    return out;
  }

  getActiveCommonCells(): number[] {
    const active = new Set<number>();
    const phase = this.getCurrentTierPhase();
    const map =
      phase === 'rare'
        ? this.rareWords
        : phase === 'ultra'
        ? this.ultraRareWords
        : this.commonWords;
    const found =
      phase === 'rare'
        ? this.foundRare
        : phase === 'ultra'
        ? this.foundUltra
        : this.foundCommon;

    if (phase !== 'complete') {
      for (const [w, cells] of map.entries()) {
        if (!found.has(w)) {
          for (const c of cells) active.add(c);
        }
      }
    }
    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        const cells = this.allWords.get(tw) || this.targetPaths[tw] || [];
        for (const c of cells) active.add(c);
      }
    }
    return Array.from(active);
  }

  getSearchWords(): SearchWordSlot[] {
    const slots: SearchWordSlot[] = [];

    // 1. Title Words being looked for
    this.titleWords.forEach((tw, idx) => {
      const finder = this.revealedTitleWords.get(tw) || null;
      const foundEntry = this.foundWords.get(tw);
      slots.push({
        id: `title-${idx}-${tw.length}`,
        tier: 'title',
        length: tw.length,
        startLetter: tw[0].toUpperCase(),
        revealed: !!finder,
        word: finder ? tw.toUpperCase() : null,
        unmaskedWord: tw.toUpperCase(),
        finderName: finder?.displayName || null,
        points: foundEntry?.points,
        cells: foundEntry?.cells || [],
      });
    });

    // Helper to build tier target slots (found first, then unfound up to target count)
    const addTierSlots = (
      tier: 'common' | 'rare' | 'ultra',
      wordMap: Map<string, number[]>,
      foundMap: Map<string, FinderInfo>,
      targetCount: number
    ) => {
      const foundWordsList = Array.from(foundMap.entries());
      const unfoundWordsList = Array.from(wordMap.keys()).filter((w) => !foundMap.has(w));
      const totalToShow = Math.max(targetCount, foundWordsList.length);

      let count = 0;
      for (const [w, finder] of foundWordsList) {
        if (count >= totalToShow) break;
        const entry = this.foundWords.get(w);
        slots.push({
          id: `${tier}-found-${w}`,
          tier,
          length: w.length,
          startLetter: w[0].toUpperCase(),
          revealed: true,
          word: w.toUpperCase(),
          unmaskedWord: w.toUpperCase(),
          finderName: finder.displayName,
          points: entry?.points,
          cells: entry?.cells || wordMap.get(w) || [],
        });
        count++;
      }

      for (let i = 0; i < unfoundWordsList.length && count < totalToShow; i++) {
        const w = unfoundWordsList[i];
        slots.push({
          id: `${tier}-unfound-${i}-${w.length}`,
          tier,
          length: w.length,
          startLetter: w[0].toUpperCase(),
          revealed: false,
          word: null,
          unmaskedWord: w.toUpperCase(),
          finderName: null,
          cells: wordMap.get(w) || [],
        });
        count++;
      }
    };

    addTierSlots('common', this.commonWords, this.foundCommon, this.getCommonWordTarget());
    addTierSlots('rare', this.rareWords, this.foundRare, this.getRareWordTarget());
    addTierSlots('ultra', this.ultraRareWords, this.foundUltra, this.getUltraWordTarget());

    return slots;
  }

  publicState(): PublicGameState {
    const allTitleRevealed =
      this.titleWords.length > 0 && this.revealedTitleWords.size >= this.titleWords.length;
    const showArticle = this.isComplete() || allTitleRevealed;

    return {
      roundId: this.roundId,
      mode: this.mode,
      grid: this.grid,
      rows: this.rows,
      cols: this.cols,
      minWordLength: this.minWordLength,
      articleTitle: showArticle ? this.article.title : null,
      unmaskedArticleTitle: this.article.title,
      articleExtract: showArticle ? this.article.extract : null,
      articleCategory: this.article.category,
      articleUrl: showArticle ? this.article.url : null,
      titleChips: this.getTitleChips(),
      targets: this.getTargetCards(),
      foundWords: Array.from(this.foundWords.values()).sort((a, b) => b.timestamp - a.timestamp),
      foundCount: this.foundWords.size,
      totalGridWords: this.allWords.size,
      titleWordCount: this.titleWords.length,
      revealedTitleWordCount: this.revealedTitleWords.size,
      commonWordCount: this.commonWords.size,
      commonWordTarget: this.getCommonWordTarget(),
      foundCommonCount: this.foundCommon.size,
      rareWordCount: this.rareWords.size,
      rareWordTarget: this.getRareWordTarget(),
      foundRareCount: this.foundRare.size,
      ultraWordCount: this.ultraRareWords.size,
      ultraWordTarget: this.getUltraWordTarget(),
      foundUltraCount: this.foundUltra.size,
      currentTierPhase: this.getCurrentTierPhase(),
      activeTierStartCells: this.getActiveTierStartCells(),
      activeCommonCells: this.getActiveCommonCells(),
      topPlayers: Array.from(this.playerScores.values())
        .filter((p) => p.wordCount > 0 && p.score > 0)
        .sort((a, b) => b.score - a.score),
      recentTags: this.recentTags.slice(-14),
      searchWords: this.getSearchWords(),
      isComplete: this.isComplete(),
      startTime: this.startTime,
      roundEndCountdownSec: this.roundEndCountdownSec,
      rankTargetHint: `${this.rankTarget.length} letters · Category: ${this.article.category}`,
      totalRankedWords: this.totalRankedWords,
      activeHint: this.activeHint,
    };
  }
}

export async function createNewGameInstance(
  mode: GameMode,
  seedKey?: string
): Promise<WiKirecGame> {
  const trie = getTrie();
  const isCompact = mode === 'wikiword-4x4';
  const article = await fetchWikipediaRoundArticle({
    seedKey,
    compactSingleWord: isCompact,
  });

  const built = buildGrid(
    article.titleWords,
    article.keywords,
    trie,
    { rows: 5, cols: 9, minWordLength: 3, seedStr: seedKey }
  );

  const roundId = `${mode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const game = new WiKirecGame(roundId, mode);
  game.initialize(article, built);
  return game;
}
