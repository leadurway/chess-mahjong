import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, RefreshCw, Volume2, VolumeX, LogOut, Info, ArrowRight, CornerDownLeft } from 'lucide-react';
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
  // Sound toggle (visual purely for gameplay immersion)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Core Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    const wall = generateTilePool(mode);
    const playerIsFirst = playerIsBanker;

    // Deal phase: 32-tile mode (Dealer 5, Idle 4), 56/64-tile mode (Dealer 8, Idle 7)
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

  // Track select/ui states
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  
  // Eaten combo selections
  const [pendingEatCombos, setPendingEatCombos] = useState<Tile[][] | null>(null);
  const [showEatSelections, setShowEatSelections] = useState<boolean>(false);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.logs]);

  // AI Automatic trigger effect
  useEffect(() => {
    if (gameState.phase === 'aiThinking' && gameState.turn === 'ai') {
      const timer = setTimeout(() => {
        handleAILoops();
      }, 1500); // Realistic thinking delay
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.turn]);

  // Append a message to game logs
  const addLog = (message: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [...prev.logs, message],
    }));
  };

  // Sound play helper (using synthesized Web Audio API for rich experience!)
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
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'discard') {
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'meld') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.4); // C6
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.warn('Audio Context play error', e);
    }
  };

  // CHECK POSSIBLE MOVE FOR PLAYER ON AI'S DISCARD
  const checkForPlayerInterrupts = (discardedTile: Tile, currentGameState: GameState) => {
    const playerHand = currentGameState.player.hand;
    const playerMelds = currentGameState.player.melds;

    // 1. Can player direct win (胡 / 榮胡)?
    // Combine discard with player's concealed hand to check
    const completeHand = [...playerHand, discardedTile];
    const canWin = isWinningHand(completeHand, playerMelds);

    // 2. Can player Pong (碰)?
    const canPong = getPongCombination(playerHand, discardedTile) !== null;

    // 3. Can player Eat (吃)? (Since they are 2 players, player is always next to AI, so they can Eat!)
    const eatCombos = getEatCombinations(playerHand, discardedTile);
    const canEat = eatCombos.length > 0;

    // 4. Can player Kong (明槓)?
    const canKong = getKongCombinations(playerHand, playerMelds, discardedTile).length > 0;

    return { canWin, canPong, canEat, eatCombos, canKong };
  };

  // AI MAIN GAMEPLAY LOGIC
  const handleAILoops = () => {
    const aiHand = [...gameState.ai.hand];
    const aiMelds = gameState.ai.melds;

    // A. AI is in Drawing phase?
    const expectedIdleSize = gameState.mode === 32 ? 4 : 7;
    const expectedStartSize = gameState.mode === 32 ? 5 : 8;

    if (aiHand.length === expectedIdleSize) {
      if (gameState.wall.length === 0) {
        handleDrawGame();
        return;
      }

      // Draw a tile
      const updatedWall = [...gameState.wall];
      const drawnTile = updatedWall.shift()!;
      aiHand.push(drawnTile);
      
      playSfx('draw');

      // AI check Self-Draw Win (自摸)
      if (isWinningHand(aiHand, aiMelds)) {
        triggerWin('ai', drawnTile, true, updatedWall, aiHand);
        return;
      }

      // Decide which tile AI discards
      const discarded = getAIDiscard(aiHand);
      const remainingHand = aiHand.filter(t => t.id !== discarded.id);

      playSfx('discard');

      // Update state with AI's discard
      const newGameState: GameState = {
        ...gameState,
        wall: updatedWall,
        ai: {
          ...gameState.ai,
          hand: remainingHand,
          discards: [...gameState.ai.discards, discarded],
        },
        turn: 'player',
        phase: 'waitingDiscard', // Default next phase
        lastDiscard: discarded,
        lastDiscardSender: 'ai',
        logs: [...gameState.logs, `對手摸了 1 張牌，打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
      };

      // Check if Player can react to AI's discard!
      const interrupts = checkForPlayerInterrupts(discarded, newGameState);

      if (interrupts.canWin || interrupts.canPong || interrupts.canEat || interrupts.canKong) {
        newGameState.phase = 'showMeldSelect';
        newGameState.logs.push(`⚠️ 你可以對這張打牌進行吃、碰或胡牌！`);
      } else {
        // Automatically start Player's Drawing phase since no overrides
        // Let's transition to player drawing phase
        newGameState.phase = 'drawing';
      }

      setGameState(newGameState);

    } else if (aiHand.length === expectedStartSize) {
      // AI started with banker hand count (e.g. at banker draft or after eat/pong)
      // AI check Self-Draw Win (自摸) at starting turn
      if (isWinningHand(aiHand, aiMelds)) {
        triggerWin('ai', null, true, gameState.wall, aiHand);
        return;
      }

      const discarded = getAIDiscard(aiHand);
      const remainingHand = aiHand.filter(t => t.id !== discarded.id);

      playSfx('discard');

      const newGameState: GameState = {
        ...gameState,
        ai: {
          ...gameState.ai,
          hand: remainingHand,
          discards: [...gameState.ai.discards, discarded],
        },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: discarded,
        lastDiscardSender: 'ai',
        logs: [...gameState.logs, `對手思考結束，打出了 ${discarded.color === 'red' ? '紅' : '黑'}${discarded.character}`],
      };

      // Check interruptions
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

  // HANDLE WALL DRAW FOR PLAYER
  const handlePlayerDraw = () => {
    if (gameState.phase !== 'drawing' || gameState.turn !== 'player') return;
    if (gameState.wall.length === 0) {
      handleDrawGame();
      return;
    }

    const updatedWall = [...gameState.wall];
    const drawnTile = updatedWall.shift()!;
    const updatedHand = [...gameState.player.hand, drawnTile];

    playSfx('draw');

    setGameState(prev => {
      const logs = [...prev.logs, `你摸了一張：${drawnTile.color === 'red' ? '紅' : '黑'}${drawnTile.character}`];
      
      // Auto-win checks
      const canWinSelf = isWinningHand(updatedHand, prev.player.melds);
      return {
        ...prev,
        wall: updatedWall,
        player: {
          ...prev.player,
          hand: updatedHand,
        },
        phase: 'waitingDiscard',
        logs,
      };
    });
  };

  // HANDLE DISCARD FOR PLAYER
  const handlePlayerDiscard = (tileToDiscard: Tile) => {
    if (gameState.phase !== 'waitingDiscard' || gameState.turn !== 'player') return;

    const updatedHand = gameState.player.hand.filter(t => t.id !== tileToDiscard.id);
    const updatedDiscards = [...gameState.player.discards, tileToDiscard];

    playSfx('discard');
    setSelectedTileId(null);

    const nextGameState: GameState = {
      ...gameState,
      player: {
        ...gameState.player,
        hand: updatedHand,
        discards: updatedDiscards,
      },
      turn: 'ai',
      phase: 'aiThinking',
      lastDiscard: tileToDiscard,
      lastDiscardSender: 'player',
      logs: [...gameState.logs, `你打出了 ${tileToDiscard.color === 'red' ? '紅' : '黑'}${tileToDiscard.character}`],
    };

    // Check if AI can Win or React to Player's discard!
    // 1. Can AI Win (榮胡)?
    const aiCompleteHand = [...nextGameState.ai.hand, tileToDiscard];
    const aiCanWin = isWinningHand(aiCompleteHand, nextGameState.ai.melds);

    if (aiCanWin) {
      // AI immediately wins!
      triggerWin('ai', tileToDiscard, false, nextGameState.wall, aiCompleteHand);
      return;
    }

    // 2. Can AI Pong (碰)?
    const aiPongCombo = getPongCombination(nextGameState.ai.hand, tileToDiscard);
    // 3. Can AI Eat (吃)?
    const aiEatCombos = getEatCombinations(nextGameState.ai.hand, tileToDiscard);

    // AI logic for吃/碰: Always Eat/Pong if it makes a viable sequence and difficulty allows
    let aiMelded = false;

    if (aiPongCombo && (gameState.difficulty === 'hard' || Math.random() > 0.3)) {
      // AI calls Pong!
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !aiPongCombo.some(p => p.id === t.id));
      const newMeld: Meld = {
        type: 'pong',
        tiles: [...aiPongCombo, tileToDiscard],
        discardSource: 'player',
      };
      
      nextGameState.ai.hand = aiUpdatedHand;
      nextGameState.ai.melds = [...nextGameState.ai.melds, newMeld];
      nextGameState.turn = 'ai';
      nextGameState.phase = 'aiThinking'; // Will discard next
      nextGameState.lastDiscard = null;
      nextGameState.logs.push(`😲 對手喊「碰！」並展示了 [${tileToDiscard.character}${tileToDiscard.character}${tileToDiscard.character}]`);
      playSfx('meld');
      aiMelded = true;
    } else if (aiEatCombos.length > 0 && (gameState.difficulty === 'hard' || Math.random() > 0.4)) {
      // AI calls Eat! Picks first combination
      const selectedCombo = aiEatCombos[0];
      const aiUpdatedHand = nextGameState.ai.hand.filter(t => !selectedCombo.some(p => p.id === t.id));
      const newMeld: Meld = {
        type: 'chow',
        tiles: [...selectedCombo, tileToDiscard],
        discardSource: 'player',
      };

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

    if (!aiMelded) {
      // No AI actions, turn passes to AI to draw cards normally
      nextGameState.phase = 'aiThinking';
    }

    setGameState(nextGameState);
  };

  // HANDLE DRAW GAME (牌牆打光，流局)
  const handleDrawGame = () => {
    setGameState(prev => ({
      ...prev,
      phase: 'gameOver',
      logs: [...prev.logs, '🏁 牌牆已抽光！本局平手結尾 (流局/底牌打光)。'],
      winInfo: {
        winner: null,
        winningTile: null,
        isSelfDraw: false,
        fans: [],
        totalFans: 0,
        handSnapshot: prev.player.hand,
        meldsSnapshot: prev.player.melds,
      }
    }));
  };

  // HANDLE PLAYER MELD DECISION: PASS (過)
  const handlePlayerPass = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;

    addLog('你選擇了跳過 (過)。');
    
    // Resume flow: turn goes to player, phase to drawing so they can pick card
    setGameState(prev => ({
      ...prev,
      phase: 'drawing',
    }));
  };

  // HANDLE PLAYER MELD ACTION: PONG (碰)
  const handlePlayerPong = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;

    const d = gameState.lastDiscard;
    const combo = getPongCombination(gameState.player.hand, d);
    if (!combo) return;

    playSfx('meld');

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !combo.some(c => c.id === t.id));
      const newMeld: Meld = {
        type: 'pong',
        tiles: [...combo, d],
        discardSource: 'ai',
      };

      return {
        ...prev,
        player: {
          ...prev.player,
          hand: updatedHand,
          melds: [...prev.player.melds, newMeld],
        },
        turn: 'player',
        phase: 'waitingDiscard', // Player has 6 cards (melded 3, holds remaining which must be discarded)
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「碰！」，大方展示 [${d.character}${d.character}${d.character}] 刻組！`],
      };
    });
  };

  // HANDLE PLAYER MELD ACTION: EAT (吃)
  const handlePlayerEat = () => {
    if (gameState.phase !== 'showMeldSelect' || !gameState.lastDiscard) return;

    const d = gameState.lastDiscard;
    const combos = getEatCombinations(gameState.player.hand, d);
    if (combos.length === 0) return;

    if (combos.length === 1) {
      // Just eat directly
      executeEat(combos[0]);
    } else {
      // Offer multiple options
      setPendingEatCombos(combos);
      setShowEatSelections(true);
    }
  };

  const executeEat = (selectedCombo: Tile[]) => {
    const d = gameState.lastDiscard;
    if (!d) return;

    playSfx('meld');
    setShowEatSelections(false);
    setPendingEatCombos(null);

    setGameState(prev => {
      const updatedHand = prev.player.hand.filter(t => !selectedCombo.some(c => c.id === t.id));
      const newMeld: Meld = {
        type: 'chow',
        tiles: [...selectedCombo, d],
        discardSource: 'ai',
      };

      const charString = newMeld.tiles.map(t => t.character).join('');

      return {
        ...prev,
        player: {
          ...prev.player,
          hand: updatedHand,
          melds: [...prev.player.melds, newMeld],
        },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs: [...prev.logs, `你喊了「吃！」，大方展示 [${charString}] 順組！`],
      };
    });
  };

  // HANDLE PLAYER MELD ACTION: KONG (槓)
  const handlePlayerKong = () => {
    if (!gameState.lastDiscard) return; // Only dealing with direct discard kong for simplicity in UI triggering
    const d = gameState.lastDiscard;
    const combos = getKongCombinations(gameState.player.hand, gameState.player.melds, d);
    if (combos.length === 0) return;

    const match = combos[0]; // Take match
    playSfx('meld');

    setGameState(prev => {
      // Remove matching 3 tiles from hand
      const updatedHand = prev.player.hand.filter(t => !match.some(c => c.id === t.id && c.id !== d.id));
      const newMeld: Meld = {
        type: 'kong',
        tiles: match,
        discardSource: 'ai',
      };

      // In Kong, player must draw a replacement card (補牌) from back of wall
      const updatedWall = [...prev.wall];
      const replacementTile = updatedWall.pop(); // draw from end of wall for realism!

      const finalHand = replacementTile ? [...updatedHand, replacementTile] : updatedHand;
      const logs = [...prev.logs, `你喊了「槓！」，亮出 [${d.character}${d.character}${d.character}${d.character}] 槓組！`];
      
      if (replacementTile) {
        logs.push(`💡 你從牆尾進行補牌，摸得：${replacementTile.color === 'red' ? '紅' : '黑'}${replacementTile.character}`);
      }

      return {
        ...prev,
        wall: updatedWall,
        player: {
          ...prev.player,
          hand: finalHand,
          melds: [...prev.player.melds, newMeld],
        },
        turn: 'player',
        phase: 'waitingDiscard',
        lastDiscard: null,
        logs,
      };
    });
  };

  // TRIGGER WIN CONDITIONS (胡牌)
  const handlePlayerDeclareWin = () => {
    const playerHand = gameState.player.hand;
    const playerMelds = gameState.player.melds;
    const targetWinSize = gameState.mode === 32 ? 5 : 8;
    const targetIdleSize = gameState.mode === 32 ? 4 : 7;

    // Check if drawing self-drawn win (自摸)
    if (playerHand.length === targetWinSize) {
      if (isWinningHand(playerHand, playerMelds)) {
        // Yes, self-draw!
        const winningTile = gameState.lastDiscardSender === 'player' ? null : playerHand[playerHand.length - 1];
        triggerWin('player', winningTile, true, gameState.wall, playerHand);
      } else {
        addLog('⚠️ 提示：你目前的手牌尚未形成胡牌聽牌組合喔！');
      }
    } else if (playerHand.length === targetIdleSize && gameState.lastDiscard && gameState.phase === 'showMeldSelect') {
      // Checking Win on opponent's discard (榮胡)
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

    // Calculate fans with full hand
    const fansCalculated = calculateFans(
      finalConcealedHand,
      winnerState.melds,
      isSelfDraw,
      isFirstMove,
      winner
    );

    const totalFans = fansCalculated.reduce((sum, f) => sum + f.value, 0);

    setGameState(prev => ({
      ...prev,
      wall: updatedWall,
      phase: 'gameOver',
      logs: [
        ...prev.logs, 
        `🎉 ${isPlayer ? '玩家' : '對手 AI'} 宣告胡牌 (${isSelfDraw ? '自摸' : '榮胡'})！共 ${totalFans} 台！`
      ],
      winInfo: {
        winner,
        winningTile,
        isSelfDraw,
        fans: fansCalculated,
        totalFans,
        handSnapshot: finalConcealedHand,
        meldsSnapshot: winnerState.melds,
      },
    }));
  };

  // REPLAY GAME SETUP
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
      mode,
      difficulty,
      round: gameState.round + 1,
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
        ? [`--- 第 ${gameState.round + 1} 局開始 ---`, `玩家起莊領 ${baseDealerCount} 張牌，請打出一張牌。`] 
        : [`--- 第 ${gameState.round + 1} 局開始 ---`, `對手起莊領 ${baseDealerCount} 張牌，對手思考中...`],
    });
    setSelectedTileId(null);
  };

  // Derive active triggers
  const interrupts = gameState.lastDiscard && gameState.lastDiscardSender === 'ai'
    ? checkForPlayerInterrupts(gameState.lastDiscard, gameState)
    : { canWin: false, canPong: false, canEat: false, canKong: false };

  // Hand is valid for Self-drawn Win (自摸) directly if hand size matches maximum size for mode
  const expectedWinSize = gameState.mode === 32 ? 5 : 8;
  const isSelfDrawWinAvailable = gameState.player.hand.length === expectedWinSize && 
    isWinningHand(gameState.player.hand, gameState.player.melds);

  return (
    <div className="min-h-screen bg-[#064e3b] text-white flex flex-col p-4 relative font-sans antialiased">
      
      {/* HEADER BAR */}
      <header className="flex justify-between items-center bg-black/30 border border-white/10 rounded-2xl px-6 py-4 mb-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onExit}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="返回主選單"
          >
            <LogOut size={20} />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold font-serif text-amber-250 leading-none tracking-wide">
                象棋麻將
              </h1>
              <span className="bg-amber-500 text-[#064e3b] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                {gameState.mode}子 經典模式
              </span>
            </div>
            <p className="text-[10px] text-white/60 mt-0.5 font-mono">
              ROUND {gameState.round} • DIFFICULTY: {gameState.difficulty.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Rules Manual */}
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl transition border border-white/10 font-serif shadow-sm"
          >
            <BookOpen size={14} className="text-amber-200" />
            規則說明 (Rules)
          </button>

          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition"
            title={soundEnabled ? '靜音' : '開啟音效'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <div className="text-right select-none pl-4 border-l border-white/10">
            <span className="text-[10px] text-white/50 block leading-none">Remaining</span>
            <span className="text-2xl font-black text-amber-400 font-mono leading-none">
              {gameState.wall.length}
            </span>
          </div>
        </div>
      </header>

      {/* GAME PLAYFIELD ROW */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden mb-4">
        
        {/* LEFT/MAIN TABLE CONTAINER (3 SCORES COLUMNS) */}
        <div className="lg:col-span-3 bg-radial from-[#065f46] to-[#064e3b] rounded-3xl border border-emerald-500/20 p-6 flex flex-col justify-between relative shadow-2xl overflow-hidden min-h-[500px]">
          
          {/* Authentic card table design details */}
          <div className="absolute inset-0 border-[12px] border-amber-900/40 rounded-[24px] pointer-events-none"></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] select-none pointer-events-none text-[200px] font-bold font-serif text-emerald-100">
            棋
          </div>

          {/* SECTION A: OPPONENT AI ROW */}
          <div className="space-y-2 relative z-10">
            <div className="flex justify-between items-center opacity-95">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-600 border-2 border-white overflow-hidden flex items-center justify-center font-bold text-xs shadow-md">
                  AI
                </div>
                <div>
                  <span className="text-xs font-serif font-black text-white block drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">大師 (Opponent AI)</span>
                  <p className="text-[10px] text-amber-300 font-bold capitalize bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{gameState.difficulty} 難度</p>
                </div>
              </div>

              {/* Show exposed melds for AI */}
              {gameState.ai.melds.length > 0 && (
                <div className="flex gap-2">
                  {gameState.ai.melds.map((meld, mIdx) => (
                    <div key={`ai_m_${mIdx}`} className="flex gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10 relative">
                      <span className="absolute -top-2 bg-amber-550 text-stone-950 text-[8px] font-black px-1.5 rounded scale-75 shadow-sm">
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

            {/* AI cards in hand (Face-down during active game) */}
            <div className="flex gap-1.5 bg-[#054131]/60 py-3 px-4 rounded-2xl border border-emerald-500/20 shadow-inner">
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

          {/* SECTION B: DISCARDS COURT (CENTER) */}
          <div className="my-6 grid grid-cols-2 gap-4 flex-1 items-center relative z-10">
            
            {/* Left Box: AI Discards */}
            <div className="bg-[#054333]/70 rounded-2xl p-4 border border-emerald-500/15 h-full flex flex-col justify-between shadow-[inset_0_4px_12px_rgba(0,0,0,0.4)]">
              <div className="text-[10px] text-emerald-200 mb-2 font-serif flex items-center gap-1.5 border-b border-emerald-500/10 pb-1">
                <span className="font-bold">🤖 對手打牌堆 (AI Discards)</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 content-start flex-1 min-h-[80px]">
                {gameState.ai.discards.map((tile, index) => {
                  const isLatest = gameState.lastDiscardSender === 'ai' && gameState.lastDiscard?.id === tile.id;
                  return (
                    <div key={`ai_d_${index}`} className="relative">
                      <ChessTile tile={tile} size="sm" />
                      {isLatest && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-amber-400 animate-pulse"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Box: Player Discards */}
            <div className="bg-[#054333]/70 rounded-2xl p-4 border border-emerald-500/15 h-full flex flex-col justify-between shadow-[inset_0_4px_12px_rgba(0,0,0,0.4)]">
              <div className="text-[10px] text-emerald-200 mb-2 font-serif flex items-center gap-1.5 border-b border-emerald-500/10 pb-1">
                <span className="font-bold">👤 我的打牌堆 (My Discards)</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 content-start flex-1 min-h-[80px]">
                {gameState.player.discards.map((tile, index) => {
                  const isLatest = gameState.lastDiscardSender === 'player' && gameState.lastDiscard?.id === tile.id;
                  return (
                    <div key={`player_d_${index}`} className="relative">
                      <ChessTile tile={tile} size="sm" />
                      {isLatest && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-red-500 animate-pulse"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SECTION C: PLAYER ACTIONS & CARDS ROW (BOTTOM) */}
          <div className="space-y-4 relative z-10 border-t border-white/10 pt-4">
            
            {/* Active Actions Banner / Buttons */}
            <div className="flex flex-wrap justify-between items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/10">
              
              {/* Action hints text */}
              <div className="text-xs text-stone-300 font-serif">
                {gameState.turn === 'player' && gameState.phase === 'drawing' && (
                  <span className="text-amber-400 animate-pulse">👉 請點選右側「摸牌」按鈕，拾打大局。</span>
                )}
                {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && (
                  <span>👉 請點選一張手牌進行<b>打牌</b> (可雙擊打牌)。</span>
                )}
                {gameState.phase === 'showMeldSelect' && (
                  <span className="text-orange-400 font-bold">⚠️ 對手剛打出牌！快搶吃碰或宣告胡牌！</span>
                )}
                {gameState.phase === 'aiThinking' && (
                  <span className="text-stone-400">⏳ 對手正在思考中...</span>
                )}
              </div>

              {/* ACTION COMMAND BUTTONS */}
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  
                  {/* Eat (吃) */}
                  {gameState.phase === 'showMeldSelect' && interrupts.canEat && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={handlePlayerEat}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-bold font-serif text-xs px-4 py-2 rounded-xl transition shadow shadow-sky-600/20"
                    >
                      吃牌 (Eat)
                    </motion.button>
                  )}

                  {/* Pong (碰) */}
                  {gameState.phase === 'showMeldSelect' && interrupts.canPong && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={handlePlayerPong}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-serif text-xs px-4 py-2 rounded-xl transition shadow shadow-emerald-600/20"
                    >
                      碰牌 (Pong)
                    </motion.button>
                  )}

                  {/* Kong (槓) */}
                  {gameState.phase === 'showMeldSelect' && interrupts.canKong && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={handlePlayerKong}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-serif text-xs px-4 py-2 rounded-xl transition"
                    >
                      槓牌 (Kong)
                    </motion.button>
                  )}

                  {/* Win (胡牌) */}
                  {((gameState.phase === 'showMeldSelect' && interrupts.canWin) || isSelfDrawWinAvailable) && (
                    <motion.button
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      onClick={handlePlayerDeclareWin}
                      className="bg-gradient-to-r from-red-600 to-amber-600 animate-pulse text-white font-bold font-serif text-xs px-5 py-2 rounded-xl shadow-lg shadow-red-600/40"
                    >
                      🔥 胡 牌 (WIN!)
                    </motion.button>
                  )}

                  {/* Pass (過) */}
                  {gameState.phase === 'showMeldSelect' && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={handlePlayerPass}
                      className="bg-stone-750 hover:bg-stone-700 text-stone-300 font-bold font-serif text-xs px-4 py-2 rounded-xl transition border border-stone-700"
                    >
                      過 (Pass)
                    </motion.button>
                  )}

                  {/* Draw button when draw trigger is active */}
                  {gameState.turn === 'player' && gameState.phase === 'drawing' && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={handlePlayerDraw}
                      className="bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold font-serif text-xs px-5 py-2 rounded-xl transition shadow shadow-amber-600/20 flex items-center gap-1.5"
                    >
                      🀄 摸牌 (Draw)
                    </motion.button>
                  )}

                  {/* Discard active selection prompt */}
                  {gameState.turn === 'player' && gameState.phase === 'waitingDiscard' && selectedTileId && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => {
                        const tile = gameState.player.hand.find(t => t.id === selectedTileId);
                        if (tile) handlePlayerDiscard(tile);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold font-serif text-xs px-4 py-2 rounded-xl"
                    >
                      打牌 (Discard)
                    </motion.button>
                  )}

                </AnimatePresence>
              </div>
            </div>

            {/* PLAYER TILES WRAPPER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              
              {/* Eaten/Ponged Melds on Left */}
              <div className="flex flex-col justify-end bg-black/30 p-2.5 rounded-2xl border border-white/10 min-w-[120px] shadow-inner">
                <span className="text-[9px] text-emerald-200 uppercase block mb-1.5 font-bold tracking-wider font-serif">亮出牌組 (My Melds)</span>
                
                <div className="flex gap-2">
                  {gameState.player.melds.map((meld, mIdx) => (
                    <div key={`meld_${mIdx}`} className="flex gap-1 bg-black/40 p-1.5 rounded-xl border border-white/5 relative shadow">
                      <span className="absolute -top-2 bg-amber-500 text-stone-950 text-[7px] font-black px-1 rounded shadow-sm">
                        {meld.type === 'chow' ? '吃' : meld.type === 'pong' ? '碰' : '槓'}
                      </span>
                      {meld.tiles.map((t, tIdx) => (
                        <ChessTile key={`mt_${mIdx}_${tIdx}`} tile={t} size="sm" />
                      ))}
                    </div>
                  ))}
                  {gameState.player.melds.length === 0 && (
                    <div className="text-[10px] text-white/40 py-3 font-serif pl-1">原牌手 (門清)</div>
                  )}
                </div>
              </div>

              {/* Player hand in middle */}
              <div className="flex-grow flex justify-center py-2.5 bg-[#054131]/60 rounded-b-2xl border-b-2 border-emerald-500/20 shadow-inner">
                <div className="flex flex-wrap gap-2 items-end justify-center">
                  {gameState.player.hand.map((tile, index) => {
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
                          if (isSelected) {
                            // Double tap/click to discard directly
                            handlePlayerDiscard(tile);
                          } else {
                            setSelectedTileId(tile.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* RIGHT: LIVE EVENT LOGS (1 SCORE COLUMN) */}
        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between shadow-2xl h-full lg:max-h-[600px]">
          
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 select-none">
            <span className="text-amber-400 font-bold">📜</span>
            <h2 className="text-sm font-bold font-serif text-white tracking-wide">
              即時局勢播報 (Game Logs)
            </h2>
          </div>

          {/* List area */}
          <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-2.5 max-h-[350px] lg:max-h-none scrollbar-thin scrollbar-thumb-stone-800">
            {gameState.logs.map((log, index) => {
              const isAlert = log.includes('🚨') || log.includes('⚠️');
              const isWin = log.includes('胡牌');
              
              return (
                <div 
                  key={`log_${index}`} 
                  className={`p-2 rounded-xl border leading-relaxed ${
                    isWin 
                      ? 'bg-amber-950/40 border-amber-800/40 text-amber-300 font-bold' 
                      : isAlert 
                        ? 'bg-red-950/20 border-red-900/30 text-rose-300' 
                        : 'bg-stone-850/60 border-stone-800/50 text-stone-300'
                  }`}
                >
                  <div className="text-[9px] text-stone-500 mb-0.5 font-mono">
                    ROUNDLOG #{index + 1}
                  </div>
                  <p>{log}</p>
                </div>
              );
            })}
            <div ref={logEndRef}></div>
          </div>

          {/* Game controls / restart if ended */}
          <div className="mt-4 pt-4 border-t border-stone-800 space-y-3">
            {/* Draw limit notice */}
            <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-[10px] text-stone-400 select-none flex items-center gap-2">
              <Info size={12} className="text-amber-500 flex-shrink-0" />
              <span>當牌牆剩 0 張時，本局以和局（流局）結算。</span>
            </div>

            {/* If game over, offer replay button directly here too */}
            {gameState.phase === 'gameOver' && (
              <button
                onClick={handleReplay}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-serif font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
              >
                <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '3s' }} />
                準備下一局 (Next Round)
              </button>
            )}
          </div>

        </div>

      </div>

      {/* MULTIPLE EAT CHOICE OVERLAY MODAL */}
      {showEatSelections && pendingEatCombos && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-amber-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <h3 className="text-lg font-bold font-serif text-amber-400 mb-2">
              🤔 選擇你要吃的牌組組合
            </h3>
            <p className="text-stone-400 text-xs mb-4">
              你有多組匹配方案可以吃下這張打牌：
            </p>

            <div className="space-y-3 my-4">
              {pendingEatCombos.map((combo, idx) => {
                const combined = [...combo, gameState.lastDiscard!];
                return (
                  <button
                    key={`eat_c_${idx}`}
                    onClick={() => executeEat(combo)}
                    className="w-full bg-stone-850 hover:bg-stone-800 border border-stone-750 p-3 rounded-xl flex items-center justify-between transition group hover:border-amber-500/30"
                  >
                    <div className="flex gap-2">
                      {combined.map((t, cIdx) => (
                        <ChessTile key={`ec_${idx}_${cIdx}`} tile={t} size="sm" />
                      ))}
                    </div>
                    <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                      選擇此組合 <ArrowRight size={12} />
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowEatSelections(false);
                setPendingEatCombos(null);
              }}
              className="mt-2 text-stone-400 hover:text-stone-200 text-xs py-1.5"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* RULES MANUAL OVERLAY MODAL */}
      {showRules && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <RuleGuide onClose={() => setShowRules(false)} />
        </div>
      )}

      {/* GAME OVER WIN/LOSE SUMMARY DIALOG */}
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

      {/* GAME OVER FLAT DRAW MODAL */}
      {gameState.phase === 'gameOver' && gameState.winInfo && !gameState.winInfo.winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
            <span className="text-4xl">🏁</span>
            <h2 className="text-2xl font-serif font-bold text-stone-300 mt-3 mb-1">平手流局結算</h2>
            <p className="text-stone-500 text-xs mb-6">底牌已摸光，雙方均未胡牌。</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleReplay}
                className="bg-amber-600 hover:bg-amber-700 text-stone-950 font-serif font-bold py-2.5 rounded-xl"
              >
                再來一局
              </button>
              <button
                onClick={onExit}
                className="bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold py-2.5 rounded-xl border border-stone-750"
              >
                返回選單
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
