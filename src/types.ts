export type TileColor = 'red' | 'black';

export type TileRole = 
  | '帥' | '仕' | '相' | '車' | '馬' | '炮' | '兵' // Red side
  | '將' | '士' | '象' | '包' | '卒'; // Black side (Note: 車, 馬 are shared characters, but color distinguishes them)

export interface Tile {
  id: string;
  color: TileColor;
  role: TileRole;
  character: string; // The text printed on the tile
}

export type GameMode = 32 | 56 | 64;
export type Difficulty = 'easy' | 'hard';

export interface Meld {
  type: 'chow' | 'pong' | 'kong';
  tiles: Tile[];
  discardSource: 'player' | 'ai' | 'self'; // who discarded it, or if it was self-drawn (for kongs)
}

export interface PlayerState {
  hand: Tile[]; // Concealed tiles in hand (typically 5, or 6 during drawing)
  melds: Meld[]; // Exposed 吃/碰/槓 melds (face up on table)
  discards: Tile[]; // Discarded tiles
  score: number;
  isBanker: boolean;
  hasDeclaredReady?: boolean; // 聽牌
}

export interface GameState {
  mode: GameMode;
  difficulty: Difficulty;
  round: number;
  dealerIndex: number; // 0 for player, 1 for AI
  wall: Tile[]; // Draw pile/wall
  player: PlayerState;
  ai: PlayerState;
  turn: 'player' | 'ai';
  phase: 'idle' | 'drawing' | 'waitingDiscard' | 'aiThinking' | 'showMeldSelect' | 'gameOver';
  lastDiscard: Tile | null;
  lastDiscardSender: 'player' | 'ai' | null;
  winInfo: {
    winner: 'player' | 'ai' | null;
    winningTile: Tile | null;
    isSelfDraw: boolean;
    fans: Array<{ name: string; value: number }>;
    totalFans: number;
    handSnapshot: Tile[];
    meldsSnapshot: Meld[];
  } | null;
  logs: string[];
}
