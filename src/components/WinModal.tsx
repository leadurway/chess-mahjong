import React, { useEffect, useMemo, useState } from 'react';
import { ChessTile } from './ChessTile';
import { Tile, Meld, GameMode } from '../types';
import { sortHandForDisplay, getMeldDisplayTiles } from '../utils/gameEngine';

interface WinModalProps {
  winner: 'player' | 'ai';
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

function useFireworkParticles(burstCount = 10, particlesPerBurst = 16) {
  return useMemo(() => {
    const particles: {
      id: string;
      originX: string;
      originY: string;
      dx: number;
      dy: number;
      delay: number;
      color: string;
    }[] = [];
    for (let b = 0; b < burstCount; b++) {
      const originX = `${10 + Math.random() * 80}%`;
      const originY = `${8 + Math.random() * 55}%`;
      const burstDelay = Math.random() * 2;
      for (let p = 0; p < particlesPerBurst; p++) {
        const angle = (p / particlesPerBurst) * Math.PI * 2 + Math.random() * 0.3;
        const distance = 60 + Math.random() * 90;
        particles.push({
          id: `fw_${b}_${p}`,
          originX,
          originY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          delay: burstDelay + Math.random() * 0.3,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        });
      }
    }
    return particles;
  }, []);
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
  const particles = useFireworkParticles();
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContinue(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const aiReveal = buildRevealCells(aiConcealedTiles, aiMelds, isPlayerWin ? null : winningTile);
  const playerReveal = buildRevealCells(playerConcealedTiles, playerMelds, isPlayerWin ? winningTile : null);

  // Both rows always use the SAME number of grid columns (the mode's full hand size),
  // regardless of how many tiles either side actually holds — so tile size stays identical
  // between the two rows and across hands. Whoever holds fewer tiles (the side that just
  // discarded the winning tile) simply leaves the trailing slot(s) on the right empty,
  // rather than their tiles stretching wider to fill the row.
  const slotCount = mode === 32 ? 5 : 8;

  return (
    // flex-col + a lone `m-auto` child (below) centers the modal both ways when it fits the
    // viewport, but degrades to natural top-aligned flow — not a broken/clipped-off overflow —
    // once content is taller than the screen (landscape phones), so overflow-y-auto keeps working.
    <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto p-3 flex flex-col">
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-amber-500/30 rounded-3xl p-3 m-auto shadow-2xl text-stone-100">

        {/* a. Both hands, one row each: exposed melds (same chow/pong/kong glow + kong tile-
            compression as the live game) first, then the sorted concealed tiles with the
            winning tile pinned rightmost with a red glow. Grid columns fixed to the mode's
            full hand size (not the actual tile count) so the row fills the exact available
            width edge-to-edge and both hands render at the identical tile size, with any
            missing tile leaving an empty slot on the right. */}
        <div className="space-y-3 mb-4">
          <div>
            <span className="text-[10px] text-stone-500 uppercase font-semibold block mb-1">🤖 電腦手牌</span>
            <div
              className="-mx-3 grid gap-0.5 bg-stone-950 p-1 border-y border-stone-800"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {aiReveal.map(({ tile, isFaceDown, glow }, idx) => (
                <ChessTile key={`ai_${idx}`} tile={tile} size="winReveal" isFaceDown={isFaceDown} glow={glow} />
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500 uppercase font-semibold block mb-1">👤 玩家手牌</span>
            <div
              className="-mx-3 grid gap-0.5 bg-stone-950 p-1 border-y border-stone-800"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {playerReveal.map(({ tile, isFaceDown, glow }, idx) => (
                <ChessTile key={`p_${idx}`} tile={tile} size="winReveal" isFaceDown={isFaceDown} glow={glow} />
              ))}
            </div>
          </div>
        </div>

        {/* b. Win message box — same color scheme as the active draw button, height reduced to 60% */}
        <div className="w-full h-[86px] mb-4 rounded-2xl bg-red-600 text-white shadow-[0_0_24px_8px_rgba(220,38,38,0.55)] ring-2 ring-red-300 flex flex-col items-center justify-center">
          <span className="text-3xl font-serif font-black">
            {isPlayerWin ? '玩家' : '電腦'} {isSelfDraw ? '自摸' : '胡牌'}！
          </span>
          <span className="text-sm mt-0.5 opacity-90">{isPlayerWin ? '🌟 恭喜獲勝！' : '💀 對手胡牌了'}</span>
        </div>

        {/* c. Fan / score calculation */}
        <div className="bg-stone-850/60 rounded-2xl p-4 border border-stone-800 mb-4">
          <h3 className="text-sm font-semibold text-amber-500 mb-2 font-serif flex justify-between items-center">
            <span>📊 台數計算</span>
            <span className="text-xl text-amber-400 font-extrabold font-mono">{totalFans} 台</span>
          </h3>
          <div className="divide-y divide-stone-800 text-xs max-h-32 overflow-y-auto">
            {fans.map((fan, index) => (
              <div key={`fan_${index}`} className="py-2 flex justify-between items-center">
                <span className="text-stone-300 font-medium">{fan.name}</span>
                <span className="text-amber-500 font-bold font-mono">+{fan.value} 台</span>
              </div>
            ))}
            {fans.length === 0 && (
              <div className="py-3 text-center text-stone-500">無特殊台數組合。</div>
            )}
          </div>
        </div>

        {/* d. Continue button — appears after 3s, height reduced to 60% to match the message box */}
        {showContinue && (
          <button
            onClick={onRestart}
            className="w-full h-[86px] rounded-2xl bg-yellow-400 text-black font-serif font-black text-3xl shadow-[0_0_24px_8px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition"
          >
            繼續下局
          </button>
        )}
      </div>

      {/* Fireworks — rendered last (on top of the modal card, not just the backdrop) and
          fixed to the viewport regardless of scroll, so the celebratory burst is always
          visible: origins are randomized across the whole screen, and on tall/narrow phones
          the modal card itself can cover almost the entire viewport, leaving no backdrop
          area free for a "behind the modal" effect to actually be seen. Kept pointer-events-none
          so it never blocks the tiles or the continue button underneath it. */}
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
              backgroundColor: p.color,
              boxShadow: `0 0 12px 4px ${p.color}`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
};
