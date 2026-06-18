import React, { useState } from 'react';
import { GameMode, Difficulty } from '../types';
import { RuleGuide } from './RuleGuide';

interface GameSettingsProps {
  onStartGame: (config: { mode: GameMode; difficulty: Difficulty; playerIsBanker: boolean }) => void;
}

export const GameSettings: React.FC<GameSettingsProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>(32);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playerIsBanker, setPlayerIsBanker] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#064e3b] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative background grids */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      {/* Wooden style circle backdrop ornament */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-emerald-500/10 pointer-events-none rotate-12 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full border-4 border-dashed border-emerald-500/5"></div>
      </div>

      <div className="max-w-md w-full bg-black/40 border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* Calligraphy logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-amber-400 bg-[#05382a] shadow-xl mb-4">
            <span className="text-4xl font-serif font-black text-[#b91c1c] drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">帥</span>
            <span className="text-4xl font-serif font-black text-emerald-200 -ml-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">將</span>
          </div>
          <h1 className="text-3xl font-extrabold text-amber-250 font-serif tracking-widest leading-relaxed">
            象棋麻將
          </h1>
          <p className="text-white/60 text-xs mt-1 font-mono tracking-wider">
            CHINESE CHESS MAHJONG SIMULATOR
          </p>
        </div>

        {/* Form controls */}
        <div className="space-y-6">
          
          {/* Mode Selection */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-2 font-serif">
              🥋 棋子數量模式 (Tile Mode)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode(32)}
                className={`
                  py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${mode === 32 
                    ? 'bg-amber-500 border-amber-400 text-[#064e3b] font-black shadow-lg shadow-amber-500/20' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                32 子 (經典)
                <span className="block text-[9px] opacity-70 font-normal">單一副象棋</span>
              </button>
              
              <button
                type="button"
                onClick={() => setMode(56)}
                className={`
                  py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${mode === 56 
                    ? 'bg-amber-500 border-amber-400 text-[#064e3b] font-black shadow-lg shadow-amber-500/20' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                56 子 (中等)
                <span className="block text-[9px] opacity-70 font-normal">中位混合版</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(64)}
                className={`
                  py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${mode === 64 
                    ? 'bg-amber-500 border-amber-400 text-[#064e3b] font-black shadow-lg shadow-amber-500/20' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                64 子 (雙副)
                <span className="block text-[9px] opacity-70 font-normal">兩副完整棋</span>
              </button>
            </div>
            <p className="text-white/40 text-[10px] mt-2 leading-relaxed">
              {mode === 32 && '💡 32子：莊家起手 5 張，閒家 4 張。1組面子＋1個對子或特殊「五兵（卒）」組合即可勝利。'}
              {mode === 56 && '💡 56子：每種牌面各 4 張。莊家起手 8 張，閒家 7 張。兩面子＋一對子或「四對組」胡牌。'}
              {mode === 64 && '💡 64子：完整兩副象棋。莊家起手 8 張，閒家 7 張。多卡高重合，碰牌快意對決。'}
            </p>
          </div>

          {/* AI Difficulty */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-2 font-serif">
              🤖 對手 AI 難度 (AI Difficulty)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('easy')}
                className={`
                  py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${difficulty === 'easy' 
                    ? 'bg-[#fdfcf0] border-[#d1d5db] text-[#111827] font-black shadow-md' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                輕鬆對戰 (Easy AI)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('hard')}
                className={`
                  py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${difficulty === 'hard' 
                    ? 'bg-[#b91c1c] border-rose-500 text-white font-black shadow-lg shadow-rose-950/40' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                象棋大師 (Hard AI)
              </button>
            </div>
          </div>

          {/* Who is Dealer / Banker */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-2 font-serif">
              👑 起手莊家 (Starting Dealer)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPlayerIsBanker(true)}
                className={`
                  py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${playerIsBanker 
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                我是莊家 (摸 {mode === 32 ? 5 : 8} 張)
              </button>
              <button
                type="button"
                onClick={() => setPlayerIsBanker(false)}
                className={`
                  py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer
                  ${!playerIsBanker 
                    ? 'border-amber-400 text-amber-400 bg-amber-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'}
                `}
              >
                對手起莊 (對手拿 {mode === 32 ? 5 : 8} 張)
              </button>
            </div>
          </div>

        </div>

        {/* Start Game and Rules buttons */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onStartGame({ mode, difficulty, playerIsBanker })}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-450 text-[#064e3b] font-serif font-extrabold text-lg py-3 rounded-xl transition duration-200 shadow-xl shadow-amber-500/15 transform active:scale-95 cursor-pointer"
          >
            開始遊戲 (Play Game)
          </button>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="w-full bg-white/5 hover:bg-white/10 text-white/90 text-sm py-2 rounded-xl transition border border-white/10 cursor-pointer"
          >
            查看規則與台數說明 (Rules)
          </button>
        </div>

        {/* Footer info label */}
        <p className="text-[10px] text-white/30 text-center mt-6">
          象棋麻將單人演練系統 © 2026. Powered by Gemini & Antigravity
        </p>

      </div>

      {/* Rules overlay modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <RuleGuide onClose={() => setShowRules(false)} />
        </div>
      )}
    </div>
  );
};
