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
  getAIDiscardAdvanced,
  shouldTakeMeld,
  computeHandProgressScore,
  calculateFans,
  evaluateHand,
  sortHandForDisplay,
  getMeldDisplayTiles
} from '../utils/gameEngine';
import { RuleGuide } from './RuleGuide';
import { WinModal } from './WinModal';
import liangLogo from '../assets/liang-logo.png';
import { loadPlayerProfile, savePlayerProfile, calculatePayout, STARTING_SCORE } from '../utils/playerProfile';
import { useIsLandscape, useIsLargeScreen } from '../hooks/useResponsive';

interface GameScreenProps {
  mode: GameMode;
  difficulty: Difficulty;
  playerIsBanker: boolean;
  playerName: string;
  onExit: () => void;
}

// getMeldDisplayTiles now lives in gameEngine.ts (shared with WinModal.tsx for a consistent
// meld display). See handlePlayerPong/executeEat/handlePlayerKong/handlePlayerSelfKong and
// their AI equivalents below for how the "trigger" tile (last in meld.tiles) gets there.

// A winning hand structurally needs exactly 1 meld (32-tile mode) or 2 melds (56/64-tile
// mode) plus the eye. Nothing previously stopped a player/AI from pong/eat/kong-ing PAST
// that cap — once they did, expectedIdleSize/expectedStartSize/targetWinSize (all derived
// from `meldsCount * 3`) go negative and can never match a real hand length again, which
// permanently stalls handleAILoops (if it happens to the AI) or permanently hides the human
// player's win-declare button (if it happens to them). Pong/chow/a brand-new kong all add a
// meld and must respect this cap; upgrading an existing pong into a kong (補槓) does not
// change the meld count, so it's exempt.
function maxMeldsForMode(mode: GameMode): number {
  return mode === 32 ? 1 : 2;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  mode,
  difficulty,
  playerIsBanker,
  playerName,
  onExit,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [confirmExit, setConfirmExit] = useState<boolean>(false);
  const isLandscape = useIsLandscape();
  const isLargeScreen = useIsLargeScreen();
  const logEndRef = useRef<HTMLDivElement>(null);
  const confirmExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExitClick = () => {
    if (confirmExit) {
      if (confirmExitTimerRef.current) clearTimeout(confirmExitTimerRef.current);
      onExit();
      return;
    }
    setConfirmExit(true);
    confirmExitTimerRef.current = setTimeout(() => setConfirmExit(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (confirmExitTimerRef.current) clearTimeout(confirmExitTimerRef.current);
    };
  }, []);

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
    const startingScore = loadPlayerProfile().score;

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
        score: startingScore,
        isBanker: playerIsFirst,
      },
      ai: {
        hand: aiHand,
        melds: [],
        discards: [],
        score: STARTING_SCORE,
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
  // Self-kong / self-draw-win popups (offered on the player's own turn, not via
  // showMeldSelect) don't have a game-state phase to "pass" back into — they're just an
  // optional offer alongside the otherwise-normal waitingDiscard turn. This tracks whether
  // the player dismissed that offer with 過, and resets whenever a new tile is drawn so the
  // next opportunity (if any) is offered fresh.
  const [ownTurnOfferDismissed, setOwnTurnOfferDismissed] = useState<boolean>(false);

  // Auto-scroll logs when log panel is open
  useEffect(() => {
    if (showLog) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs, showLog]);

  // Persist the player's running score (chip stack) so it carries over between sessions.
  useEffect(() => {
    savePlayerProfile({ name: playerName, score: gameState.player.score });
  }, [playerName, gameState.player.score]);

  useEffect(() => {
    setOwnTurnOfferDismissed(false);
  }, [gameState.player.pendingDrawnTileId]);

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
    // Pong/eat/kong-from-discard would all form a brand-new meld — only offer them while
    // still under the mode's meld cap, and only offer kong if a replacement tile actually
    // exists to draw (see maxMeldsForMode above for why both guards matter).
    const canFormNewMeld = playerMelds.length < maxMeldsForMode(currentGameState.mode);
    const canPong = canFormNewMeld && getPongCombination(playerHand, discardedTile) !== null;
    const eatCombos = canFormNewMeld ? getEatCombinations(playerHand, discardedTile) : [];
    const canEat = eatCombos.length > 0;
    const canKong = canFormNewMeld && currentGameState.wall.length > 0 &&
      getKongCombinations(playerHand, playerMelds, discardedTile).length > 0;
    return { canWin, canPong, canEat, eatCombos, canKong };
  };

  // Easy AI keeps its original flat-heuristic discard (getAIDiscard) untouched; Hard AI
  // ("大師") uses the shanten-style evaluator, which also steers away from tiles the
  // opponent has already shown (via their exposed melds) that they collect.
  const chooseAIDiscard = (hand: Tile[], meldsCount: number): Tile => {
    return gameState.difficulty === 'hard'
      ? getAIDiscardAdvanced(hand, meldsCount, gameState.mode, gameState.player.melds)
      : getAIDiscard(hand);
  };

  const handleAILoops = () => {
    const aiHand = [...gameState.ai.hand];
    const aiMelds = gameState.ai.melds;
    // Each exposed meld (pong/chow/kong all count as one "slot") shrinks the concealed
    // hand by 3 relative to the full target — melding doesn't change the total structural
    // count, it just moves 3 tiles from concealed into an exposed meld on the table.
    const targetTotal = gameState.mode === 32 ? 5 : 8;
    const expectedIdleSize = targetTotal - 1 - aiMelds.length * 3;
    const expectedStartSize = targetTotal - aiMelds.length * 3;

    // AI just claimed a pong/chow off the player's discard — it already holds
    // the extra tile, so it must discard directly without drawing first.
    if (gameState.aiDiscardOnly) {
      const discarded = chooseAIDiscard(aiHand, aiMelds.length);
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

      // AI self-kong (暗槓/補槓) opportunity right after drawing. A brand-new concealed kong
      // (not an upgrade) adds a meld, so it must respect the mode's meld cap; either way, a
      // kong always needs a replacement tile, so it's only offered while the wall still has
      // one to give — otherwise chooseAIDiscard below would end up discarding from a hand
      // that's permanently 1 tile short, desyncing expectedIdleSize/expectedStartSize for the
      // rest of the round and stalling handleAILoops entirely (see maxMeldsForMode).
      const aiSelfKongOptions = getSelfKongOptions(aiHand, aiMelds)
        .filter(opt => opt.isUpgrade || aiMelds.length < maxMeldsForMode(gameState.mode));
      if (aiSelfKongOptions.length > 0 && updatedWall.length > 0 && (gameState.difficulty === 'hard' || Math.random() > 0.5)) {
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

        const discarded = chooseAIDiscard(finalAiHand, aiMeldsAfterKong.length);
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

      const discarded = chooseAIDiscard(aiHand, aiMelds.length);
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
      const discarded = chooseAIDiscard(aiHand, aiMelds.length);
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
      player: { ...prev.player, hand: updatedHand, pendingDrawnTileId: drawnTile.id },
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
      player: { ...gameState.player, hand: updatedHand, discards: updatedDiscards, pendingDrawnTileId: null },
      turn: 'ai',
      phase: 'aiThinking',
      lastDiscard: tileToDiscard,
      lastDiscardSender: 'player',
      logs: [...gameState.logs, `你打出了 ${tileToDiscard.color === 'red' ? '紅' : '黑'}${tileToDiscard.character}`],
    };

    const aiCompleteHand = [...nextGameState.ai.hand, tileToDiscard];
    const aiCanWin = isWinningHand(aiCompleteHand, nextGameState.ai.melds);
    if (aiCanWin) {
      // Commit the post-discard player hand first — triggerWin reads the discarder's hand off
      // the live state (via its own setGameState(prev => ...)), so without this it would still
      // see the stale pre-discard hand and show the just-discarded winning tile twice (once in
      // the loser's revealed hand, once pinned in the winner's).
      setGameState(nextGameState);
      triggerWin('ai', tileToDiscard, false, nextGameState.wall, aiCompleteHand);
      return;
    }

    const aiMeldsCountBefore = nextGameState.ai.melds.length;
    // Pong/eat here would each form a brand-new meld for the AI — only consider them while
    // still under the mode's meld cap (see maxMeldsForMode for why exceeding it is dangerous).
    const aiCanFormNewMeld = aiMeldsCountBefore < maxMeldsForMode(gameState.mode);
    const aiPongCombo = aiCanFormNewMeld ? getPongCombination(nextGameState.ai.hand, tileToDiscard) : null;
    const aiEatCombos = aiCanFormNewMeld ? getEatCombinations(nextGameState.ai.hand, tileToDiscard) : [];
    let aiMelded = false;

    const wantsPong = aiPongCombo && (
      gameState.difficulty === 'hard'
        ? shouldTakeMeld(
            nextGameState.ai.hand,
            aiMeldsCountBefore,
            nextGameState.ai.hand.filter(t => !aiPongCombo.some(p => p.id === t.id)),
            aiMeldsCountBefore + 1,
            gameState.mode
          )
        : Math.random() > 0.3
    );

    // Hard AI picks whichever chow combo leaves its hand in the best shape, rather than
    // always taking the first option the way Easy does.
    const bestEatCombo = gameState.difficulty === 'hard' && aiEatCombos.length > 0
      ? aiEatCombos.reduce((best, combo) => {
          const bestAfter = nextGameState.ai.hand.filter(t => !best.some(p => p.id === t.id));
          const comboAfter = nextGameState.ai.hand.filter(t => !combo.some(p => p.id === t.id));
          const bestScore = computeHandProgressScore(bestAfter, aiMeldsCountBefore + 1, gameState.mode);
          const comboScore = computeHandProgressScore(comboAfter, aiMeldsCountBefore + 1, gameState.mode);
          return comboScore > bestScore ? combo : best;
        })
      : aiEatCombos[0];

    const wantsEat = aiEatCombos.length > 0 && (
      gameState.difficulty === 'hard'
        ? shouldTakeMeld(
            nextGameState.ai.hand,
            aiMeldsCountBefore,
            nextGameState.ai.hand.filter(t => !bestEatCombo.some(p => p.id === t.id)),
            aiMeldsCountBefore + 1,
            gameState.mode
          )
        : Math.random() > 0.4
    );

    if (wantsPong) {
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !aiPongCombo!.some(p => p.id === t.id));
      const newMeld: Meld = { type: 'pong', tiles: [...aiPongCombo!, tileToDiscard], discardSource: 'player' };
      nextGameState.ai.hand = aiUpdatedHand;
      nextGameState.ai.melds = [...nextGameState.ai.melds, newMeld];
      nextGameState.turn = 'ai';
      nextGameState.phase = 'aiThinking';
      nextGameState.aiDiscardOnly = true;
      nextGameState.lastDiscard = null;
      nextGameState.logs.push(`😲 對手喊「碰！」並展示了 [${tileToDiscard.character}${tileToDiscard.character}${tileToDiscard.character}]`);
      playSfx('meld');
      aiMelded = true;
    } else if (wantsEat) {
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !bestEatCombo.some(p => p.id === t.id));
      const newMeld: Meld = { type: 'chow', tiles: [...bestEatCombo, tileToDiscard], discardSource: 'player' };
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
        playerConcealedTiles: prev.player.hand,
        aiConcealedTiles: prev.ai.hand,
        playerMelds: prev.player.melds,
        aiMelds: prev.ai.melds,
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
    if (gameState.player.melds.length >= maxMeldsForMode(gameState.mode)) return;
    const d = gameState.lastDiscard;
    const combo = getPongCombination(gameState.player.hand, d);
    if (!combo) return;
    playSfx('meld');

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !combo.some(c => c.id === t.id));
      const newMeld: Meld = { type: 'pong', tiles: [...combo, d], discardSource: 'ai' };
      return {
        ...prev,
        player: { ...prev.player, hand: updatedHand, melds: [...prev.player.melds, newMeld], pendingDrawnTileId: null },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「碰！」，展示 [${d.character}${d.character}${d.character}] 刻組！`],
      };
    });
  };

  const handlePlayerEat = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;
    if (gameState.player.melds.length >= maxMeldsForMode(gameState.mode)) return;
    const d = gameState.lastDiscard;
    const combos = getEatCombinations(gameState.player.hand, d);
    if (combos.length === 0) return;
    if (combos.length === 1) { executeEat(combos[0]); }
    else { setPendingEatCombos(combos); setShowEatSelections(true); }
  };

  const executeEat = (selectedCombo: Tile[]) => {
    const d = gameState.lastDiscard;
    if (!d) return;
    if (gameState.player.melds.length >= maxMeldsForMode(gameState.mode)) return;
    playSfx('meld');
    setShowEatSelections(false);
    setPendingEatCombos(null);

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !selectedCombo.some(c => c.id === t.id));
      const newMeld: Meld = { type: 'chow', tiles: [...selectedCombo, d], discardSource: 'ai' };
      const charString = newMeld.tiles.map(t => t.character).join('');
      return {
        ...prev,
        player: { ...prev.player, hand: updatedHand, melds: [...prev.player.melds, newMeld], pendingDrawnTileId: null },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「吃！」，展示 [${charString}] 順組！`],
      };
    });
  };

  const handlePlayerKong = () => {
    if (!gameState.lastDiscard) return;
    if (gameState.player.melds.length >= maxMeldsForMode(gameState.mode)) return;
    if (gameState.wall.length === 0) return;
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
        player: { ...prev.player, hand: finalHand, melds: [...prev.player.melds, newMeld], pendingDrawnTileId: replacementTile?.id ?? null },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs,
      };
    });
  };

  const handlePlayerSelfKong = () => {
    if (gameState.phase !== 'waitingDiscard' || gameState.turn !== 'player') return;
    if (gameState.wall.length === 0) return;
    const options = getSelfKongOptions(gameState.player.hand, gameState.player.melds)
      .filter(opt => opt.isUpgrade || gameState.player.melds.length < maxMeldsForMode(gameState.mode));
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
        player: { ...prev.player, hand: finalHand, melds: updatedMelds, pendingDrawnTileId: replacementTile?.id ?? null },
        logs,
      };
    });
  };

  const handlePlayerDeclareWin = () => {
    const playerHand = gameState.player.hand;
    const playerMelds = gameState.player.melds;
    // Each exposed meld shrinks the concealed hand by 3 relative to the full target.
    const targetTotal = gameState.mode === 32 ? 5 : 8;
    const targetWinSize = targetTotal - playerMelds.length * 3;
    const targetIdleSize = targetWinSize - 1;

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
    // 天胡/地胡 both require the WINNER to still be on their very first turn (never having
    // discarded). Requiring BOTH sides to have zero discards is wrong for 地胡 specifically:
    // by the time the idle side gets their first draw, the dealer has necessarily already
    // made their opening discard, so that stricter check could never be true and 地胡 could
    // never actually fire. Each side's own discard count is what matters.
    const isFirstMove = winnerState.discards.length === 0;
    const fansCalculated = calculateFans(finalConcealedHand, winnerState.melds, isSelfDraw, isFirstMove, winnerState.isBanker);
    const totalFans = fansCalculated.reduce((sum, f) => sum + f.value, 0);
    const payout = calculatePayout(totalFans);
    const winnerMelds = winnerState.melds;

    setGameState(prev => {
      const loserConcealedHand = isPlayer ? prev.ai.hand : prev.player.hand;
      const loserMelds = isPlayer ? prev.ai.melds : prev.player.melds;
      return {
        ...prev,
        wall: updatedWall,
        phase: 'gameOver',
        player: { ...prev.player, score: prev.player.score + (isPlayer ? payout : -payout) },
        ai: { ...prev.ai, score: prev.ai.score + (isPlayer ? -payout : payout) },
        logs: [...prev.logs, `🎉 ${isPlayer ? '玩家' : '對手 AI'} 宣告胡牌 (${isSelfDraw ? '自摸' : '榮胡'})！共 ${totalFans} 台，${isPlayer ? '贏' : '輸'} ${payout} 分！`],
        winInfo: {
          winner, winningTile, isSelfDraw, fans: fansCalculated, totalFans,
          handSnapshot: finalConcealedHand, meldsSnapshot: winnerState.melds,
          playerConcealedTiles: isPlayer ? finalConcealedHand : loserConcealedHand,
          aiConcealedTiles: isPlayer ? loserConcealedHand : finalConcealedHand,
          playerMelds: isPlayer ? winnerMelds : loserMelds,
          aiMelds: isPlayer ? loserMelds : winnerMelds,
        },
      };
    });
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

  const expectedWinSize = (gameState.mode === 32 ? 5 : 8) - gameState.player.melds.length * 3;
  const isSelfDrawWinAvailable = gameState.player.hand.length === expectedWinSize &&
    isWinningHand(gameState.player.hand, gameState.player.melds);

  const selfKongOptions = gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && gameState.wall.length > 0
    ? getSelfKongOptions(gameState.player.hand, gameState.player.melds)
        .filter(opt => opt.isUpgrade || gameState.player.melds.length < maxMeldsForMode(gameState.mode))
    : [];

  const canDraw = gameState.turn === 'player' && gameState.phase === 'drawing';
  const canDiscard = gameState.turn === 'player' && gameState.phase === 'waitingDiscard';
  const showOwnTurnOffer = !ownTurnOfferDismissed && (selfKongOptions.length > 0 || isSelfDrawWinAvailable);
  const showActionPopup = gameState.phase === 'showMeldSelect' || showOwnTurnOffer;

  // Hand display order: sorted by role (將士象車馬包／帥仕相車馬炮／兵卒), except the most
  // recently drawn tile, which stays pinned at the far right until it's discarded.
  const pendingDrawnTile = gameState.player.pendingDrawnTileId
    ? gameState.player.hand.find(t => t.id === gameState.player.pendingDrawnTileId) ?? null
    : null;
  const restOfPlayerHand = pendingDrawnTile
    ? gameState.player.hand.filter(t => t.id !== pendingDrawnTile.id)
    : gameState.player.hand;
  const playerHandForDisplay = pendingDrawnTile
    ? [...sortHandForDisplay(restOfPlayerHand), pendingDrawnTile]
    : sortHandForDisplay(restOfPlayerHand);

  // iPad/desktop have enough room that nothing needs to shrink: hand, melds, and discards all
  // use the same doubled tile size, in both orientations. handGapClass must track HAND_GAP_PX
  // below (gap-1 = 4px, gap-2 = 8px) since handRowWidthPx's slot-frame math assumes whichever
  // gap is actually rendered.
  const handSize = isLargeScreen ? 'handLg' : 'hand';
  const handGapClass = isLargeScreen ? 'gap-2' : 'gap-1';

  // General UI scaling for iPad/desktop — driven by the same isLargeScreen signal as the hand/
  // meld/discard sizing above (not raw Tailwind md:/lg: breakpoints), because those are width-
  // only: a phone in landscape can be wider than the md breakpoint despite still being a phone,
  // and would wrongly get the "large screen" treatment if this used width alone.
  const bigBtnClass = isLargeScreen ? 'h-24 text-3xl' : 'h-16 text-xl';
  const headerIconSize = isLargeScreen ? 30 : 15;
  const avatarSizeClass = isLargeScreen ? 'w-14 h-14' : 'w-8 h-8';
  const avatarTextClass = isLargeScreen ? 'text-xl' : 'text-xs';
  const nameTextClass = isLargeScreen ? 'text-2xl' : 'text-sm';
  const scoreTextClass = isLargeScreen ? 'text-3xl' : 'text-base';
  const bankerTextClass = isLargeScreen ? 'text-xl' : 'text-xs';
  const hintTextClass = isLargeScreen ? 'text-2xl' : 'text-base';
  const logoSizeClass = isLargeScreen ? 'w-16 h-16' : 'w-9 h-9';

  const renderMeldGroup = (meld: Meld, keyPrefix: string, mIdx: number) => (
    <div key={`${keyPrefix}_m_${mIdx}`} className={`flex ${handGapClass} shrink-0`}>
      {getMeldDisplayTiles(meld).map(({ tile, isTrigger, isFaceDown }, tIdx) => (
        <ChessTile
          key={`${keyPrefix}_mt_${mIdx}_${tIdx}`}
          tile={tile}
          size={handSize}
          isFaceDown={isFaceDown}
          glow={meld.type === 'kong' && isTrigger ? 'red' : 'blue'}
        />
      ))}
    </div>
  );

  // Fixed-width slot frame for the hand+meld row: sized for the dealer's opening hand count
  // (5 for 32-tile, 8 for 56/64-tile — the maximum concealed+exposed tile count in play at
  // once), so the frame itself never resizes; a newly drawn tile just fills the next empty
  // slot on the right instead of the whole row re-centering.
  const HAND_TILE_PX = isLargeScreen ? 88 : 44;
  const HAND_GAP_PX = isLargeScreen ? 8 : 4;
  const handSlotCount = gameState.mode === 32 ? 5 : 8;
  const handRowWidthPx = handSlotCount * HAND_TILE_PX + (handSlotCount - 1) * HAND_GAP_PX;

  // Discards mirror the hand's look. On phones: full "hand" size in both portrait AND
  // landscape now (landscape used to shrink to half size — no longer, so discards read as
  // clearly as the hand does). On iPad/desktop, discards use the same doubled hand tile size,
  // and the discard AREA's height is a fixed value sized to exactly fit a target row count (3
  // in portrait, 2 in landscape/desktop) — rather than a flex-1 area stretched to fill
  // whatever's left of a much-taller viewport, which used to leave a large empty gap under
  // the first row or two of actual discards. Any real leftover space on very tall/wide large
  // screens instead collects as a neutral gap between the two discard piles (see the spacer
  // between the AI/player discard blocks below) — like table space.
  const discardTileSize = isLargeScreen ? handSize : 'hand';
  // Phone landscape specifically (not iPad landscape) — used both for the discard rows below
  // (single non-wrapping row, scrolled horizontally, since screen height is too tight in
  // landscape to spare for more than one) and for the merged info/hand/score row further down
  // (shifted inward and padded clear of the camera housing/notch, which sits left or right in
  // this orientation).
  const isPhoneLandscape = isLandscape && !isLargeScreen;
  const discardMinHeightClass = 'min-h-14'; // phones only — single "hand"-size tile row now in both orientations
  const discardRowsTarget = isLargeScreen ? (isLandscape ? 2 : 3) : null;
  const DISCARD_AREA_PADDING_PX = 12; // py-1.5 (6px top + 6px bottom)
  const discardAreaFixedHeightPx = discardRowsTarget
    ? discardRowsTarget * HAND_TILE_PX + (discardRowsTarget - 1) * HAND_GAP_PX + DISCARD_AREA_PADDING_PX
    : null;

  // Portrait discards line up in a grid at the hand tile size.
  const discardGridWidthPx = 8 * HAND_TILE_PX + 7 * HAND_GAP_PX;
  // iPad portrait: rather than a fixed 8-per-row grid (matching the hand row's width), let
  // CSS grid auto-fill as many tiles as the actual available width allows at the tile size,
  // so each of the 3 rows packs the maximum tile count instead of being capped at 8. Phone
  // portrait keeps the original fixed 8-per-row layout.
  const portraitAutoFillDiscards = isLargeScreen && !isLandscape;

  const aiAvatarName = (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`${avatarSizeClass} rounded-full bg-red-600 border border-white/50 flex items-center justify-center ${avatarTextClass} font-bold shrink-0`}>
        AI
      </div>
      <span className={`${nameTextClass} font-bold font-serif leading-none whitespace-nowrap`}>
        電腦 <span className="text-amber-300 capitalize">{gameState.difficulty}</span>
      </span>
    </div>
  );

  const aiBankerScore = (
    <div className="flex items-center gap-3 shrink-0">
      {gameState.ai.isBanker && (
        <span className={`${bankerTextClass} text-amber-300 font-mono whitespace-nowrap`}>
          👑坐莊{gameState.dealerStreak > 1 ? `×${gameState.dealerStreak}` : ''}
        </span>
      )}
      <span className={`${scoreTextClass} font-black font-mono whitespace-nowrap ${gameState.ai.score >= STARTING_SCORE ? 'text-emerald-400' : 'text-rose-400'}`}>
        {gameState.ai.score.toLocaleString()}
      </span>
    </div>
  );

  const aiHandMeldFrame = (
    <div className={`flex ${handGapClass} items-center shrink-0`} style={{ width: `${handRowWidthPx}px` }}>
      {[...gameState.ai.melds].reverse().map((meld, idx) =>
        renderMeldGroup(meld, 'ai', gameState.ai.melds.length - 1 - idx)
      )}
      {gameState.ai.hand.map((tile, index) => (
        <ChessTile key={`ai_h_${index}`} tile={tile} size={handSize} isFaceDown />
      ))}
    </div>
  );

  const playerAvatarName = (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`${avatarSizeClass} rounded-full bg-amber-500 border border-white/50 flex items-center justify-center ${avatarTextClass} font-bold text-[#064e3b] shrink-0`}>
        你
      </div>
      <span className={`${nameTextClass} font-bold font-serif leading-none whitespace-nowrap`}>{playerName}</span>
    </div>
  );

  const playerBankerScore = (
    <div className="flex items-center gap-3 shrink-0">
      {gameState.player.isBanker && (
        <span className={`${bankerTextClass} text-amber-300 font-mono whitespace-nowrap`}>
          👑坐莊{gameState.dealerStreak > 1 ? `×${gameState.dealerStreak}` : ''}
        </span>
      )}
      <span className={`${scoreTextClass} font-black font-mono whitespace-nowrap ${gameState.player.score >= STARTING_SCORE ? 'text-emerald-400' : 'text-rose-400'}`}>
        {gameState.player.score.toLocaleString()}
      </span>
    </div>
  );

  const playerHandMeldFrame = (
    <div className={`flex ${handGapClass} items-center shrink-0`} style={{ width: `${handRowWidthPx}px` }}>
      {[...gameState.player.melds].reverse().map((meld, idx) =>
        renderMeldGroup(meld, 'player', gameState.player.melds.length - 1 - idx)
      )}
      {playerHandForDisplay.map((tile) => {
        const isSelected = selectedTileId === tile.id;
        const canClick = gameState.phase === 'waitingDiscard' && gameState.turn === 'player';
        return (
          <ChessTile
            key={tile.id}
            tile={tile}
            size={handSize}
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
  );

  // The eat/pong/kong/win/pass popup — positioned as an absolute overlay anchored right below
  // the player's hand row, so it can cover the info row / action buttons / hint text beneath it
  // without ever covering the hand itself. Same anchor point in both orientations.
  const actionPopup = showActionPopup && (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      className="absolute top-full left-0 right-0 z-30 bg-stone-950 border-t border-amber-500/30 shadow-2xl"
    >
      <div
        className="px-3 py-2 grid grid-cols-2 gap-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {gameState.phase === 'showMeldSelect' && interrupts.canEat && (
          <button
            onClick={handlePlayerEat}
            className={`${bigBtnClass} rounded-2xl bg-yellow-400 text-black font-black font-serif shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition`}
          >
            吃牌
          </button>
        )}
        {gameState.phase === 'showMeldSelect' && interrupts.canPong && (
          <button
            onClick={handlePlayerPong}
            className={`${bigBtnClass} rounded-2xl bg-yellow-400 text-black font-black font-serif shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition`}
          >
            碰牌
          </button>
        )}
        {gameState.phase === 'showMeldSelect' && interrupts.canKong && (
          <button
            onClick={handlePlayerKong}
            className={`${bigBtnClass} rounded-2xl bg-yellow-400 text-black font-black font-serif shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition`}
          >
            槓牌
          </button>
        )}
        {selfKongOptions.length > 0 && (
          <button
            onClick={handlePlayerSelfKong}
            className={`${bigBtnClass} rounded-2xl bg-yellow-400 text-black font-black font-serif shadow-[0_0_16px_4px_rgba(250,204,21,0.65)] ring-2 ring-yellow-200 active:scale-95 transition`}
          >
            {selfKongOptions[0].isUpgrade ? '補槓' : '暗槓'}
          </button>
        )}
        {((gameState.phase === 'showMeldSelect' && interrupts.canWin) || isSelfDrawWinAvailable) && (
          <button
            onClick={handlePlayerDeclareWin}
            className={`${bigBtnClass} rounded-2xl bg-red-600 text-white font-black font-serif shadow-[0_0_16px_4px_rgba(220,38,38,0.65)] ring-2 ring-red-300 active:scale-95 transition`}
          >
            🔥 胡牌！
          </button>
        )}
        {showActionPopup && (
          <button
            onClick={() => {
              if (gameState.phase === 'showMeldSelect') handlePlayerPass();
              else setOwnTurnOfferDismissed(true);
            }}
            className={`${bigBtnClass} rounded-2xl bg-stone-600 text-white font-black font-serif shadow-[0_0_10px_2px_rgba(0,0,0,0.4)] ring-2 ring-stone-400 active:scale-95 transition`}
          >
            過
          </button>
        )}
      </div>
    </motion.div>
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
            onClick={handleExitClick}
            className={`p-2 rounded-xl transition ${
              confirmExit
                ? 'bg-red-600 text-white shadow-[0_0_12px_3px_rgba(220,38,38,0.6)] animate-pulse'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <LogOut size={headerIconSize} className="rotate-180" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition"
          >
            {soundEnabled ? <Volume2 size={headerIconSize} /> : <VolumeX size={headerIconSize} />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition"
          >
            <BookOpen size={headerIconSize} className="text-amber-200" />
          </button>
        </div>

        <img
          src={liangLogo}
          alt="諒 LIANG GAME"
          className={`${logoSizeClass} rounded-full border border-amber-400/50 shadow-md object-cover justify-self-center`}
        />

        <div className="flex items-center gap-1.5 justify-self-end">
          <span className={`${nameTextClass} font-extrabold font-serif text-amber-200 leading-none`}>象棋麻將</span>
          <span className={`bg-amber-500 text-[#064e3b] ${nameTextClass} font-black px-1.5 py-0.5 rounded leading-none`}>
            {gameState.mode}子
          </span>
        </div>
      </header>

      {/* ── AI SECTION: portrait = info row + hand row stacked; landscape = merged single row ── */}
      {isLandscape ? (
        <div
          className={`shrink-0 w-full ${isPhoneLandscape ? 'py-1.5' : 'px-3 py-1.5'} bg-black/20 border-b border-white/5 flex items-center gap-2`}
          style={isPhoneLandscape ? {
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          } : undefined}
        >
          {aiAvatarName}
          <div className="flex-1 min-w-0 flex justify-center overflow-x-auto">{aiHandMeldFrame}</div>
          {aiBankerScore}
        </div>
      ) : (
        <>
          <div className="shrink-0 w-full px-3 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between">
            {aiAvatarName}
            {aiBankerScore}
          </div>
          <div className="shrink-0 w-full px-2 py-2 bg-[#054131]/40 border-b border-emerald-500/10 flex justify-center overflow-x-auto">
            {aiHandMeldFrame}
          </div>
        </>
      )}

      {/* ── AI DISCARDS ── */}
      <div
        className={`${isLargeScreen ? 'shrink-0' : `flex-1 ${discardMinHeightClass}`} w-full ${isPhoneLandscape ? 'py-1.5' : 'px-2 py-1.5'} bg-[#054333]/50 border-b border-emerald-500/10 overflow-y-auto`}
        style={
          isLargeScreen
            ? { height: `${discardAreaFixedHeightPx}px` }
            : isPhoneLandscape
              // iPhones with a notch/Dynamic Island shift it into one side in landscape —
              // reserve that safe area instead of scrolling content underneath it.
              ? { paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))' }
              : undefined
        }
      >
        <div
          className={
            isPhoneLandscape
              ? `flex flex-nowrap ${handGapClass} overflow-x-auto`
              : isLandscape
                ? `flex flex-wrap ${handGapClass} content-start`
                : `grid ${handGapClass} content-start ${portraitAutoFillDiscards ? 'w-full' : 'mx-auto'}`
          }
          style={!isLandscape ? {
            gridTemplateColumns: portraitAutoFillDiscards
              ? `repeat(auto-fill, ${HAND_TILE_PX}px)`
              : `repeat(8, ${HAND_TILE_PX}px)`,
            width: portraitAutoFillDiscards ? '100%' : `${discardGridWidthPx}px`,
          } : undefined}
        >
          {gameState.ai.discards.map((tile, index) => {
            const isLatest = gameState.lastDiscardSender === 'ai' && gameState.lastDiscard?.id === tile.id;
            return (
              <div key={`ai_d_${index}`} className="relative shrink-0">
                <ChessTile tile={tile} size={discardTileSize} />
                {isLatest && <div className="absolute inset-0 rounded-full ring-2 ring-amber-400 animate-pulse pointer-events-none" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Neutral "table space" — absorbs any real leftover vertical space between the two
          discard piles on very tall/wide large screens, instead of either discard area
          stretching to fill it. Phones have no equivalent (their discard areas stay flex-1
          exactly as before). */}
      {isLargeScreen && <div className="flex-1" />}

      {/* ── PLAYER DISCARDS ── */}
      <div
        className={`${isLargeScreen ? 'shrink-0' : `flex-1 ${discardMinHeightClass}`} w-full ${isPhoneLandscape ? 'py-1.5' : 'px-2 py-1.5'} bg-[#054333]/50 border-b border-emerald-500/10 overflow-y-auto`}
        style={
          isLargeScreen
            ? { height: `${discardAreaFixedHeightPx}px` }
            : isPhoneLandscape
              // iPhones with a notch/Dynamic Island shift it into one side in landscape —
              // reserve that safe area instead of scrolling content underneath it.
              ? { paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))' }
              : undefined
        }
      >
        <div
          className={
            isPhoneLandscape
              ? `flex flex-nowrap ${handGapClass} overflow-x-auto`
              : isLandscape
                ? `flex flex-wrap ${handGapClass} content-start`
                : `grid ${handGapClass} content-start ${portraitAutoFillDiscards ? 'w-full' : 'mx-auto'}`
          }
          style={!isLandscape ? {
            gridTemplateColumns: portraitAutoFillDiscards
              ? `repeat(auto-fill, ${HAND_TILE_PX}px)`
              : `repeat(8, ${HAND_TILE_PX}px)`,
            width: portraitAutoFillDiscards ? '100%' : `${discardGridWidthPx}px`,
          } : undefined}
        >
          {gameState.player.discards.map((tile, index) => {
            const isLatest = gameState.lastDiscardSender === 'player' && gameState.lastDiscard?.id === tile.id;
            return (
              <div key={`player_d_${index}`} className="relative shrink-0">
                <ChessTile tile={tile} size={discardTileSize} />
                {isLatest && <div className="absolute inset-0 rounded-full ring-2 ring-red-400 animate-pulse pointer-events-none" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PLAYER HAND SECTION (relative anchor for the popup — never covers the hand itself) ── */}
      <div className="relative shrink-0">
        {isLandscape ? (
          <div
            className={`w-full ${isPhoneLandscape ? 'py-1.5' : 'px-3 py-1.5'} bg-black/20 border-b border-white/5 flex items-center gap-2`}
            style={isPhoneLandscape ? {
              paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
              paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
            } : undefined}
          >
            {playerAvatarName}
            <div className="flex-1 min-w-0 flex justify-center overflow-x-auto">{playerHandMeldFrame}</div>
            {playerBankerScore}
          </div>
        ) : (
          <div className="w-full px-2 py-2 bg-[#054131]/40 border-b border-emerald-500/10 flex justify-center overflow-x-auto">
            {playerHandMeldFrame}
          </div>
        )}
        <AnimatePresence>{actionPopup}</AnimatePresence>
      </div>

      {/* Portrait-only player info row — sits after the hand wrapper so the popup (anchored to
          the hand wrapper above) can cover it without ever covering the hand itself. */}
      {!isLandscape && (
        <div className="shrink-0 w-full px-3 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between">
          {playerAvatarName}
          {playerBankerScore}
        </div>
      )}

      {/* ── FOOTER: FIXED ACTIONS + HINT (bottom-most; the popup overlays on top of this when shown) ── */}
      <div className="shrink-0 flex flex-col">

        {/* Two fixed action buttons: 打出這張牌 / 摸牌 */}
        <div className="px-3 pt-2 flex gap-2">
          <motion.button
            disabled={!canDiscard}
            onClick={() => {
              const tile = gameState.player.hand.find(t => t.id === selectedTileId);
              if (tile) handlePlayerDiscard(tile);
              else if (canDiscard) addLog('⚠️ 請先點選一張要打出的手牌。');
            }}
            animate={canDiscard ? { y: [0, -6, 0] } : { y: 0 }}
            transition={canDiscard ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
            className={`flex-1 ${bigBtnClass} rounded-2xl font-bold font-serif transition-colors flex items-center justify-center ${
              canDiscard
                ? 'bg-red-600 text-white shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300'
                : 'bg-stone-800/60 text-stone-500'
            }`}
          >
            👉 打出這張牌
          </motion.button>

          <motion.button
            disabled={!canDraw}
            onClick={handlePlayerDraw}
            animate={canDraw ? { y: [0, -6, 0] } : { y: 0 }}
            transition={canDraw ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
            className={`flex-1 ${bigBtnClass} rounded-2xl font-bold font-serif transition-colors flex items-center justify-center gap-2 ${
              canDraw
                ? 'bg-red-600 text-white shadow-[0_0_20px_6px_rgba(220,38,38,0.55)] ring-2 ring-red-300'
                : 'bg-stone-800/60 text-stone-500'
            }`}
          >
            <span>🀄 摸牌</span>
            <span className="text-yellow-300">{gameState.wall.length}張</span>
          </motion.button>
        </div>

        {/* Hint row */}
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className={`flex-1 ${hintTextClass} font-serif font-semibold min-w-0 text-white`}>
            {gameState.turn === 'player' && gameState.phase === 'drawing' && (
              <span className="animate-pulse">👉 請按「摸牌」</span>
            )}
            {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && (
              <span>👉 點選手牌後按「打出這張牌」</span>
            )}
            {gameState.phase === 'showMeldSelect' && (
              <span>⚠️ 可吃碰槓或宣胡，請從上方選單操作！</span>
            )}
            {gameState.phase === 'aiThinking' && (
              <span>⏳ 對手思考中...</span>
            )}
            {gameState.phase === 'gameOver' && (
              <span>🏁 本局結束</span>
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
          <div className="bg-stone-900 border border-amber-500/20 rounded-t-3xl p-6 w-full shadow-2xl max-h-[85dvh] overflow-y-auto">
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
        <WinModal
          winner={gameState.winInfo.winner}
          winningTile={gameState.winInfo.winningTile}
          isSelfDraw={gameState.winInfo.isSelfDraw}
          fans={gameState.winInfo.fans}
          totalFans={gameState.winInfo.totalFans}
          playerConcealedTiles={gameState.winInfo.playerConcealedTiles}
          aiConcealedTiles={gameState.winInfo.aiConcealedTiles}
          playerMelds={gameState.winInfo.playerMelds}
          aiMelds={gameState.winInfo.aiMelds}
          mode={gameState.mode}
          onRestart={handleReplay}
        />
      )}

      {/* ── DRAW GAME MODAL ── */}
      {gameState.phase === 'gameOver' && gameState.winInfo && !gameState.winInfo.winner && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-0">
          <div className="bg-stone-900 border-t border-stone-700 rounded-t-3xl p-8 w-full shadow-2xl text-center max-h-[85dvh] overflow-y-auto">
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
