import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HintData, TierStartCell } from '../shared/types';
import { sfx } from '../utils/sfx';

interface BoggleGridProps {
  grid: string[];
  rows: number;
  cols: number;
  activeTierStartCells: TierStartCell[];
  activeCommonCells: number[];
  typedWord: string;
  flashedCells: number[];
  activeHint?: HintData | null;
  onSwipeWordSubmit: (word: string) => void;
  onSwipePreviewChange?: (word: string) => void;
}

function areNeighbors(a: number, b: number, cols: number): boolean {
  const rA = Math.floor(a / cols);
  const cA = a % cols;
  const rB = Math.floor(b / cols);
  const cB = b % cols;
  return Math.abs(rA - rB) <= 1 && Math.abs(cA - cB) <= 1 && a !== b;
}

export function findTypedPathInGrid(
  word: string,
  grid: string[],
  rows: number,
  cols: number
): number[] {
  const clean = word.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!clean || grid.length === 0) return [];
  const total = rows * cols;
  const visited = new Uint8Array(total);

  function dfs(idx: number, pos: number, path: number[]): number[] | null {
    if (pos === clean.length) return [...path];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nextIdx = nr * cols + nc;
        if (visited[nextIdx]) continue;
        if (grid[nextIdx] !== clean[pos]) continue;
        visited[nextIdx] = 1;
        path.push(nextIdx);
        const res = dfs(nextIdx, pos + 1, path);
        if (res) return res;
        path.pop();
        visited[nextIdx] = 0;
      }
    }
    return null;
  }

  for (let i = 0; i < total; i++) {
    if (grid[i] === clean[0]) {
      visited[i] = 1;
      const found = dfs(i, 1, [i]);
      if (found) return found;
      visited[i] = 0;
    }
  }
  return [];
}

export const BoggleGrid: React.FC<BoggleGridProps> = ({
  grid,
  rows,
  cols,
  activeTierStartCells,
  activeCommonCells,
  typedWord,
  flashedCells,
  activeHint,
  onSwipeWordSubmit,
  onSwipePreviewChange,
}) => {
  const [swipePath, setSwipePath] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeCellSet = useMemo(() => new Set(activeCommonCells), [activeCommonCells]);
  const flashedSet = useMemo(() => new Set(flashedCells), [flashedCells]);

  const typedPath = useMemo(() => {
    if (swipePath.length > 0) return [];
    return findTypedPathInGrid(typedWord, grid, rows, cols);
  }, [typedWord, grid, rows, cols, swipePath.length]);

  const swipeSet = useMemo(() => new Set(swipePath), [swipePath]);
  const typedSet = useMemo(() => new Set(typedPath), [typedPath]);

  const currentSwipeWord = useMemo(
    () => swipePath.map((idx) => (grid[idx] || '').toUpperCase()).join(''),
    [swipePath, grid]
  );

  useEffect(() => {
    onSwipePreviewChange?.(currentSwipeWord);
  }, [currentSwipeWord, onSwipePreviewChange]);

  const handleStartCell = useCallback((idx: number) => {
    setIsDragging(true);
    setSwipePath([idx]);
    sfx.playTileStep(0);
  }, []);

  const handleEnterCell = useCallback(
    (idx: number) => {
      if (!isDragging) return;
      setSwipePath((prev) => {
        if (prev.length === 0) return [idx];
        const last = prev[prev.length - 1];
        if (last === idx) return prev;
        if (prev.length >= 2 && prev[prev.length - 2] === idx) {
          sfx.playTileStep(prev.length - 2);
          return prev.slice(0, -1);
        }
        if (prev.includes(idx)) return prev;
        if (!areNeighbors(last, idx, cols)) return prev;
        sfx.playTileStep(prev.length);
        return [...prev, idx];
      });
    },
    [isDragging, cols]
  );

  const finishSwipe = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (swipePath.length >= 3) {
      const word = swipePath.map((i) => grid[i]).join('');
      onSwipeWordSubmit(word);
    }
    setSwipePath([]);
  }, [isDragging, swipePath, grid, onSwipeWordSubmit]);

  useEffect(() => {
    const onWindowUp = () => {
      if (isDragging) finishSwipe();
    };
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('touchend', onWindowUp);
    return () => {
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('touchend', onWindowUp);
    };
  }, [isDragging, finishSwipe]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const tile = el.closest('[data-cell-idx]') as HTMLElement | null;
    if (!tile) return;
    const idx = Number(tile.getAttribute('data-cell-idx'));
    if (!Number.isNaN(idx)) {
      const rect = tile.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist <= rect.width * 0.45) {
        handleEnterCell(idx);
      }
    }
  };

  const activePath = swipePath.length > 0 ? swipePath : typedPath;
  const svgPoints = useMemo(() => {
    if (activePath.length < 2 || rows === 0 || cols === 0) return '';
    return activePath
      .map((idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const x = ((c + 0.5) / cols) * 100;
        const y = ((r + 0.5) / rows) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [activePath, rows, cols]);

  return (
    <section className="grid-wrap" id="grid-wrap">
      <div
        ref={gridRef}
        id="grid"
        className="grid"
        onPointerMove={handlePointerMove}
        style={{
          gridTemplateColumns: `repeat(${cols || 10}, minmax(0, 1fr))`,
        }}
      >
        {grid.map((letter, idx) => {
          const isSwiped = swipeSet.has(idx);
          const isSwipeStart = swipePath[0] === idx;
          const isSwipeLast = swipePath.length > 0 && swipePath[swipePath.length - 1] === idx;

          const isTyped = typedSet.has(idx);
          const isTypedLast = typedPath.length > 0 && typedPath[typedPath.length - 1] === idx;

          const isFlashed = flashedSet.has(idx);
          const isHintCell = activeHint?.startCell === idx || activeHint?.secondCell === idx;
          const isStillActive = activeCommonCells.length === 0 || activeCellSet.has(idx);

          const classes = ['cell'];
          if (!isStillActive && !isSwiped && !isTyped) {
            classes.push('dimmed');
          }
          if (isSwiped) {
            classes.push('swipe-selected');
            if (isSwipeStart) classes.push('swipe-start');
            if (isSwipeLast) classes.push('swipe-last');
          } else if (isTyped || isHintCell) {
            classes.push('typing-path');
            if (isTypedLast || activeHint?.startCell === idx) classes.push('typing-last');
          }
          if (isFlashed) {
            classes.push('flash');
          }

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              data-cell-idx={idx}
              onPointerDown={(e) => {
                e.preventDefault();
                handleStartCell(idx);
              }}
              className={classes.join(' ')}
            >
              {letter}
            </div>
          );
        })}

        <svg
          className="swipe-svg"
          id="swipe-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {svgPoints && (
            <polyline
              points={svgPoints}
              fill="none"
              stroke={swipePath.length > 0 ? '#9eea3a' : '#ee7a2c'}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.82"
            />
          )}
        </svg>
      </div>
    </section>
  );
};
