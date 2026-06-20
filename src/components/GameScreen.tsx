import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, RefreshCw, Volume2, VolumeX, LogOut, Info, ArrowRight, ScrollText, X } from 'lucide-react';
import { Tile, GameMode, Difficulty, Meld, PlayerState, GameState } from '../types';
import { ChessTile } from './ChessTile';
import {
  generateTilePool,
  isWinningHand,
  getEatCombinations,
  getPongCombination,
  getKongCombinations,
  getAIDiscard,
  calculateFans,
  evaluateHand
} from '../utils/gameEngine';
import { RuleGuide } from './RuleGuide';
import { WinModal } from './WinModal';

interface GameScreenProps {
  mode: GameMode;
  difficulty: Difficulty;
  playerIsBanker: boolean;
  onExit: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  mode,
  difficulty,
  playerIsBanker,
  onExit,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showLog, setShowLog] = useState<boolean>(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Core Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    const wall = generateTilePool(mode);
    const playerIsFirst = playerIsBanker;

    const baseDealerCount = mode === 32 ? 5 : 8;
    const baseIdleCount = mode === 32 ? 4 : 7;

    const playerHandCount = playerIsFirst ? baseDealerCount : baseIdleCount;
    const aiHandCount = playerIsFirst ? baseIdleCount : baseDealerCount;

    const playerHand = wall.splice(0, playerHandCount);
    const aiHand = wall.splice(0, aiHandCount);

    return {
      mode,
      difficulty,
      round: 1,
      dealerIndex: playerIsFirst ? 0 : 1,
      wall,
      player: {
        hand: playerHand,
        melds: [],
        discards: [],
        score: 0,
        isBanker: playerIsFirst,
      },
      ai: {
        hand: aiHand,
        melds: [],
        discards: [],
        score: 0,
        isBanker: !playerIsFirst,
      },
      turn: playerIsFirst ? 'player' : 'ai',
      phase: playerIsFirst ? 'waitingDiscard' : 'aiThinking',
      lastDiscard: null,
      lastDiscardSender: null,
      winInfo: null,
      logs: playerIsFirst
        ? [`遊戲開始！玩家起莊領 ${baseDealerCount} 張牌，請打出一張牌。`]
        : [`遊戲開始！對手起莊領 ${baseDealerCount} 張牌，對手思考中...`],
    };
  });

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [pendingEatCombos, setPendingEatCombos] = useState<Tile[][] | null>(null);
  const [showEatSelections, setShowEatSelections] = useState<boolean>(false);

  // Auto-scroll logs when log panel is open
  useEffect(() => {
    if (showLog) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs, showLog]);

  // AI trigger
  useEffect(() => {
    if (gameState.phase === 'aiThinking' && gameState.turn === 'ai') {
      const timer = setTimeout(() => {
        handleAILoops();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.turn]);

  const addLog = (message: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [...prev.logs, message],
    }));
  };

  const playSfx = (type: 'draw' | 'discard' | 'meld' | 'win' | 'lose') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'draw') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'discard') {
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'meld') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start(); osc.stop(ctx.currentTime + 0.8);
      } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.warn('Audio Context play error', e);
    }
  };

  const checkForPlayerInterrupts = (discardedTile: Tile, currentGameState: GameState) => {
    const playerHand = currentGameState.player.hand;
    const playerMelds = currentGameState.player.melds;
    const completeHand = [...playerHand, discardedTile];
    const canWin = isWinningHand(completeHand, playerMelds);
    const canPong = getPongCombination(playerHand, discardedTile) !== null;
    const eatCombos = getEatCombinations(playerHand, discardedTile);
    const canEat = eatCombos.length > 0;
    const canKong = getKongCombinations(playerHand, playerMelds, discardedTile).length > 0;
    return { canWin, canPong, canEat, eatCombos, canKong };
  };

  const handleAILoops = () => {
    const aiHand = [...gameState.ai.hand];
    const aiMelds = gameState.ai.melds;
    const expectedIdleSize = gameState.mode === 32 ? 4 : 7;
    const expectedStartSize = gameState.mode === 32 ? 5 : 8;

    if (aiHand.length === expectedIdleSize) {
      if (gameState.wall.length === 0) { handleDrawGame(); return; }
      const updatedWall = [...gameState.wall];
      const drawnTile = updatedWall.shift()!;
      aiHand.push(drawnTile);
      playSfx('draw');

      if (isWinningHand(aiHand, aiMelds)) {
        triggerWin('ai', drawnTile, true, updatedWall, aiHand);
        return;
      }

      const discarded = getAIDiscard(aiHand);
      const remainingHand = aiHand.filter(t => t.id !== discarded.id);
      playSfx('discard');

      const newGameState: GameState = {
        ...gameState,
        wall: updatedWall,
        ai: { ...gameState.ai, hand: remainingHand, discards: [...gameState.ai.discards, discarded] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: discarded,
        lastDiscardSender: 'ai',
        logs: [...gameState.logs, `對手摸了 1 張牌，打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
      };

      const interrupts = checkForPlayerInterrupts(discarded, newGameState);
      if (interrupts.canWin || interrupts.canPong || interrupts.canEat || interrupts.canKong) {
        newGameState.phase = 'showMeldSelect';
        newGameState.logs.push(`⚠️ 你可以對這張打牌進行吃、碰或胡牌！`);
      } else {
        newGameState.phase = 'drawing';
      }
      setGameState(newGameState);

    } else if (aiHand.length === expectedStartSize) {
      if (isWinningHand(aiHand, aiMelds)) {
        triggerWin('ai', null, true, gameState.wall, aiHand);
        return;
      }
      const discarded = getAIDiscard(aiHand);
      const remainingHand = aiHand.filter(t => t.id !== discarded.id);
      playSfx('discard');

      const newGameState: GameState = {
        ...gameState,
        ai: { ...gameState.ai, hand: remainingHand, discards: [...gameState.ai.discards, discarded] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: discarded,
        lastDiscardSender: 'ai',
        logs: [...gameState.logs, `對手思考結束，打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
      };

      const interrupts = checkForPlayerInterrupts(discarded, newGameState);
      if (interrupts.canWin || interrupts.canPong || interrupts.canEat || interrupts.canKong) {
        newGameState.phase = 'showMeldSelect';
        newGameState.logs.push(`⚠️ 你可以對這張打牌進行吃、碰或胡牌！`);
      } else {
        newGameState.phase = 'drawing';
      }
      setGameState(newGameState);
    }
  };

  const handlePlayerDraw = () => {
    if (gameState.phase !== 'drawing' || gameState.turn !== 'player') return;
    if (gameState.wall.length === 0) { handleDrawGame(); return; }

    const updatedWall = [...gameState.wall];
    const drawnTile = updatedWall.shift()!;
    const updatedHand = [...gameState.player.hand, drawnTile];
    playSfx('draw');

    setGameState(prev => ({
      ...prev,
      wall: updatedWall,
      player: { ...prev.player, hand: updatedHand },
      phase: 'waitingDiscard',
      logs: [...prev.logs, `你摸了一張：${drawnTile.color === 'red' ? '紅' : '黑'}${drawnTile.character}`],
    }));
  };

  const handlePlayerDiscard = (tileToDiscard: Tile) => {
    if (gameState.phase !== 'waitingDiscard' || gameState.turn !== 'player') return;

    const updatedHand = gameState.player.hand.filter(t => t.id !== tileToDiscard.id);
    const updatedDiscards = [...gameState.player.discards, tileToDiscard];
    playSfx('discard');
    setSelectedTileId(null);

    const nextGameState: GameState = {
      ...gameState,
      player: { ...gameState.player, hand: updatedHand, discards: updatedDiscards },
      turn: 'ai',
      phase: 'aiThinking',
      lastDiscard: tileToDiscard,
      lastDiscardSender: 'player',
      logs: [...gameState.logs, `你打出了 ${tileToDiscard.color === 'red' ? '紅' : '黑'}${tileToDiscard.character}`],
    };

    const aiCompleteHand = [...nextGameState.ai.hand, tileToDiscard];
    const aiCanWin = isWinningHand(aiCompleteHand, nextGameState.ai.melds);
    if (aiCanWin) { triggerWin('ai', tileToDiscard, false, nextGameState.wall, aiCompleteHand); return; }

    const aiPongCombo = getPongCombination(nextGameState.ai.hand, tileToDiscard);
    const aiEatCombos = getEatCombinations(nextGameState.ai.hand, tileToDiscard);
    let aiMelded = false;

    if (aiPongCombo && (gameState.difficulty === 'hard' || Math.random() > 0.3)) {
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !aiPongCombo.some(p => p.id === t.id));
      const newMeld: Meld = { type: 'pong', tiles: [...aiPongCombo, tileToDiscard], discardSource: 'player' };
      nextGameState.ai.hand = aiUpdatedHand;
      nextGameState.ai.melds = [...nextGameState.ai.melds, newMeld];
      nextGameState.turn = 'ai';
      nextGameState.phase = 'aiThinking';
      nextGameState.lastDiscard = null;
      nextGameState.logs.push(`😲 對手喊「碰！」並展示了 [${tileToDiscard.character}${tileToDiscard.character}${tileToDiscard.character}]`);
      playSfx('meld');
      aiMelded = true;
    } else if (aiEatCombos.length > 0 && (gameState.difficulty === 'hard' || Math.random() > 0.4)) {
      const selectedCombo = aiEatCombos[0];
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !selectedCombo.some(p => p.id === t.id));
      const newMeld: Meld = { type: 'chow', tiles: [...selectedCombo, tileToDiscard], discardSource: 'player' };
      nextGameState.ai.hand = aiUpdatedHand;
      nextGameState.ai.melds = [...nextGameState.ai.melds, newMeld];
      nextGameState.turn = 'ai';
      nextGameState.phase = 'aiThinking';
      nextGameState.lastDiscard = null;
      const charStr = newMeld.tiles.map(t => t.character).join('');
      nextGameState.logs.push(`😲 對手喊「吃！」並展示了 [${charStr}]`);
      playSfx('meld');
      aiMelded = true;
    }

    if (!aiMelded) nextGameState.phase = 'aiThinking';
    setGameState(nextGameState);
  };

  const handleDrawGame = () => {
    setGameState(prev => ({
      ...prev,
      phase: 'gameOver',
      logs: [...prev.logs, '🏁 牌牆已抽光！本局平手結尾 (流局)。'],
      winInfo: {
        winner: null, winningTile: null, isSelfDraw: false,
        fans: [], totalFans: 0,
        handSnapshot: prev.player.hand,
        meldsSnapshot: prev.player.melds,
      }
    }));
  };

  const handlePlayerPass = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;
    addLog('你選擇了跳過 (過)。');
    setGameState(prev => ({ ...prev, phase: 'drawing' }));
  };

  const handlePlayerPong = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;
    const d = gameState.lastDiscard;
    const combo = getPongCombination(gameState.player.hand, d);
    if (!combo) return;
    playSfx('meld');

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !combo.some(c => c.id === t.id));
      const newMeld: Meld = { type: 'pong', tiles: [...combo, d], discardSource: 'ai' };
      return {
        ...prev,
        player: { ...prev.player, hand: updatedHand, melds: [...prev.player.melds, newMeld] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「碰！」，展示 [${d.character}${d.character}${d.character}] 刻組！`],
      };
    });
  };

  const handlePlayerEat = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;
    const d = gameState.lastDiscard;
    const combos = getEatCombinations(gameState.player.hand, d);
    if (combos.length === 0) return;
    if (combos.length === 1) { executeEat(combos[0]); }
    else { setPendingEatCombos(combos); setShowEatSelections(true); }
  };

  const executeEat = (selectedCombo: Tile[]) => {
    const d = gameState.lastDiscard;
    if (!d) return;
    playSfx('meld');
    setShowEatSelections(false);
    setPendingEatCombos(null);

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !selectedCombo.some(c => c.id === t.id));
      const newMeld: Meld = { type: 'chow', tiles: [...selectedCombo, d], discardSource: 'ai' };
      const charString = newMeld.tiles.map(t => t.character).join('');
      return {
        ...prev,
        player: { ...prev.player, hand: updatedHand, melds: [...prev.player.melds, newMeld] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「吃！」，展示 [${charString}] 順組！`],
      };
    });
  };

  const handlePlayerKong = () => {
    if (!gameState.lastDiscard) return;
    const d = gameState.lastDiscard;
    const combos = getKongCombinations(gameState.player.hand, gameState.player.melds, d);
    if (combos.length === 0) return;
    const match = combos[0];
    playSfx('meld');

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !match.some(c => c.id === t.id && c.id !== d.id));
      const newMeld: Meld = { type: 'kong', tiles: match, discardSource: 'ai' };
      const updatedWall = [...prev.wall];
      const replacementTile = updatedWall.pop();
      const finalHand = replacementTile ? [...updatedHand, replacementTile] : updatedHand;
      const logs = [...prev.logs, `你喊了「槓！」，亮出 [${d.character}${d.character}${d.character}${d.character}]！`];
      if (replacementTile) logs.push(`💡 補牌：${replacementTile.color === 'red' ? '紅' : '黑'}${replacementTile.character}`);
      return {
        ...prev,
        wall: updatedWall,
        player: { ...prev.player, hand: finalHand, melds: [...prev.player.melds, newMeld] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs,
      };
    });
  };

  const handlePlayerDeclareWin = () => {
    const playerHand = gameState.player.hand;
    const playerMelds = gameState.player.melds;
    const targetWinSize = gameState.mode === 32 ? 5 : 8;
    const targetIdleSize = gameState.mode === 32 ? 4 : 7;

    if (playerHand.length === targetWinSize) {
      if (isWinningHand(playerHand, playerMelds)) {
        const winningTile = gameState.lastDiscardSender === 'player' ? null : playerHand[playerHand.length - 1];
        triggerWin('player', winningTile, true, gameState.wall, playerHand);
      } else {
        addLog('⚠️ 提示：你目前的手牌尚未形成胡牌聽牌組合喔！');
      }
    } else if (playerHand.length === targetIdleSize && gameState.lastDiscard && gameState.phase === 'showMeldSelect') {
      const completeHand = [...playerHand, gameState.lastDiscard];
      if (isWinningHand(completeHand, playerMelds)) {
        triggerWin('player', gameState.lastDiscard, false, gameState.wall, completeHand);
      } else {
        addLog('⚠️ 提示：不能胡這張牌喔！');
      }
    }
  };

  const triggerWin = (
    winner: 'player' | 'ai',
    winningTile: Tile | null,
    isSelfDraw: boolean,
    updatedWall: Tile[],
    finalConcealedHand: Tile[]
  ) => {
    const isPlayer = winner === 'player';
    playSfx(isPlayer ? 'win' : 'lose');
    const winnerState = isPlayer ? gameState.player : gameState.ai;
    const isFirstMove = gameState.player.discards.length === 0 && gameState.ai.discards.length === 0;
    const fansCalculated = calculateFans(finalConcealedHand, winnerState.melds, isSelfDraw, isFirstMove, winner);
    const totalFans = fansCalculated.reduce((sum, f) => sum + f.value, 0);

    setGameState(prev => ({
      ...prev,
      wall: updatedWall,
      phase: 'gameOver',
      logs: [...prev.logs, `🎉 ${isPlayer ? '玩家' : '對手 AI'} 宣告胡牌 (${isSelfDraw ? '自摸' : '榮胡'})！共 ${totalFans} 台！`],
      winInfo: { winner, winningTile, isSelfDraw, fans: fansCalculated, totalFans, handSnapshot: finalConcealedHand, meldsSnapshot: winnerState.melds },
    }));
  };

  const handleReplay = () => {
    const wall = generateTilePool(mode);
    const playerIsFirst = playerIsBanker;
    const baseDealerCount = mode === 32 ? 5 : 8;
    const baseIdleCount = mode === 32 ? 4 : 7;
    const playerHandCount = playerIsFirst ? baseDealerCount : baseIdleCount;
    const aiHandCount = playerIsFirst ? baseIdleCount : baseDealerCount;
    const playerHand = wall.splice(0, playerHandCount);
    const aiHand = wall.splice(0, aiHandCount);

    setGameState({
      mode, difficulty,
      round: gameState.round + 1,
      dealerIndex: playerIsFirst ? 0 : 1,
      wall,
      player: { hand: playerHand, melds: [], discards: [], score: 0, isBanker: playerIsFirst },
      ai: { hand: aiHand, melds: [], discards: [], score: 0, isBanker: !playerIsFirst },
      turn: playerIsFirst ? 'player' : 'ai',
      phase: playerIsFirst ? 'waitingDiscard' : 'aiThinking',
      lastDiscard: null, lastDiscardSender: null, winInfo: null,
      logs: playerIsFirst
        ? [`--- 第 ${gameState.round + 1} 局 ---`, `玩家起莊領 ${baseDealerCount} 張牌，請打出一張牌。`]
        : [`--- 第 ${gameState.round + 1} 局 ---`, `對手起莊領 ${baseDealerCount} 張牌，對手思考中...`],
    });
    setSelectedTileId(null);
    setShowLog(false);
  };

  const interrupts = gameState.lastDiscard && gameState.lastDiscardSender === 'ai'
    ? checkForPlayerInterrupts(gameState.lastDiscard, gameState)
    : { canWin: false, canPong: false, canEat: false, canKong: false };

  const expectedWinSize = gameState.mode === 32 ? 5 : 8;
  const isSelfDrawWinAvailable = gameState.player.hand.length === expectedWinSize &&
    isWinningHand(gameState.player.hand, gameState.player.melds);

  const lastLog = gameState.logs[gameState.logs.length - 1] ?? '';

  return (
    <div className="h-[100dvh] flex flex-col bg-[#064e3b] text-white overflow-hidden font-sans antialiased">

      {/* ── HEADER ── */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2 bg-black/30 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onExit}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition shrink-0"
          >
            <LogOut size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base font-extrabold font-serif text-amber-200 leading-none">象棋麻將</span>
              <span className="bg-amber-500 text-[#064e3b] text-[9px] font-black px-1.5 py-0.5 rounded leading-none shrink-0">
                {gameState.mode}子
              </span>
              <span className="text-[9px] text-white/40 font-mono">R{gameState.round}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right mr-1 border-r border-white/10 pr-2">
            <span className="text-[9px] text-white/40 block leading-none">剩餘</span>
            <span className="text-xl font-black text-amber-400 font-mono leading-none">{gameState.wall.length}</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition"
          >
            <BookOpen size={15} className="text-amber-200" />
          </button>
        </div>
      </header>

      {/* ── AI SECTION ── */}
      <div className="shrink-0 px-3 pt-2 pb-1">
        {/* AI info row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-600 border border-white/50 flex items-center justify-center text-[10px] font-bold shrink-0">
              AI
            </div>
            <div>
              <span className="text-xs font-bold font-serif leading-none block">大師</span>
              <span className="text-[9px] text-amber-300 capitalize">{gameState.difficulty}</span>
            </div>
          </div>
          {/* AI exposed melds */}
          {gameState.ai.melds.length > 0 && (
            <div className="flex gap-1 overflow-x-auto max-w-[60%]">
              {gameState.ai.melds.map((meld, mIdx) => (
                <div key={`ai_m_${mIdx}`} className="flex gap-0.5 bg-black/40 p-1 rounded-lg border border-white/10 relative shrink-0">
                  <span className="absolute -top-1.5 bg-amber-500 text-stone-950 text-[7px] font-black px-1 rounded shadow-sm">
                    {meld.type === 'chow' ? '吃' : meld.type === 'pong' ? '碰' : '槓'}
                  </span>
                  {meld.tiles.map((t, tIdx) => (
                    <ChessTile key={`ai_mt_${mIdx}_${tIdx}`} tile={t} size="sm" />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* AI face-down hand */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 bg-[#054131]/60 py-2 px-3 rounded-xl border border-emerald-500/20 w-fit min-w-full">
            {gameState.ai.hand.map((tile, index) => (
              <ChessTile
                key={`ai_h_${index}`}
                tile={tile}
                isFaceDown={gameState.phase !== 'gameOver'}
                size="sm"
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── DISCARD COURT ── */}
      <div className="flex-1 grid grid-cols-2 gap-2 px-3 py-1 overflow-hidden min-h-0">
        {/* AI discards */}
        <div className="bg-[#054333]/70 rounded-xl p-2 border border-emerald-500/15 flex flex-col overflow-hidden">
          <div className="text-[9px] text-emerald-200 font-serif font-bold border-b border-emerald-500/10 pb-1 mb-1 shrink-0">
            🤖 對手打牌
          </div>
          <div className="flex flex-wrap gap-1 content-start overflow-y-auto flex-1 min-h-0">
            {gameState.ai.discards.map((tile, index) => {
              const isLatest = gameState.lastDiscardSender === 'ai' && gameState.lastDiscard?.id === tile.id;
              return (
                <div key={`ai_d_${index}`} className="relative">
                  <ChessTile tile={tile} size="sm" />
                  {isLatest && <div className="absolute inset-0 rounded-lg ring-2 ring-amber-400 animate-pulse pointer-events-none" />}
                </div>
              );
            })}
          </div>
        </div>
        {/* Player discards */}
        <div className="bg-[#054333]/70 rounded-xl p-2 border border-emerald-500/15 flex flex-col overflow-hidden">
          <div className="text-[9px] text-emerald-200 font-serif font-bold border-b border-emerald-500/10 pb-1 mb-1 shrink-0">
            👤 我的打牌
          </div>
          <div className="flex flex-wrap gap-1 content-start overflow-y-auto flex-1 min-h-0">
            {gameState.player.discards.map((tile, index) => {
              const isLatest = gameState.lastDiscardSender === 'player' && gameState.lastDiscard?.id === tile.id;
              return (
                <div key={`player_d_${index}`} className="relative">
                  <ChessTile tile={tile} size="sm" />
                  {isLatest && <div className="absolute inset-0 rounded-lg ring-2 ring-red-400 animate-pulse pointer-events-none" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="shrink-0 px-3 py-1.5">
        <div className="bg-black/40 rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10">
          <div className="text-[11px] font-serif flex-1 min-w-0">
            {gameState.turn === 'player' && gameState.phase === 'drawing' && (
              <span className="text-amber-400 animate-pulse">👉 請點選「摸牌」</span>
            )}
            {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && (
              <span className="text-stone-300">👉 點選手牌打出（雙擊直接打）</span>
            )}
            {gameState.phase === 'showMeldSelect' && (
              <span className="text-orange-400 font-bold">⚠️ 可吃碰槓或宣胡！</span>
            )}
            {gameState.phase === 'aiThinking' && (
              <span className="text-stone-500">⏳ 對手思考中...</span>
            )}
            {gameState.phase === 'gameOver' && (
              <span className="text-stone-400">🏁 本局結束</span>
            )}
          </div>
          <button
            onClick={() => setShowLog(true)}
            className="flex items-center gap-1 text-[10px] text-amber-300 bg-black/30 px-2 py-1 rounded-lg border border-white/10 shrink-0"
          >
            <ScrollText size={11} />
            局誌
          </button>
        </div>
      </div>

      {/* ── PLAYER MELDS (only shown if any) ── */}
      {gameState.player.melds.length > 0 && (
        <div className="shrink-0 px-3 pb-1">
          <div className="flex items-center gap-2 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10">
            <span className="text-[9px] text-emerald-200 font-bold font-serif shrink-0">我的牌組：</span>
            <div className="flex gap-2 overflow-x-auto">
              {gameState.player.melds.map((meld, mIdx) => (
                <div key={`meld_${mIdx}`} className="flex gap-0.5 bg-black/40 p-1 rounded-lg border border-white/5 relative shrink-0">
                  <span className="absolute -top-1.5 bg-amber-500 text-stone-950 text-[7px] font-black px-1 rounded shadow-sm">
                    {meld.type === 'chow' ? '吃' : meld.type === 'pong' ? '碰' : '槓'}
                  </span>
                  {meld.tiles.map((t, tIdx) => (
                    <ChessTile key={`mt_${mIdx}_${tIdx}`} tile={t} size="sm" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYER HAND ── */}
      <div className="shrink-0 px-3 pb-1">
        <div className="overflow-x-auto">
          <div className="flex gap-2 py-3 px-3 bg-[#054131]/60 rounded-xl border-b-2 border-emerald-500/30 w-fit min-w-full justify-center">
            {gameState.player.hand.map((tile) => {
              const isSelected = selectedTileId === tile.id;
              const canClick = gameState.phase === 'waitingDiscard' && gameState.turn === 'player';
              return (
                <ChessTile
                  key={tile.id}
                  tile={tile}
                  isSelected={isSelected}
                  isClickable={canClick}
                  onClick={() => {
                    if (!canClick) return;
                    if (isSelected) handlePlayerDiscard(tile);
                    else setSelectedTileId(tile.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="shrink-0 px-3 pb-4">
        <div className="flex flex-wrap gap-2 justify-center">
          <AnimatePresence>

            {gameState.phase === 'showMeldSelect' && interrupts.canEat && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                onClick={handlePlayerEat}
                className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold font-serif text-sm px-5 py-3 rounded-xl transition shadow-lg shadow-sky-900/30"
              >
                吃牌
              </motion.button>
            )}

            {gameState.phase === 'showMeldSelect' && interrupts.canPong && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                onClick={handlePlayerPong}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold font-serif text-sm px-5 py-3 rounded-xl transition shadow-lg shadow-emerald-900/30"
              >
                碰牌
              </motion.button>
            )}

            {gameState.phase === 'showMeldSelect' && interrupts.canKong && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                onClick={handlePlayerKong}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold font-serif text-sm px-5 py-3 rounded-xl transition"
              >
                槓牌
              </motion.button>
            )}

            {((gameState.phase === 'showMeldSelect' && interrupts.canWin) || isSelfDrawWinAvailable) && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={handlePlayerDeclareWin}
                className="bg-gradient-to-r from-red-600 to-amber-600 animate-pulse active:scale-95 text-white font-bold font-serif text-sm px-6 py-3 rounded-xl shadow-xl shadow-red-900/40"
              >
                🔥 胡 牌！
              </motion.button>
            )}

            {gameState.phase === 'showMeldSelect' && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                onClick={handlePlayerPass}
                className="bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 font-bold font-serif text-sm px-5 py-3 rounded-xl transition border border-stone-700"
              >
                過
              </motion.button>
            )}

            {gameState.turn === 'player' && gameState.phase === 'drawing' && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={handlePlayerDraw}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold font-serif text-sm px-6 py-3 rounded-xl transition shadow-lg shadow-amber-900/30 flex items-center gap-2"
              >
                🀄 摸牌
              </motion.button>
            )}

            {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && selectedTileId && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={() => {
                  const tile = gameState.player.hand.find(t => t.id === selectedTileId);
                  if (tile) handlePlayerDiscard(tile);
                }}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold font-serif text-sm px-6 py-3 rounded-xl transition shadow-lg"
              >
                打牌
              </motion.button>
            )}

            {gameState.phase === 'gameOver' && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={handleReplay}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-serif font-bold text-sm py-3 px-6 rounded-xl transition flex items-center gap-2 shadow-lg"
              >
                <RefreshCw size={14} />
                再來一局
              </motion.button>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── GAME LOG BOTTOM SHEET ── */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowLog(false)} />
            {/* Sheet */}
            <motion.div
              className="relative bg-stone-900 rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col"
              style={{ maxHeight: '65dvh' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
                <h2 className="font-bold font-serif text-amber-400 flex items-center gap-2">
                  <ScrollText size={16} />
                  即時局誌
                </h2>
                <button onClick={() => setShowLog(false)} className="p-1.5 text-stone-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {gameState.logs.map((log, index) => {
                  const isAlert = log.includes('🚨') || log.includes('⚠️');
                  const isWin = log.includes('胡牌');
                  return (
                    <div
                      key={`log_${index}`}
                      className={`px-3 py-2 rounded-xl border text-xs leading-relaxed ${
                        isWin
                          ? 'bg-amber-950/40 border-amber-800/40 text-amber-300 font-bold'
                          : isAlert
                            ? 'bg-red-950/20 border-red-900/30 text-rose-300'
                            : 'bg-stone-800/60 border-stone-700/50 text-stone-300'
                      }`}
                    >
                      <div className="text-[9px] text-stone-500 mb-0.5 font-mono">#{index + 1}</div>
                      {log}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
              <div className="px-4 pt-2 pb-5 shrink-0 border-t border-stone-800">
                <div className="bg-stone-950 px-3 py-2 rounded-xl border border-stone-800 text-[10px] text-stone-400 flex items-center gap-2">
                  <Info size={11} className="text-amber-500 shrink-0" />
                  牌牆剩 0 張時，本局以流局結算。
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EAT COMBO SELECTION MODAL ── */}
      {showEatSelections && pendingEatCombos && (
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50 p-0 backdrop-blur-sm">
          <div className="bg-stone-900 border border-amber-500/20 rounded-t-3xl p-6 w-full shadow-2xl">
            <h3 className="text-base font-bold font-serif text-amber-400 mb-1 text-center">選擇吃牌組合</h3>
            <p className="text-stone-400 text-[11px] mb-4 text-center">有多組匹配方案，請選一組：</p>
            <div className="space-y-2.5 mb-4">
              {pendingEatCombos.map((combo, idx) => {
                const combined = [...combo, gameState.lastDiscard!];
                return (
                  <button
                    key={`eat_c_${idx}`}
                    onClick={() => executeEat(combo)}
                    className="w-full bg-stone-800 hover:bg-stone-750 border border-stone-700 active:scale-95 p-3 rounded-xl flex items-center justify-between transition"
                  >
                    <div className="flex gap-1.5">
                      {combined.map((t, cIdx) => (
                        <ChessTile key={`ec_${idx}_${cIdx}`} tile={t} size="sm" />
                      ))}
                    </div>
                    <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-0.5">
                      選此組 <ArrowRight size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowEatSelections(false); setPendingEatCombos(null); }}
              className="w-full text-stone-400 hover:text-stone-200 text-sm py-2"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── RULES MODAL ── */}
      {showRules && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <RuleGuide onClose={() => setShowRules(false)} />
        </div>
      )}

      {/* ── WIN/LOSE MODAL ── */}
      {gameState.phase === 'gameOver' && gameState.winInfo && gameState.winInfo.winner && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <WinModal
            winner={gameState.winInfo.winner}
            winningTile={gameState.winInfo.winningTile}
            isSelfDraw={gameState.winInfo.isSelfDraw}
            fans={gameState.winInfo.fans}
            totalFans={gameState.winInfo.totalFans}
            handSnapshot={gameState.winInfo.handSnapshot}
            meldsSnapshot={gameState.winInfo.meldsSnapshot}
            onRestart={handleReplay}
            onGoToMenu={onExit}
          />
        </div>
      )}

      {/* ── DRAW GAME MODAL ── */}
      {gameState.phase === 'gameOver' && gameState.winInfo && !gameState.winInfo.winner && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-0">
          <div className="bg-stone-900 border-t border-stone-700 rounded-t-3xl p-8 w-full shadow-2xl text-center">
            <span className="text-4xl">🏁</span>
            <h2 className="text-xl font-serif font-bold text-stone-300 mt-3 mb-1">流局結算</h2>
            <p className="text-stone-500 text-xs mb-6">底牌已摸光，雙方均未胡牌。</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleReplay} className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-stone-950 font-serif font-bold py-3 rounded-xl">
                再來一局
              </button>
              <button onClick={onExit} className="bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 font-semibold py-3 rounded-xl border border-stone-700">
                返回選單
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
