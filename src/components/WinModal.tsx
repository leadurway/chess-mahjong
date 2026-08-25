import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChessTile } from './ChessTile';
import { Tile, Meld, GameMode } from '../types';
import { sortHandForDisplay, getMeldDisplayTiles } from '../utils/gameEngine';
import { useDeviceType, useIsLandscape, useIsLargeScreen, useSecondaryPageScale } from '../hooks/useResponsive';

interface WinModalProps {
  winner: 'player' | 'ai' | null; // null = 流局 (drawn game, wall exhausted with nobody winning)
  winningTile: Tile | null;
  isSelfDraw: boolean;
  fans: Array<{ name: string; value: number }>;
  totalFans: number;
  playerConcealedTiles: Tile[];
  aiConcealedTiles: Tile[];
  playerMelds: Meld[];
  aiMelds: Meld[];
  mode: GameMode;
  onRestart: () => void;
}

const FIREWORK_COLORS = ['#fbbf24', '#ef4444', '#34d399', '#60a5fa', '#f472b6', '#ffffff'];

// A region (in viewport percentage) that firework burst origins should try to avoid —
// measured from the actual hand-row/fan-box elements so this stays correct regardless of
// screen size or how much content each side has.
interface AvoidRect { left: number; right: number; top: number; bottom: number; }

function useFireworkParticles(avoidRects: AvoidRect[], burstCount = 10, particlesPerBurst = 16) {
  return useMemo(() => {
    const particles: {
      id: string;
      originX: string;
      originY: string;
      dx: number;
      dy: number;
      delay: number;
      color: string;
      size: number;
    }[] = [];

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1;

    const isInAvoidZone = (xPct: number, yPct: number) =>
      avoidRects.some(r => xPct >= r.left && xPct <= r.right && yPct >= r.top && yPct <= r.bottom);
    const isInAvoidZonePx = (xPx: number, yPx: number) => isInAvoidZone((xPx / vw) * 100, (yPx / vh) * 100);

    // Reject-sample an origin outside every avoid zone; if we somehow can't find one after
    // a reasonable number of tries (e.g. the zones cover nearly the whole screen), just use
    // whatever we last tried rather than looping forever — "avoid as much as possible", not
    // a hard guarantee.
    const pickOrigin = () => {
      let x = 2 + Math.random() * 96;
      let y = 2 + Math.random() * 96;
      for (let attempt = 0; attempt < 20 && isInAvoidZone(x, y); attempt++) {
        x = 2 + Math.random() * 96;
        y = 2 + Math.random() * 96;
      }
      return { x, y };
    };

    for (let b = 0; b < burstCount; b++) {
      // Origins span almost the full screen (not just a safe middle band, and steering clear
      // of the hand rows / fan-count box) and each burst gets its own random spread scale, so
      // some bursts are small/tight and others large/wide — both position AND size end up as
      // randomized as possible, not just picked from a range that always looks the same.
      const { x, y } = pickOrigin();
      const originX = `${x}%`;
      const originY = `${y}%`;
      const originXPx = (x / 100) * vw;
      const originYPx = (y / 100) * vh;
      const burstDelay = Math.random() * 2;
      const burstSpread = 0.5 + Math.random() * 1.5;
      for (let p = 0; p < particlesPerBurst; p++) {
        const angle = (p / particlesPerBurst) * Math.PI * 2 + Math.random() * 0.3;
        const distance = (60 + Math.random() * 90) * burstSpread;
        let dx = Math.cos(angle) * distance;
        let dy = Math.sin(angle) * distance;

        // The origin itself is kept clear of every avoid zone, but a burst can travel up to
        // ~300px outward — easily far enough to fly straight through a zone anyway. Shrink
        // this particle's individual travel distance in steps until its landing point clears
        // every zone (or bottoms out at 30% of its original reach), so the visible spray
        // steers clear of the tiles/fan-count instead of just its starting point.
        let scale = 1;
        while (scale > 0.3 && isInAvoidZonePx(originXPx + dx * scale, originYPx + dy * scale)) {
          scale -= 0.15;
        }
        dx *= scale;
        dy *= scale;

        particles.push({
          id: `fw_${b}_${p}`,
          originX,
          originY,
          dx,
          dy,
          delay: burstDelay + Math.random() * 0.3,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          size: 5 + Math.random() * 17,
        });
      }
    }
    return particles;
  }, [avoidRects, burstCount, particlesPerBurst]);
}

interface RevealCell {
  tile: Tile;
  isFaceDown: boolean;
  glow?: 'blue' | 'red';
}

