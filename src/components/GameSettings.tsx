import React, { useState } from 'react';
import { GameMode, Difficulty } from '../types';
import { RuleGuide } from './RuleGuide';
import liangLogo from '../assets/liang-logo.png';

interface GameSettingsProps {
  onStartGame: (config: { mode: GameMode; difficulty: Difficulty; playerIsBanker: boolean }) => void;
}

const SELECTED_BTN =
  'bg-yellow-400 border-yellow-200 text-black font-black shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200';
const UNSELECTED_BTN = 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80';

export const GameSettings: React.FC<GameSettingsProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>(32);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playerIsBanker, setPlayerIsBanker] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);

  return (
    <div
      className="h-[100dvh] w-full bg-[#064e3b] flex flex-col items-center justify-center px-1 relative overflow-hidden font-sans"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Decorative background grids */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Wooden style circle backdrop ornament */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-emerald-500/10 pointer-events-none rotate-12 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full border-4 border-dashed border-emerald-500/5"></div>
      </div>

      <div className="w-full h-full max-h-full flex flex-col justify-center bg-black/40 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl relative z-10 backdrop-blur-md overflow-hidden">

        {/* Calligraphy logo and title */}
        <div className="text-center mb-3 shrink-0">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-amber-400 bg-[#05382a] shadow-xl mb-2">
            <span className="text-2xl font-serif font-black text-[#b91c1c] drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">帥</span>
            <span className="text-2xl font-serif font-black text-emerald-200 -ml-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">將</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold text-amber-250 font-serif tracking-widest leading-relaxed">
              象棋麻將
            </h1>
            <img
              src={liangLogo}
              alt="諒 LIANG GAME"
              className="w-8 h-8 rounded-full border border-amber-400/50 shadow-md object-cover shrink-0"
            />
          </div>
          <p className="text-white/60 text-[11px] mt-0.5 font-mono tracking-wider">
            CHINESE CHESS MAHJONG SIMULATOR
          </p>
        </div>

        {/* Form controls */}
        <div className="space-y-3 shrink-0">

          {/* Mode Selection */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-1.5 font-serif">
              🥋 棋子數量模式 (Tile Mode)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode(32)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 32 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                32 子 (經典)
                <span className="block text-xs opacity-80 font-normal">單一副象棋</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(56)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 56 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                56 子 (中等)
                <span className="block text-xs opacity-80 font-normal">中位混合版</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(64)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 64 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                64 子 (雙副)
                <span className="block text-xs opacity-80 font-normal">兩副完整棋</span>
              </button>
            </div>
            <p className="text-white/40 text-[11px] mt-1.5 leading-snug">
              {mode === 32 && '💡 32子：莊家起手 5 張，閒家 4 張。1組面子＋1個對子或特殊「五兵（卒）」組合即可勝利。'}
              {mode === 56 && '💡 56子：每種牌面各 4 張。莊家起手 8 張，閒家 7 張。兩面子＋一對子或「四對組」胡牌。'}
              {mode === 64 && '💡 64子：完整兩副象棋。莊家起手 8 張，閒家 7 張。多卡高重合，碰牌快意對決。'}
            </p>
          </div>

          {/* AI Difficulty */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-1.5 font-serif">
              🤖 對手 AI 難度 (AI Difficulty)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('easy')}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer ${difficulty === 'easy' ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                輕鬆對戰 (Easy AI)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('hard')}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer ${difficulty === 'hard' ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                象棋大師 (Hard AI)
              </button>
            </div>
          </div>

          {/* Who is Dealer / Banker */}
          <div>
            <label className="text-sm font-bold text-amber-200 block mb-1.5 font-serif">
              👑 起手莊家 (Starting Dealer)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPlayerIsBanker(true)}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer ${playerIsBanker ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                我是莊家 (摸 {mode === 32 ? 5 : 8} 張)
              </button>
              <button
                type="button"
                onClick={() => setPlayerIsBanker(false)}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer ${!playerIsBanker ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                對手起莊 (對手拿 {mode === 32 ? 5 : 8} 張)
              </button>
            </div>
          </div>

        </div>

        {/* Start Game and Rules buttons */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onStartGame({ mode, difficulty, playerIsBanker })}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-serif font-extrabold text-lg py-3 rounded-xl transition duration-200 shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300 transform active:scale-95 cursor-pointer"
          >
            開始遊戲 (Play Game)
          </button>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="w-full bg-white/5 hover:bg-white/10 text-white/90 text-sm py-1.5 rounded-xl transition border border-white/10 cursor-pointer"
          >
            查看規則與台數說明 (Rules)
          </button>
        </div>

        {/* Footer info label */}
        <p className="text-[10px] text-white/30 text-center mt-2 shrink-0">
          象棋麻將單人演練系統 © 2026
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
