import React, { useEffect, useMemo, useState } from 'react';
import { ChessTile } from './ChessTile';
import { Tile } from '../types';

interface WinModalProps {
  winner: 'player' | 'ai';
  isSelfDraw: boolean;
  fans: Array<{ name: string; value: number }>;
  totalFans: number;
  playerAllTiles: Tile[];
  aiAllTiles: Tile[];
  onRestart: () => void;
}

const FIREWORK_COLORS = ['#fbbf24', '#ef4444', '#34d399', '#60a5fa', '#f472b6', '#ffffff'];

function useFireworkParticles(burstCount = 6, particlesPerBurst = 10) {
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
        const distance = 40 + Math.random() * 50;
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

export const WinModal: React.FC<WinModalProps> = ({
  winner,
  isSelfDraw,
  fans,
  totalFans,
  playerAllTiles,
  aiAllTiles,
  onRestart,
}) => {
  const isPlayerWin = winner === 'player';
  const particles = useFireworkParticles();
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContinue(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-3 overflow-hidden">
      {/* Fireworks background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
              boxShadow: `0 0 6px 2px ${p.color}`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md bg-stone-900 border-2 border-amber-500/30 rounded-3xl p-5 shadow-2xl text-stone-100">

        {/* a. Both hands, one row each */}
        <div className="space-y-3 mb-4">
          <div>
            <span className="text-[10px] text-stone-500 uppercase font-semibold block mb-1">🤖 電腦手牌</span>
            <div className="flex flex-wrap gap-1 bg-stone-950 rounded-xl p-2 border border-stone-800">
              {aiAllTiles.map((tile, idx) => (
                <ChessTile key={`ai_${idx}`} tile={tile} size="sm" />
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500 uppercase font-semibold block mb-1">👤 玩家手牌</span>
            <div className="flex flex-wrap gap-1 bg-stone-950 rounded-xl p-2 border border-stone-800">
              {playerAllTiles.map((tile, idx) => (
                <ChessTile key={`p_${idx}`} tile={tile} size="sm" />
              ))}
            </div>
          </div>
        </div>

        {/* b. Win message box — same color scheme as the active draw button, 150%/200% sized */}
        <div className="w-full h-36 mb-4 rounded-2xl bg-red-600 text-white shadow-[0_0_24px_8px_rgba(220,38,38,0.55)] ring-2 ring-red-300 flex flex-col items-center justify-center">
          <span className="text-3xl font-serif font-black">
            {isPlayerWin ? '玩家' : '電腦'} {isSelfDraw ? '自摸' : '胡牌'}！
          </span>
          <span className="text-sm mt-1 opacity-90">{isPlayerWin ? '🌟 恭喜獲勝！' : '💀 對手胡牌了'}</span>
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

        {/* d. Continue button — appears after 3s, same size as the win message box */}
        {showContinue && (
          <button
            onClick={onRestart}
            className="w-full h-36 rounded-2xl bg-yellow-400 text-black font-serif font-black text-2xl shadow-[0_0_24px_8px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition"
          >
            繼續下局
          </button>
        )}
      </div>
    </div>
  );
};
