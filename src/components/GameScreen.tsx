import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Volume2, VolumeX, LogOut, Info, ArrowRight, ScrollText, X } from 'lucide-react';
import { Tile, GameMode, Difficulty, Meld, PlayerState, GameState } from '../types';
import { ChessTile } from './ChessTile';
import {
  generateTilePool,
  isWinningHand,
  getEatCombinations,
  getPongCombination,
  getKongCombinations,
  getSelfKongOptions,
  getAIDiscard,
  calculateFans,
  evaluateHand
} from '../utils/gameEngine';
import { RuleGuide } from './RuleGuide';
import { WinModal } from './WinModal';
import liangLogo from '../assets/liang-logo.png';

interface GameScreenProps {
  mode: GameMode;
  difficulty: Difficulty;
  playerIsBanker: boolean;
  onExit: () => void;
}

// Within an exposed meld, the tile that came from elsewhere (a claimed discard, or the tile that
// completed a kong) is always appended last by construction — see handlePlayerPong/executeEat/
// handlePlayerKong/handlePlayerSelfKong and their AI equivalents below. Display wants that tile
// centered, flanked by the tiles that were already in the concealed hand.
function getMeldDisplayTiles(meld: Meld): { tile: Tile; isTrigger: boolean }[] {
  const tiles = meld.tiles;
  const trigger = tiles[tiles.length - 1];
  const others = tiles.slice(0, tiles.length - 1);
  const ordered = others.length === 2
    ? [others[0], trigger, others[1]]
    : [others[0], trigger, others[1], others[2]];
  return ordered.map(t => ({ tile: t, isTrigger: t.id === trigger.id }));
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
      dealerStreak: 1,
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

    // AI just claimed a pong/chow off the player's discard — it already holds
    // the extra tile, so it must discard directly without drawing first.
    if (gameState.aiDiscardOnly) {
      const discarded = getAIDiscard(aiHand);
      const remainingHand = aiHand.filter(t => t.id !== discarded.id);
      playSfx('discard');

      const newGameState: GameState = {
        ...gameState,
        aiDiscardOnly: false,
        ai: { ...gameState.ai, hand: remainingHand, discards: [...gameState.ai.discards, discarded] },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: discarded,
        lastDiscardSender: 'ai',
        logs: [...gameState.logs, `對手組牌完成，打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
      };

      const interrupts = checkForPlayerInterrupts(discarded, newGameState);
      if (interrupts.canWin || interrupts.canPong || interrupts.canEat || interrupts.canKong) {
        newGameState.phase = 'showMeldSelect';
        newGameState.logs.push(`⚠️ 你可以對這張打牌進行吃、碰或胡牌！`);
      } else {
        newGameState.phase = 'drawing';
      }
      setGameState(newGameState);
      return;
    }

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

      // AI self-kong (暗槓/補槓) opportunity right after drawing.
      const aiSelfKongOptions = getSelfKongOptions(aiHand, aiMelds);
      if (aiSelfKongOptions.length > 0 && (gameState.difficulty === 'hard' || Math.random() > 0.5)) {
        const option = aiSelfKongOptions[0];
        const replacementTile = updatedWall.pop();
        const handAfterKong = aiHand.filter(t => !option.tiles.some(c => c.id === t.id));
        const finalAiHand = replacementTile ? [...handAfterKong, replacementTile] : handAfterKong;
        const aiMeldsAfterKong = option.isUpgrade
          ? aiMelds.map((m, idx) => idx === option.upgradeMeldIndex ? { ...m, type: 'kong' as const, tiles: option.tiles } : m)
          : [...aiMelds, { type: 'kong' as const, tiles: option.tiles, discardSource: 'self' as const }];
        const kongLabel = option.isUpgrade ? '補槓' : '暗槓';
        playSfx('meld');

        // The replacement tile can complete the hand outright (kong-then-self-draw win).
        if (isWinningHand(finalAiHand, aiMeldsAfterKong)) {
          triggerWin('ai', replacementTile ?? null, true, updatedWall, finalAiHand);
          return;
        }

        const discarded = getAIDiscard(finalAiHand);
        const remainingHand = finalAiHand.filter(t => t.id !== discarded.id);
        playSfx('discard');

        const kongGameState: GameState = {
          ...gameState,
          wall: updatedWall,
          ai: { ...gameState.ai, hand: remainingHand, melds: aiMeldsAfterKong, discards: [...gameState.ai.discards, discarded] },
          turn: 'player',
          phase: 'waitingDiscard',
          lastDiscard: discarded,
          lastDiscardSender: 'ai',
          logs: [...gameState.logs, `😲 對手喊「${kongLabel}！」，亮出 [${option.tiles.map(t => t.character).join('')}]，並打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
        };
        const kongInterrupts = checkForPlayerInterrupts(discarded, kongGameState);
        if (kongInterrupts.canWin || kongInterrupts.canPong || kongInterrupts.canEat || kongInterrupts.canKong) {
          kongGameState.phase = 'showMeldSelect';
          kongGameState.logs.push(`⚠️ 你可以對這張打牌進行吃、碰或胡牌！`);
        } else {
          kongGameState.phase = 'drawing';
        }
        setGameState(kongGameState);
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
      nextGameState.aiDiscardOnly = true;
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
      nextGameState.aiDiscardOnly = true;
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

  const handlePlayerSelfKong = () => {
    if (gameState.phase !== 'waitingDiscard' || gameState.turn !== 'player') return;
    const options = getSelfKongOptions(gameState.player.hand, gameState.player.melds);
    if (options.length === 0) return;
    const option = options[0];
    playSfx('meld');

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !option.tiles.some(c => c.id === t.id));
      const updatedMelds = option.isUpgrade
        ? prev.player.melds.map((m, idx) => idx === option.upgradeMeldIndex ? { ...m, type: 'kong' as const, tiles: option.tiles } : m)
        : [...prev.player.melds, { type: 'kong' as const, tiles: option.tiles, discardSource: 'self' as const }];

      const updatedWall = [...prev.wall];
      const replacementTile = updatedWall.pop();
      const finalHand = replacementTile ? [...updatedHand, replacementTile] : updatedHand;

      const kongLabel = option.isUpgrade ? '補槓' : '暗槓';
      const logs = [...prev.logs, `你喊了「${kongLabel}！」，亮出 [${option.tiles.map(t => t.character).join('')}]！`];
      if (replacementTile) logs.push(`💡 補牌：${replacementTile.color === 'red' ? '紅' : '黑'}${replacementTile.character}`);

      return {
        ...prev,
        wall: updatedWall,
        player: { ...prev.player, hand: finalHand, melds: updatedMelds },
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
    const fansCalculated = calculateFans(finalConcealedHand, winnerState.melds, isSelfDraw, isFirstMove, winnerState.isBanker);
    const totalFans = fansCalculated.reduce((sum, f) => sum + f.value, 0);

    setGameState(prev => ({
      ...prev,
      wall: updatedWall,
      phase: 'gameOver',
      player: { ...prev.player, score: prev.player.score + (isPlayer ? totalFans : -totalFans) },
      ai: { ...prev.ai, score: prev.ai.score + (isPlayer ? -totalFans : totalFans) },
      logs: [...prev.logs, `🎉 ${isPlayer ? '玩家' : '對手 AI'} 宣告胡牌 (${isSelfDraw ? '自摸' : '榮胡'})！共 ${totalFans} 台！`],
      winInfo: { winner, winningTile, isSelfDraw, fans: fansCalculated, totalFans, handSnapshot: finalConcealedHand, meldsSnapshot: winnerState.melds },
    }));
  };

  const handleReplay = () => {
    // Dealer continuation (連莊): the dealer keeps the seat on a win or a draw;
    // if the idle side wins, the deal passes to them.
    const previousWinner = gameState.winInfo?.winner ?? null;
    const prevPlayerIsBanker = gameState.player.isBanker;
    const playerIsFirst = previousWinner === null ? prevPlayerIsBanker : previousWinner === 'player';
    const dealerStreak = playerIsFirst === prevPlayerIsBanker ? gameState.dealerStreak + 1 : 1;

    const wall = generateTilePool(mode);
    const baseDealerCount = mode === 32 ? 5 : 8;
    const baseIdleCount = mode === 32 ? 4 : 7;
    const playerHandCount = playerIsFirst ? baseDealerCount : baseIdleCount;
    const aiHandCount = playerIsFirst ? baseIdleCount : baseDealerCount;
    const playerHand = wall.splice(0, playerHandCount);
    const aiHand = wall.splice(0, aiHandCount);

    const dealerNote = dealerStreak > 1 ? `連莊第 ${dealerStreak} 局` : '起莊';

    setGameState({
      mode, difficulty,
      round: gameState.round + 1,
      dealerIndex: playerIsFirst ? 0 : 1,
      dealerStreak,
      wall,
      player: { hand: playerHand, melds: [], discards: [], score: gameState.player.score, isBanker: playerIsFirst },
      ai: { hand: aiHand, melds: [], discards: [], score: gameState.ai.score, isBanker: !playerIsFirst },
      turn: playerIsFirst ? 'player' : 'ai',
      phase: playerIsFirst ? 'waitingDiscard' : 'aiThinking',
      lastDiscard: null, lastDiscardSender: null, winInfo: null,
      logs: playerIsFirst
        ? [`--- 第 ${gameState.round + 1} 局 ---`, `玩家${dealerNote}領 ${baseDealerCount} 張牌，請打出一張牌。`]
        : [`--- 第 ${gameState.round + 1} 局 ---`, `對手${dealerNote}領 ${baseDealerCount} 張牌，對手思考中...`],
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

  const selfKongOptions = gameState.turn === 'player' && gameState.phase === 'waitingDiscard'
    ? getSelfKongOptions(gameState.player.hand, gameState.player.melds)
    : [];

  const canDraw = gameState.turn === 'player' && gameState.phase === 'drawing';
  const canDiscard = gameState.turn === 'player' && gameState.phase === 'waitingDiscard';
  const showActionPopup = gameState.phase === 'showMeldSelect' || selfKongOptions.length > 0 || isSelfDrawWinAvailable;

  const renderMeldRow = (melds: Meld[], keyPrefix: string) => (
    <div className="flex gap-2 overflow-x-auto mt-2 pt-2 border-t border-white/10">
      {melds.map((meld, mIdx) => (
        <div key={`${keyPrefix}_m_${mIdx}`} className="flex gap-1 shrink-0 relative pt-2">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 text-[8px] font-black px-1 rounded shadow-sm z-10">
            {meld.type === 'chow' ? '吃' : meld.type === 'pong' ? '碰' : '槓'}
          </span>
          {getMeldDisplayTiles(meld).map(({ tile, isTrigger }, tIdx) => (
            <ChessTile
              key={`${keyPrefix}_mt_${mIdx}_${tIdx}`}
              tile={tile}
              size="sm"
              glow={meld.type === 'kong' && isTrigger ? 'red' : 'green'}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#064e3b] text-white overflow-hidden font-sans antialiased">

      {/* ── HEADER ── */}
      <header
        className="shrink-0 grid grid-cols-3 items-center px-2 py-2 bg-black/30 border-b border-white/10"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-1.5 justify-self-start">
          <button
            onClick={onExit}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <LogOut size={18} className="rotate-180" />
          </button>
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

        <img
          src={liangLogo}
          alt="諒 LIANG GAME"
          className="w-9 h-9 rounded-full border border-amber-400/50 shadow-md object-cover justify-self-center"
        />

        <div className="flex items-center gap-1.5 justify-self-end">
          <span className="text-sm font-extrabold font-serif text-amber-200 leading-none">象棋麻將</span>
          <span className="bg-amber-500 text-[#064e3b] text-sm font-black px-1.5 py-0.5 rounded leading-none">
            {gameState.mode}子
          </span>
        </div>
      </header>

      {/* ── ZONE A: AI INFO ── */}
      <div className="shrink-0 w-full px-3 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-600 border border-white/50 flex items-center justify-center text-xs font-bold shrink-0">
            AI
          </div>
          <div>
            <span className="text-sm font-bold font-serif leading-none block">大師</span>
            <span className="text-xs text-amber-300 capitalize leading-none">{gameState.difficulty}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {gameState.ai.isBanker && (
            <span className="text-xs text-amber-300 font-mono">
              👑坐莊{gameState.dealerStreak > 1 ? `×${gameState.dealerStreak}` : ''}
            </span>
          )}
          <span className={`text-base font-black font-mono ${gameState.ai.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {gameState.ai.score >= 0 ? '+' : ''}{gameState.ai.score}
          </span>
        </div>
      </div>

      {/* ── ZONE B: AI HAND + MELDS ── */}
      <div className="shrink-0 w-full px-2 py-2 bg-[#054131]/40 border-b border-emerald-500/10">
        <div className="grid grid-cols-8 gap-1">
          {gameState.ai.hand.map((tile, index) => (
            <ChessTile key={`ai_h_${index}`} tile={tile} fill isFaceDown />
          ))}
        </div>
        {gameState.ai.melds.length > 0 && renderMeldRow(gameState.ai.melds, 'ai')}
      </div>

      {/* ── ZONE C: AI DISCARDS ── */}
      <div className="flex-1 min-h-0 w-full px-2 py-1.5 bg-[#054333]/50 border-b border-emerald-500/10 overflow-y-auto">
        <div className="flex flex-wrap gap-1 content-start">
          {gameState.ai.discards.map((tile, index) => {
            const isLatest = gameState.lastDiscardSender === 'ai' && gameState.lastDiscard?.id === tile.id;
            return (
              <div key={`ai_d_${index}`} className="relative">
                <ChessTile tile={tile} size="xs" />
                {isLatest && <div className="absolute inset-0 rounded-full ring-2 ring-amber-400 animate-pulse pointer-events-none" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ZONE D: PLAYER DISCARDS ── */}
      <div className="flex-1 min-h-0 w-full px-2 py-1.5 bg-[#054333]/50 border-b border-emerald-500/10 overflow-y-auto">
        <div className="flex flex-wrap gap-1 content-start">
          {gameState.player.discards.map((tile, index) => {
            const isLatest = gameState.lastDiscardSender === 'player' && gameState.lastDiscard?.id === tile.id;
            return (
              <div key={`player_d_${index}`} className="relative">
                <ChessTile tile={tile} size="xs" />
                {isLatest && <div className="absolute inset-0 rounded-full ring-2 ring-red-400 animate-pulse pointer-events-none" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ZONE E: PLAYER HAND + MELDS ── */}
      <div className="shrink-0 w-full px-2 py-2 bg-[#054131]/40 border-b border-emerald-500/10">
        <div className="grid grid-cols-8 gap-1">
          {gameState.player.hand.map((tile) => {
            const isSelected = selectedTileId === tile.id;
            const canClick = gameState.phase === 'waitingDiscard' && gameState.turn === 'player';
            return (
              <ChessTile
                key={tile.id}
                tile={tile}
                fill
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
        {gameState.player.melds.length > 0 && renderMeldRow(gameState.player.melds, 'player')}
      </div>

      {/* ── ZONE F: PLAYER INFO ── */}
      <div className="shrink-0 w-full px-3 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 border border-white/50 flex items-center justify-center text-xs font-bold text-[#064e3b] shrink-0">
            你
          </div>
          <span className="text-sm font-bold font-serif leading-none">玩家</span>
        </div>
        <div className="flex items-center gap-3">
          {gameState.player.isBanker && (
            <span className="text-xs text-amber-300 font-mono">
              👑坐莊{gameState.dealerStreak > 1 ? `×${gameState.dealerStreak}` : ''}
            </span>
          )}
          <span className={`text-base font-black font-mono ${gameState.player.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {gameState.player.score >= 0 ? '+' : ''}{gameState.player.score}
          </span>
        </div>
      </div>

      {/* ── FOOTER: POPUP MENU + FIXED ACTIONS + HINT ── */}
      <div className="relative shrink-0">
        <AnimatePresence>
          {showActionPopup && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="absolute bottom-full left-0 right-0 mb-1.5 mx-2 bg-stone-900/95 backdrop-blur border border-amber-500/30 rounded-2xl p-2.5 shadow-2xl z-30"
            >
              <div className="flex flex-wrap gap-2 justify-center">
                {gameState.phase === 'showMeldSelect' && interrupts.canEat && (
                  <button
                    onClick={handlePlayerEat}
                    className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold font-serif text-base px-5 py-2.5 rounded-xl transition"
                  >
                    吃牌
                  </button>
                )}
                {gameState.phase === 'showMeldSelect' && interrupts.canPong && (
                  <button
                    onClick={handlePlayerPong}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold font-serif text-base px-5 py-2.5 rounded-xl transition"
                  >
                    碰牌
                  </button>
                )}
                {gameState.phase === 'showMeldSelect' && interrupts.canKong && (
                  <button
                    onClick={handlePlayerKong}
                    className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold font-serif text-base px-5 py-2.5 rounded-xl transition"
                  >
                    槓牌
                  </button>
                )}
                {selfKongOptions.length > 0 && (
                  <button
                    onClick={handlePlayerSelfKong}
                    className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold font-serif text-base px-5 py-2.5 rounded-xl transition"
                  >
                    {selfKongOptions[0].isUpgrade ? '補槓' : '暗槓'}
                  </button>
                )}
                {((gameState.phase === 'showMeldSelect' && interrupts.canWin) || isSelfDrawWinAvailable) && (
                  <button
                    onClick={handlePlayerDeclareWin}
                    className="bg-gradient-to-r from-red-600 to-amber-600 animate-pulse active:scale-95 text-white font-bold font-serif text-base px-6 py-2.5 rounded-xl shadow-xl shadow-red-900/40"
                  >
                    🔥 胡 牌！
                  </button>
                )}
                {gameState.phase === 'showMeldSelect' && (
                  <button
                    onClick={handlePlayerPass}
                    className="bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 font-bold font-serif text-base px-5 py-2.5 rounded-xl transition border border-stone-700"
                  >
                    過
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two fixed action buttons: 摸牌 / 打出這張牌 */}
        <div className="px-3 pt-2 flex gap-2">
          <motion.button
            disabled={!canDraw}
            onClick={handlePlayerDraw}
            animate={canDraw ? { y: [0, -6, 0] } : { y: 0 }}
            transition={canDraw ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
            className={`flex-1 h-16 rounded-2xl font-bold font-serif text-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
              canDraw
                ? 'bg-red-600 text-white shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300'
                : 'bg-stone-800/60 text-stone-500'
            }`}
          >
            <span>🀄 摸牌</span>
            <span className="text-xs font-mono font-normal opacity-80">剩 {gameState.wall.length} 張</span>
          </motion.button>

          <motion.button
            disabled={!canDiscard}
            onClick={() => {
              const tile = gameState.player.hand.find(t => t.id === selectedTileId);
              if (tile) handlePlayerDiscard(tile);
              else if (canDiscard) addLog('⚠️ 請先點選一張要打出的手牌。');
            }}
            animate={canDiscard ? { y: [0, -6, 0] } : { y: 0 }}
            transition={canDiscard ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
            className={`flex-1 h-16 rounded-2xl font-bold font-serif text-lg transition-colors flex items-center justify-center ${
              canDiscard
                ? 'bg-red-600 text-white shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300'
                : 'bg-stone-800/60 text-stone-500'
            }`}
          >
            👉 打出這張牌
          </motion.button>
        </div>

        {/* Hint row (bottom-most) */}
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex-1 text-sm font-serif min-w-0">
            {gameState.turn === 'player' && gameState.phase === 'drawing' && (
              <span className="text-amber-400 animate-pulse">👉 請按「摸牌」</span>
            )}
            {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && (
              <span className="text-stone-300">👉 點選手牌後按「打出這張牌」</span>
            )}
            {gameState.phase === 'showMeldSelect' && (
              <span className="text-orange-400 font-bold">⚠️ 可吃碰槓或宣胡，請從上方選單操作！</span>
            )}
            {gameState.phase === 'aiThinking' && (
              <span className="text-stone-400">⏳ 對手思考中...</span>
            )}
            {gameState.phase === 'gameOver' && (
              <span className="text-stone-400">🏁 本局結束</span>
            )}
          </div>
          <button
            onClick={() => setShowLog(true)}
            className="flex items-center gap-1 text-xs text-amber-300 bg-black/30 px-2 py-1 rounded-lg border border-white/10 shrink-0"
          >
            <ScrollText size={12} />
            局誌
          </button>
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
            playerScore={gameState.player.score}
            aiScore={gameState.ai.score}
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
