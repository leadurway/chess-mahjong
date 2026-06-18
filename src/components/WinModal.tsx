import React from 'react';
import { ChessTile } from './ChessTile';
import { Tile, Meld } from '../types';

interface WinModalProps {
  winner: 'player' | 'ai';
  winningTile: Tile | null;
  isSelfDraw: boolean;
  fans: Array<{ name: string; value: number }>;
  totalFans: number;
  handSnapshot: Tile[];
  meldsSnapshot: Meld[];
  onRestart: () => void;
  onGoToMenu: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  winner,
  winningTile,
  isSelfDraw,
  fans,
  totalFans,
  handSnapshot,
  meldsSnapshot,
  onRestart,
  onGoToMenu,
}) => {
  const isPlayerWin = winner === 'player';

  return (
    <div className="bg-stone-900 border-2 border-amber-500/30 rounded-3xl p-8 max-w-xl w-full mx-auto shadow-2xl relative overflow-hidden text-stone-100 text-center animate-fade-in">
      
      {/* Decorative colored glow backdrop overlay */}
      <div className={`absolute top-0 inset-x-0 h-2 w-full ${isPlayerWin ? 'bg-gradient-to-r from-red-600 via-amber-500 to-rose-600 animate-pulse' : 'bg-slate-700'}`}></div>

      {/* Decorative character backdrop overlay */}
      <h1 className="absolute -bottom-10 -right-10 text-[180px] text-stone-850/20 pointer-events-none font-serif leading-none select-none">
        {isPlayerWin ? '勝' : '敗'}
      </h1>

      <div className="mb-6">
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold font-serif mb-3 shadow ${
          isPlayerWin 
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
            : 'bg-stone-800 text-stone-400 border border-stone-700'
        }`}>
          {isSelfDraw ? '自摸 (Self Draw)' : '榮胡 / 胡他人打牌 (Win on Discard)'}
        </span>
        
        <h2 className={`text-4xl font-extrabold font-serif tracking-widest ${isPlayerWin ? 'text-amber-400' : 'text-stone-400'}`}>
          {isPlayerWin ? '🌟 恭喜你胡牌！' : '💀 遺憾！對手胡牌了'}
        </h2>
        
        <p className="text-stone-400 text-xs mt-2 select-none">
          {isPlayerWin 
            ? '你有絕佳的牌技與絕頂的手氣！' 
            : '別氣餒，下一局手氣一定會大紅。'}
        </p>
      </div>

      {/* Show the complete winning hands layout */}
      <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 my-6 shadow-inner text-left">
        <h3 className="text-sm font-semibold text-amber-500 mb-3 font-serif">🀄 胡牌面子組合 (Winning Hand & Melds)</h3>
        
        <div className="space-y-4">
          {/* Eaten/Ponged Melds */}
          {meldsSnapshot.length > 0 && (
            <div>
              <span className="text-[10px] text-stone-500 uppercase block mb-1.5 font-semibold">亮相副 (Exposed Melds)</span>
              <div className="flex flex-wrap gap-4">
                {meldsSnapshot.map((meld, mIdx) => (
                  <div key={`meld_${mIdx}`} className="flex gap-1.5 bg-stone-900/60 p-2 rounded-xl border border-stone-800 shadow-sm relative">
                    <span className="absolute -top-2 -right-1 bg-amber-550 text-stone-950 text-[8px] font-bold px-1 rounded transform rotate-3">
                      {meld.type === 'chow' ? '吃' : meld.type === 'pong' ? '碰' : '槓'}
                    </span>
                    {meld.tiles.map((tile, tIdx) => (
                      <ChessTile key={`mt_${mIdx}_${tIdx}`} tile={tile} size="sm" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concealed Hand */}
          <div>
            <span className="text-[10px] text-stone-500 uppercase block mb-1.5 font-semibold">門清牌 (Concealed in Hand)</span>
            <div className="flex flex-wrap gap-1.5 items-end">
              {handSnapshot.map((tile, index) => {
                // Highlight the winning tile specifically if self-drawn
                const isWinnerDrawn = isPlayerWin 
                  ? (winningTile && tile.id === winningTile.id)
                  : false;

                return (
                  <div key={`hand_${index}`} className="relative">
                    <ChessTile tile={tile} size="sm" isSelected={isWinnerDrawn} />
                    {isWinnerDrawn && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1 rounded animate-bounce shadow">
                        胡
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Score calculation details */}
      <div className="bg-stone-850/60 rounded-2xl p-6 border border-stone-800 text-left mb-8">
        <h3 className="text-sm font-semibold text-amber-500 mb-2 font-serif flex justify-between items-center">
          <span>📊 台數加總計算 (Score / Fans details)</span>
          <span className="text-xl text-amber-400 font-extrabold font-mono">{totalFans} 台 (Fans)</span>
        </h3>
        
        <div className="divide-y divide-stone-800 text-xs">
          {fans.map((fan, index) => (
            <div key={`fan_${index}`} className="py-2.5 flex justify-between items-center">
              <span className="text-stone-300 font-medium">{fan.name}</span>
              <span className="text-amber-500 font-bold font-mono">+{fan.value} 台</span>
            </div>
          ))}
          {fans.length === 0 && (
            <div className="py-4 text-center text-stone-500">
              無特殊台數組合。
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onRestart}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-serif font-bold py-3 rounded-xl shadow-lg transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          再來一局 (Play Again)
        </button>
        <button
          onClick={onGoToMenu}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold py-3 rounded-xl border border-stone-700 transition duration-200"
        >
          返回主選單 (Main Menu)
        </button>
      </div>

    </div>
  );
};