// Builds the reveal row exactly like the live game's hand+meld frame: exposed melds first
// (with the same blue/red glow and kong tile-compression treatment as renderMeldGroup in
// GameScreen.tsx), then the sorted concealed tiles, with the winning tile — if it's part of
// this side's concealed hand — pulled out and pinned at the far right with a red glow.
function buildRevealCells(concealedHand: Tile[], melds: Meld[], winningTile: Tile | null): RevealCell[] {
  const meldCells: RevealCell[] = [...melds].reverse().flatMap(meld =>
    getMeldDisplayTiles(meld).map(({ tile, isTrigger, isFaceDown }): RevealCell => ({
      tile,
      isFaceDown,
      glow: meld.type === 'kong' && isTrigger ? 'red' : 'blue',
    }))
  );

  const winningTileInHand = winningTile && concealedHand.some(t => t.id === winningTile.id) ? winningTile : null;
  const restOfHand = winningTileInHand ? concealedHand.filter(t => t.id !== winningTileInHand.id) : concealedHand;
  const handCells: RevealCell[] = sortHandForDisplay(restOfHand).map(tile => ({ tile, isFaceDown: false }));
  if (winningTileInHand) {
    handCells.push({ tile: winningTileInHand, isFaceDown: false, glow: 'red' });
  }

  return [...meldCells, ...handCells];
}

