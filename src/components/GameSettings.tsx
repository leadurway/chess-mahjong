import React, { useState } from 'react';
import { GameMode, Difficulty } from '../types';
import { RuleGuide } from './RuleGuide';
import liangLogo from '../assets/liang-logo.png';
import { loadPlayerProfile, savePlayerProfile } from '../utils/playerProfile';

interface GameSettingsProps {
  onStartGame: (config: { mode: GameMode; difficulty: Difficulty; playerIsBanker: boolean; playerName: string }) => void;
}

const SELECTED_BTN =
  'bg-yellow-400 border-yellow-200 text-black font-black shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200';
const UNSELECTED_BTN = 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80';

export const GameSettings: React.FC<GameSettingsProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>(56);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playerIsBanker, setPlayerIsBanker] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [profile] = useState(() => loadPlayerProfile());
  const [playerName, setPlayerName] = useState(profile.name);

  const handleNameChange = (value: string) => {
    setPlayerName(value);
    savePlayerProfile({ name: value.trim() || '玩家', score: profile.score });
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-[#064e3b] flex flex-col items-center justify-center px-1 relative overflow-y-auto overflow-x-hidden font-sans"
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

      <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl relative z-10 backdrop-blur-md my-auto">

        {/* Calligraphy logo, title, and Liang Game logo — one row */}
        <div className="grid grid-cols-3 items-center mb-3 shrink-0">
          <div className="justify-self-start inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-amber-400 bg-[#05382a] shadow-xl">
            <span className="text-2xl font-serif font-black text-[#b91c1c] drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">帥</span>
            <span className="text-2xl font-serif font-black text-emerald-200 -ml-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">將</span>
          </div>
          <h1 className="justify-self-center text-2xl font-extrabold text-amber-250 font-serif tracking-widest leading-relaxed">
            象棋麻將
          </h1>
          <img
            src={liangLogo}
            alt="諒 LIANG GAME"
            className="justify-self-end w-14 h-14 rounded-full border-2 border-amber-400 shadow-xl object-cover shrink-0"
          />
        </div>

        {/* Form controls */}
        <div className="space-y-3 shrink-0">

          {/* Player Profile */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <label className="text-base font-bold text-amber-200 block mb-2 font-serif">
              👤 玩家名稱與積分 (Player Profile)
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={12}
              placeholder="輸入你的名稱"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-white/70 text-sm mt-2">
              目前積分：<span className="text-amber-300 font-mono font-bold">{profile.score.toLocaleString()}</span>
            </p>
          </div>

          {/* Mode Selection */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <label className="text-base font-bold text-amber-200 block mb-2 font-serif">
              🥋 棋子數量模式 (Tile Mode)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode(32)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 32 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                32 子 (經典)
                <span className="block text-sm opacity-90 font-normal">單一副象棋</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(56)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 56 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                56 子 (中等)
                <span className="block text-sm opacity-90 font-normal">中位混合版</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(64)}
                className={`py-2 px-1 rounded-xl text-base border transition-all duration-200 cursor-pointer ${mode === 64 ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                64 子 (雙副)
                <span className="block text-sm opacity-90 font-normal">兩副完整棋</span>
              </button>
            </div>
            <p className="text-white/70 text-sm mt-2 leading-snug">
              {mode === 32 && '💡 32子：莊家起手 5 張，閒家 4 張。1組面子＋1個對子或特殊「五兵（卒）」組合即可勝利。'}
              {mode === 56 && '💡 56子：每種牌面各 4 張。莊家起手 8 張，閒家 7 張。兩面子＋一對子或「四對組」胡牌。'}
              {mode === 64 && '💡 64子：完整兩副象棋。莊家起手 8 張，閒家 7 張。多卡高重合，碰牌快意對決。'}
            </p>
          </div>

          {/* AI Difficulty */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <label className="text-base font-bold text-amber-200 block mb-2 font-serif">
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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <label className="text-base font-bold text-amber-200 block mb-2 font-serif">
              👑 起手莊家 (Starting Dealer)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPlayerIsBanker(true)}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer whitespace-nowrap ${playerIsBanker ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                我是莊家 (摸 {mode === 32 ? 5 : 8} 張)
              </button>
              <button
                type="button"
                onClick={() => setPlayerIsBanker(false)}
                className={`py-2 rounded-xl text-base border transition-all duration-200 cursor-pointer whitespace-nowrap ${!playerIsBanker ? SELECTED_BTN : UNSELECTED_BTN}`}
              >
                對手起莊 (對手{mode === 32 ? 5 : 8}張)
              </button>
            </div>
          </div>

        </div>

        {/* Start Game and Rules buttons */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onStartGame({ mode, difficulty, playerIsBanker, playerName: playerName.trim() || '玩家' })}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-serif font-extrabold text-xl py-4 rounded-xl transition duration-200 shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300 transform active:scale-95 cursor-pointer"
          >
            開始遊戲 (Play Game)
          </button>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="w-full bg-white/5 hover:bg-white/10 text-white/95 text-base py-1.5 rounded-xl transition border border-white/10 cursor-pointer"
          >
            查看規則與台數說明 (Rules)
          </button>
        </div>

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
