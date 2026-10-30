import { Trie } from './wordlist';

const LETTER_WEIGHTS: Record<string, number> = {
  a: 9, b: 2, c: 3, d: 4, e: 12, f: 2, g: 3, h: 3,
  i: 9, j: 1, k: 1, l: 5, m: 3, n: 7, o: 8, p: 3,
  q: 1, r: 7, s: 7, t: 7, u: 4, v: 2, w: 2, x: 1,
  y: 2, z: 1,
};

const LETTER_POOL: string[] = (() => {
  const pool: string[] = [];
  for (const [letter, weight] of Object.entries(LETTER_WEIGHTS)) {
    for (let i = 0; i < weight; i++) pool.push(letter);
  }
  return pool;
})();

function randomLetter(rng: () => number = Math.random): string {
  return LETTER_POOL[Math.floor(rng() * LETTER_POOL.length)];
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function neighbors(cellIdx: number, rows: number, cols: number): number[] {
  const r = Math.floor(cellIdx / cols);
  const c = cellIdx % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        out.push(nr * cols + nc);
      }
    }
  }
  return out;
}

export function pickDims(_totalLetters: number): { rows: number; cols: number } {
  return { rows: 5, cols: 9 };
}

function placeWord(
  word: string,
  cells: (string | null)[],
  rows: number,
  cols: number,
  rng: () => number,
  attempts = 80
): number[] | null {
  const total = rows * cols;
  const letters = word.toLowerCase().split('');
  for (let a = 0; a < attempts; a++) {
    const startCandidates: number[] = [];
    for (let i = 0; i < total; i++) {
      if (cells[i] === letters[0]) startCandidates.push(i);
    }
    for (let i = 0; i < total; i++) {
      if (cells[i] === null) startCandidates.push(i);
    }
    shuffle(startCandidates, rng);
    if (startCandidates.length === 0) return null;

    for (let sIdx = 0; sIdx < Math.min(startCandidates.length, 6); sIdx++) {
      const start = startCandidates[sIdx];
      const path = [start];
      const used = new Set([start]);
      let ok = true;

      for (let li = 1; li < letters.length; li++) {
        const prev = path[path.length - 1];
        const wanted = letters[li];
        const matching: number[] = [];
        const blank: number[] = [];

        for (const n of neighbors(prev, rows, cols)) {
          if (used.has(n)) continue;
          if (cells[n] === wanted) matching.push(n);
          else if (cells[n] === null) blank.push(n);
        }
        shuffle(matching, rng);
        shuffle(blank, rng);
        const candidates = matching.concat(blank);
        if (candidates.length === 0) {
          ok = false;
          break;
        }
        const next = candidates[0];
        path.push(next);
        used.add(next);
      }

      if (ok) {
        for (let i = 0; i < letters.length; i++) {
          cells[path[i]] = letters[i];
        }
        return path;
      }
    }
  }
  return null;
}

function tryPlacement(
  targets: string[],
  rows: number,
  cols: number,
  rng: () => number
): { cells: (string | null)[]; paths: Record<string, number[]> } | null {
  const cells: (string | null)[] = new Array(rows * cols).fill(null);
  const paths: Record<string, number[]> = {};
  const ordered = [...targets].sort((a, b) => b.length - a.length);
  for (const word of ordered) {
    const p = placeWord(word, cells, rows, cols, rng);
    if (!p) return null;
    paths[word] = p;
  }
  return { cells, paths };
}

export function findAllWords(
  grid: string[],
  rows: number,
  cols: number,
  trie: Trie,
  minWordLength = 3
): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const total = rows * cols;
  const visited = new Uint8Array(total);

  function dfs(idx: number, node: any, currentWord: string, path: number[]) {
    if (node.isWord && currentWord.length >= minWordLength) {
      if (!found.has(currentWord)) {
        found.set(currentWord, [...path]);
      }
    }
    if (path.length >= 10) return;

    for (const nextIdx of neighbors(idx, rows, cols)) {
      if (visited[nextIdx]) continue;
      const ch = grid[nextIdx];
      const nextNode = node.children.get(ch);
      if (!nextNode) continue;
      visited[nextIdx] = 1;
      path.push(nextIdx);
      dfs(nextIdx, nextNode, currentWord + ch, path);
      path.pop();
      visited[nextIdx] = 0;
    }
  }

  for (let i = 0; i < total; i++) {
    const ch = grid[i];
    const startNode = trie.root.children.get(ch);
    if (!startNode) continue;
    visited[i] = 1;
    dfs(i, startNode, ch, [i]);
    visited[i] = 0;
  }

  return found;
}

export function createSeededRng(seedStr?: string): () => number {
  if (!seedStr) return Math.random;
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return ((seed >>> 0) % 100000) / 100000;
  };
}

export function buildGrid(
  targetsToPlace: string[],
  bonusKeywords: string[],
  trie: Trie,
  options: {
    rows?: number;
    cols?: number;
    minWordLength?: number;
    seedStr?: string;
  } = {}
): {
  grid: string[];
  rows: number;
  cols: number;
  allWords: Map<string, number[]>;
  targetPaths: Record<string, number[]>;
} {
  const rng = createSeededRng(options.seedStr);
  const totalLetters = targetsToPlace.reduce((s, w) => s + w.length, 0);
  const defaultDims = pickDims(totalLetters);
  const rows = options.rows || defaultDims.rows;
  const cols = options.cols || defaultDims.cols;
  const minWordLength = options.minWordLength || 3;

  let placedResult: { cells: (string | null)[]; paths: Record<string, number[]> } | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    placedResult = tryPlacement(targetsToPlace, rows, cols, rng);
    if (placedResult) break;
  }

  if (!placedResult) {
    // Fallback: place as many as fit
    const cells: (string | null)[] = new Array(rows * cols).fill(null);
    const paths: Record<string, number[]> = {};
    for (const w of targetsToPlace) {
      const p = placeWord(w, cells, rows, cols, rng);
      if (p) paths[w] = p;
    }
    placedResult = { cells, paths };
  }

  // Also opportunistically place several article keywords into remaining empty spaces so the grid is rich with article-related words
  const extraPool = shuffle([...bonusKeywords].filter((k) => k.length >= 4 && k.length <= 7), rng).slice(0, 6);
  for (const kw of extraPool) {
    if (!placedResult.paths[kw]) {
      const p = placeWord(kw, placedResult.cells, rows, cols, rng, 20);
      if (p) placedResult.paths[kw] = p;
    }
  }

  const finalGrid: string[] = placedResult.cells.map((c) => c || randomLetter(rng));
  const allWords = findAllWords(finalGrid, rows, cols, trie, minWordLength);

  // Guarantee all placed targets exist in allWords with their exact snake path
  for (const [word, path] of Object.entries(placedResult.paths)) {
    if (!allWords.has(word)) {
      allWords.set(word, path);
    }
  }

  return {
    grid: finalGrid,
    rows,
    cols,
    allWords,
    targetPaths: placedResult.paths,
  };
}