export const WinModal: React.FC<WinModalProps> = ({
  winner,
  winningTile,
  isSelfDraw,
  fans,
  totalFans,
  playerConcealedTiles,
  aiConcealedTiles,
  playerMelds,
  aiMelds,
  mode,
  onRestart,
}) => {
  const isPlayerWin = winner === 'player';

  // Same device-based classification used everywhere else (App.tsx's DeviceTypeProvider),
  // not a raw CSS md: breakpoint — a phone in landscape with a wide viewport must not get the
  // iPad/desktop treatment just because its width happens to cross 768px.
  const isLargeScreen = useIsLargeScreen();
  const deviceType = useDeviceType();
  const isLandscape = useIsLandscape();
  // iPad landscape reuses iPad PORTRAIT's WIDTH setting (same physical device, just rotated) —
  // not just "uncapped", but the literal same pixel size portrait would use, i.e. capped to
  // min(innerWidth, innerHeight), which is invariant to rotation and so gives portrait and
  // landscape the identical card width. This matches how useSecondaryPageScale already locks
  // the scale itself for 'ipad' to `[min(w,h), max(w,h)]` regardless of actual orientation.
  // PC web isn't a rotating physical device, so it keeps its own real per-orientation shape.
  const isIpadLocked = deviceType === 'ipad';
  // -24 matches the scroll wrapper's own `p-3` (12px each side) — portrait's width already
  // nets out to this via plain `w-full` of that padded wrapper, so the explicit cap here needs
  // the same subtraction to land on the exact same pixel width, not 24px wider.
  const ipadLockedMaxWidthPx = isIpadLocked && typeof window !== 'undefined'
    ? Math.min(window.innerWidth, window.innerHeight) - 24
    : undefined;
  // Plain portrait (and iPad, locked) has plenty of vertical room to spare, so the card should
  // read as large as possible: no Tailwind width cap (max-w-2xl/max-w-md otherwise leaves a
  // real unused margin on wider portrait screens like iPad/PC web, where the backdrop is
  // comfortably wider than either cap) — capped instead via the explicit inline style above for
  // iPad specifically, or left uncapped (`max-w-full`) for plain phone/PC-web portrait. Plain
  // landscape (iPhone, PC web) keeps the original caps — its shorter viewport is genuinely the
  // binding constraint there, and this is the proven-working layout.
  const cardMaxWidthClass = (!isLandscape || isIpadLocked) ? 'max-w-full' : isLargeScreen ? 'max-w-2xl' : 'max-w-md';
  const cardPaddingClass = isLargeScreen ? 'p-6' : 'p-3';
  // Designed for older players: nothing on this page may render under 15px — several of these
  // (labelTextClass, winSubTextClass, fanHeadingClass, fanListTextClass) previously sat below
  // that on iPhone, and labelTextClass was under it on large screens too.
  const labelTextClass = isLargeScreen ? 'text-xl' : 'text-[15px]';
  const handBleedClass = isLargeScreen ? '-mx-6' : '-mx-3';
  const boxHeightClass = isLargeScreen ? 'h-[120px]' : 'h-[86px]';
  const winTextClass = isLargeScreen ? 'text-5xl' : 'text-3xl';
  const winSubTextClass = isLargeScreen ? 'text-xl' : 'text-[15px]';
  const fanBoxPaddingClass = isLargeScreen ? 'p-6' : 'p-4';
  const fanHeadingClass = isLargeScreen ? 'text-xl' : 'text-[15px]';
  const fanTotalClass = isLargeScreen ? 'text-3xl' : 'text-xl';
  const fanListTextClass = isLargeScreen ? 'text-lg' : 'text-[15px]';
  const fanListMaxHeightClass = isLargeScreen ? 'max-h-48' : 'max-h-32';

  // Card scale per device tier (see useSecondaryPageScale). Its own height must be computed in
  // the UNSCALED coordinate space (transform doesn't feed back into layout, so a fixed height
  // plus an extra upscale would visually exceed the viewport with no way to reach the excess) —
  // dividing by scale keeps the VISUAL result at this fraction of the viewport regardless of
  // scale, while overflow-y-auto (unchanged) keeps handling any real overflow beyond it.
  // This is a real `height`, not just a `max-height` — when the card's own content (hand rows,
  // win box, fan box, continue button) is shorter than the available space, as it usually is on
  // a roomy iPad portrait screen, the card still fills the full target height, with the leftover
  // space distributed as gaps between those sections via `justify-between` on the card itself
  // (see the card's className) rather than sitting empty above/below a content-sized card.
  const cardRef = useRef<HTMLDivElement>(null);
  const { scale } = useSecondaryPageScale(cardRef);
  // Height stays orientation-aware (the real, actual viewport height) even for iPad — only the
  // WIDTH cap above is locked to portrait's setting. The scroll wrapper around the card (see the
  // return below) stays in place regardless, as a general safety net for whenever the card's
  // content genuinely needs more room than this fraction of the real viewport provides.
  const heightRefPx = typeof window === 'undefined' ? 900 : window.innerHeight;
  const maxHeightPx = (heightRefPx * 0.96) / scale;

  // Measured post-mount so fireworks can steer clear of the AI/player hand rows and the fan
  // (台數/"score") box — real DOM rects rather than guessed layout percentages, so this stays
  // correct across every screen size and however many tiles/melds either hand has.
  const aiHandRowRef = useRef<HTMLDivElement>(null);
  const playerHandRowRef = useRef<HTMLDivElement>(null);
  const fanBoxRef = useRef<HTMLDivElement>(null);
  const [avoidRects, setAvoidRects] = useState<AvoidRect[]>([]);

  useEffect(() => {
    const pad = 16; // px buffer kept clear around each measured element
    const toRect = (el: HTMLDivElement | null): AvoidRect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: ((r.left - pad) / window.innerWidth) * 100,
        right: ((r.right + pad) / window.innerWidth) * 100,
        top: ((r.top - pad) / window.innerHeight) * 100,
        bottom: ((r.bottom + pad) / window.innerHeight) * 100,
      };
    };
    setAvoidRects(
      [aiHandRowRef.current, playerHandRowRef.current, fanBoxRef.current]
        .map(toRect)
        .filter((r): r is AvoidRect => r !== null)
    );
  }, []);

  const particles = useFireworkParticles(avoidRects);

  const aiReveal = buildRevealCells(aiConcealedTiles, aiMelds, isPlayerWin ? null : winningTile);
  const playerReveal = buildRevealCells(playerConcealedTiles, playerMelds, isPlayerWin ? winningTile : null);

  // Both rows always use the SAME number of grid columns (the mode's full hand size),
  // regardless of how many tiles either side actually holds — so tile size stays identical
  // between the two rows and across hands. Whoever holds fewer tiles (the side that just
  // discarded the winning tile) simply leaves the trailing slot(s) on the right empty,
  // rather than their tiles stretching wider to fill the row.
  const slotCount = mode === 32 ? 5 : 8;

  return (
    // The truly `position: fixed` layer never gets `overflow-y-auto` on itself — that specific
    // combination is what broke scrolling in iPhone landscape in an earlier version of this
    // modal (see the historical note this replaced). Scrolling instead lives on the NON-fixed
    // wrapper directly inside it, which is a completely different, safe pattern: it centers the
    // card as before, but because it's a normal in-flow element (not fixed itself), its own
    // overflow-y-auto can genuinely reveal whatever of the card's box — now deliberately taller
    // than the real viewport for locked iPad landscape — sticks out above/below what's visible.
    // The card keeps its own nested overflow-y-auto too, as a second-layer safety net for the
    // rarer case where its INTERNAL content (e.g. a long fan list) exceeds even that height.
    <div className="fixed inset-0 bg-black/85 z-50">
      <div
        className="h-full overflow-y-auto flex items-center justify-center p-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
      <div
        ref={cardRef}
        className={`relative w-full ${cardMaxWidthClass} overflow-y-auto bg-stone-900 border-2 border-amber-500/30 rounded-3xl ${cardPaddingClass} shadow-2xl text-stone-100 flex flex-col justify-between shrink-0 min-h-0`}
        style={{
          WebkitOverflowScrolling: 'touch',
          height: `${maxHeightPx}px`,
          ...(ipadLockedMaxWidthPx !== undefined ? { maxWidth: `${ipadLockedMaxWidthPx}px` } : {}),
          transform: `scale(${scale})`,
        }}
      >

        {/* a. Both hands, one row each: exposed melds (same chow/pong/kong glow + kong tile-
            compression as the live game) first, then the sorted concealed tiles with the
            winning tile pinned rightmost with a red glow. Grid columns fixed to the mode's
            full hand size (not the actual tile count) so the row fills the exact available
            width edge-to-edge and both hands render at the identical tile size, with any
            missing tile leaving an empty slot on the right. */}
        <div className="space-y-3 mb-4">
          <div ref={aiHandRowRef}>
            <span className={`${labelTextClass} text-stone-200 uppercase font-semibold block mb-1`}>🤖 電腦手牌</span>
            <div
              className={`${handBleedClass} grid gap-0.5 bg-stone-950 p-1 border-y border-stone-800`}
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {aiReveal.map(({ tile, isFaceDown, glow }, idx) => (
                <ChessTile key={`ai_${idx}`} tile={tile} size="winReveal" isFaceDown={isFaceDown} glow={glow} />
              ))}
            </div>
          </div>
          <div ref={playerHandRowRef}>
            <span className={`${labelTextClass} text-stone-200 uppercase font-semibold block mb-1`}>👤 玩家手牌</span>
            <div
              className={`${handBleedClass} grid gap-0.5 bg-stone-950 p-1 border-y border-stone-800`}
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {playerReveal.map(({ tile, isFaceDown, glow }, idx) => (
                <ChessTile key={`p_${idx}`} tile={tile} size="winReveal" isFaceDown={isFaceDown} glow={glow} />
              ))}
            </div>
          </div>
        </div>

        {/* b. Win message box — same color scheme as the active draw button, height reduced to 60% */}
        <div className={`w-full ${boxHeightClass} mb-4 rounded-2xl bg-red-600 text-white shadow-[0_0_24px_8px_rgba(220,38,38,0.55)] ring-2 ring-red-300 flex flex-col items-center justify-center`}>
          <span className={`${winTextClass} font-serif font-black`}>
            {winner === null ? '流局' : `${isPlayerWin ? '玩家' : '電腦'} ${isSelfDraw ? '自摸' : '胡牌'}！`}
          </span>
          <span className={`${winSubTextClass} mt-0.5 opacity-90`}>
            {winner === null ? '🀄 牌牆已摸光，不分勝負' : isPlayerWin ? '🌟 恭喜獲勝！' : '💀 對手胡牌了'}
          </span>
        </div>

        {/* c. Fan / score calculation */}
        <div ref={fanBoxRef} className={`bg-stone-850/60 rounded-2xl ${fanBoxPaddingClass} border border-stone-800 mb-4`}>
          <h3 className={`${fanHeadingClass} font-semibold text-amber-500 mb-2 font-serif flex justify-between items-center`}>
            <span>📊 台數計算</span>
            <span className={`${fanTotalClass} text-amber-400 font-extrabold font-mono`}>{totalFans} 台</span>
          </h3>
          <div className={`divide-y divide-stone-800 ${fanListTextClass} ${fanListMaxHeightClass} overflow-y-auto`}>
            {fans.map((fan, index) => (
              <div key={`fan_${index}`} className="py-2 flex justify-between items-center">
                <span className="text-stone-200 font-medium">{fan.name}</span>
                <span className="text-amber-500 font-bold font-mono">+{fan.value} 台</span>
              </div>
            ))}
            {fans.length === 0 && (
              <div className="py-3 text-center text-stone-200">無特殊台數組合。</div>
            )}
          </div>
        </div>

        {/* d. Continue button — shown immediately alongside the win info, height reduced to
            60% to match the message box */}
        <button
          onClick={onRestart}
          className={`w-full ${boxHeightClass} rounded-2xl bg-yellow-400 text-black font-serif font-black ${winTextClass} shadow-[0_0_24px_8px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition`}
        >
          繼續下局
        </button>
      </div>
      </div>

      {/* Fireworks — only for a player win (celebrating your own win, not the AI's), rendered
          last (on top of the modal card, not just the backdrop) and fixed to the viewport
          regardless of scroll: origins are randomized across the whole screen, and on
          tall/narrow phones the modal card itself can cover almost the entire viewport,
          leaving no backdrop area free for a "behind the modal" effect to actually be seen.
          Kept pointer-events-none so it never blocks the tiles or the continue button. */}
      {isPlayerWin && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {particles.map(p => (
            <div
              key={p.id}
              className="firework-particle"
              style={{
                '--fw-origin-x': p.originX,
                '--fw-origin-y': p.originY,
                '--fw-dx': `${p.dx}px`,
                '--fw-dy': `${p.dy}px`,
                '--fw-delay': `${p.delay}s`,
                '--fw-size': `${p.size}px`,
                backgroundColor: p.color,
                boxShadow: `0 0 ${p.size}px ${p.size / 3}px ${p.color}`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
};
