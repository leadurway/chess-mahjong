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
  pendingDrawnTileId?: string | null; // most recently drawn tile, pinned at the end of the hand display until discarded
  pendingDrawWasKong?: boolean; // the pending drawn tile was a kong's replacement draw (槓上開花 eligibility)
}

export interface GameState {
  mode: GameMode;
  difficulty: Difficulty;
  round: number;
  dealerIndex: number; // 0 for player, 1 for AI
  dealerStreak: number; // consecutive rounds the current dealer has held the seat (連莊)
  wall: Tile[]; // Draw pile/wall
  player: PlayerState;
  ai: PlayerState;
  turn: 'player' | 'ai';
  phase: 'idle' | 'drawing' | 'waitingDiscard' | 'aiThinking' | 'showMeldSelect' | 'gameOver';
  lastDiscard: Tile | null;
  lastDiscardSender: 'player' | 'ai' | null;
  aiDiscardOnly?: boolean; // AI just claimed a meld (pong/chow) and must discard without drawing
  winInfo: {
    winner: 'player' | 'ai' | null;
    winningTile: Tile | null;
    isSelfDraw: boolean;
    fans: Array<{ name: string; value: number }>;
    totalFans: number;
    handSnapshot: Tile[];
    meldsSnapshot: Meld[];
    // Concealed-hand tiles and exposed melds are kept separate (rather than flattened together)
    // so the win-modal reveal can render melds with the same chow/pong/kong glow + kong-tile-
    // compression treatment used in the live game, instead of a plain flat tile list.
    playerConcealedTiles: Tile[];
    aiConcealedTiles: Tile[];
    playerMelds: Meld[];
    aiMelds: Meld[];
  } | null;
  logs: string[];
}
