import { Tile, TileColor, TileRole, GameMode, Meld, PlayerState, GameState } from '../types';

// Canonical display order for a concealed hand: black pieces (將士象車馬包), then red
// pieces (帥仕相車馬炮), with both sides' soldiers (兵/卒) trailing at the very end.
const HAND_DISPLAY_ORDER: { color: TileColor; role: TileRole }[] = [
  { color: 'black', role: '將' }, { color: 'black', role: '士' }, { color: 'black', role: '象' },
  { color: 'black', role: '車' }, { color: 'black', role: '馬' }, { color: 'black', role: '包' },
  { color: 'red', role: '帥' }, { color: 'red', role: '仕' }, { color: 'red', role: '相' },
  { color: 'red', role: '車' }, { color: 'red', role: '馬' }, { color: 'red', role: '炮' },
  { color: 'red', role: '兵' }, { color: 'black', role: '卒' },
];

export function sortHandForDisplay(hand: Tile[]): Tile[] {
  const rank = (t: Tile) => HAND_DISPLAY_ORDER.findIndex(e => e.color === t.color && e.role === t.role);
  return [...hand].sort((a, b) => rank(a) - rank(b));
}

// Within an exposed meld, the tile that came from elsewhere (a claimed discard, or the tile that
// completed a kong) is always appended last by construction. Display wants that tile centered,
// flanked by the tiles that were already in the concealed hand.
//
// Kongs are visually compressed to 3 tiles instead of their real 4 (the 4th is redundant since
// all 4 are identical) — an open kong (明槓: direct-discard claim or a pong upgraded via a drawn
// 4th tile) shows all 3 face up; a concealed kong (暗槓: discardSource 'self') shows only the
// center tile, with the two flanking tiles face down.
export function getMeldDisplayTiles(meld: Meld): { tile: Tile; isTrigger: boolean; isFaceDown: boolean }[] {
  const tiles = meld.tiles;
  const trigger = tiles[tiles.length - 1];
  const others = tiles.slice(0, tiles.length - 1);

  if (meld.type === 'kong') {
    const isConcealed = meld.discardSource === 'self';
    const [a, b] = others;
    return [
      { tile: a, isTrigger: false, isFaceDown: isConcealed },
      { tile: trigger, isTrigger: true, isFaceDown: false },
      { tile: b, isTrigger: false, isFaceDown: isConcealed },
    ];
  }

  const ordered = [others[0], trigger, others[1]];
  return ordered.map(t => ({ tile: t, isTrigger: t.id === trigger.id, isFaceDown: false }));
}

// Generate a unique tile pool based on mode
export function generateTilePool(mode: GameMode): Tile[] {
  const pool: Omit<Tile, 'id'>[] = [];

  const addTiles = (color: TileColor, role: TileRole, count: number) => {
    const character = role;
    for (let i = 0; i < count; i++) {
      pool.push({ color, role, character });
    }
  };

  if (mode === 32) {
    // Red side
    addTiles('red', '帥', 1);
    addTiles('red', '仕', 2);
    addTiles('red', '相', 2);
    addTiles('red', '車', 2);
    addTiles('red', '馬', 2);
    addTiles('red', '炮', 2);
    addTiles('red', '兵', 5);

    // Black side
    addTiles('black', '將', 1);
    addTiles('black', '士', 2);
    addTiles('black', '象', 2);
    addTiles('black', '車', 2);
    addTiles('black', '馬', 2);
    addTiles('black', '包', 2);
    addTiles('black', '卒', 5);
  } else if (mode === 56) {
    // Red side
    addTiles('red', '帥', 4);
    addTiles('red', '仕', 4);
    addTiles('red', '相', 4);
    addTiles('red', '車', 4);
    addTiles('red', '馬', 4);
    addTiles('red', '炮', 4);
    addTiles('red', '兵', 4);

    // Black side
    addTiles('black', '將', 4);
    addTiles('black', '士', 4);
    addTiles('black', '象', 4);
    addTiles('black', '車', 4);
    addTiles('black', '馬', 4);
    addTiles('black', '包', 4);
    addTiles('black', '卒', 4);
  } else if (mode === 64) {
    // Red side (2 full chess sets)
    addTiles('red', '帥', 2);
    addTiles('red', '仕', 4);
    addTiles('red', '相', 4);
    addTiles('red', '車', 4);
    addTiles('red', '馬', 4);
    addTiles('red', '炮', 4);
    addTiles('red', '兵', 10);

    // Black side
    addTiles('black', '將', 2);
    addTiles('black', '士', 4);
    addTiles('black', '象', 4);
    addTiles('black', '車', 4);
    addTiles('black', '馬', 4);
    addTiles('black', '包', 4);
    addTiles('black', '卒', 10);
  }

  // Shuffle and assign IDs
  const shuffled = pool
    .map((tile, index) => ({
      ...tile,
      id: `tile_${tile.color}_${tile.role}_${index}_${Math.random().toString(36).substring(2, 6)}`,
    }))
    .sort(() => Math.random() - 0.5);

  return shuffled;
}

// The two valid sequences (順子) per color — shared by isValidMeld and the AI's partial-sequence
// detection so both stay in sync.
const RED_SEQUENCES: TileRole[][] = [['帥', '仕', '相'], ['車', '馬', '炮']];
const BLACK_SEQUENCES: TileRole[][] = [['將', '士', '象'], ['車', '馬', '包']];

// Check if 3 tiles form a valid meld (面子)
export function isValidMeld(tiles: Tile[]): boolean {
  if (tiles.length !== 3) return false;

  // Check if it's a Triple (刻子): Identical role & color
  const t1 = tiles[0];
  const t2 = tiles[1];
  const t3 = tiles[2];

  if (t1.role === t2.role && t2.role === t3.role && t1.color === t2.color && t2.color === t3.color) {
    return true;
  }

  // Check if it's a Sequence (順子)
  // Must be same color
  if (!(t1.color === t2.color && t2.color === t3.color)) {
    return false;
  }

  const color = t1.color;
  const roles = tiles.map(t => t.role).sort();
  const rolesKey = JSON.stringify(roles);
  const sequences = color === 'red' ? RED_SEQUENCES : BLACK_SEQUENCES;
  return sequences.some(seq => JSON.stringify([...seq].sort()) === rolesKey);
}

// Check if two tiles can make a pair (對子)
// 同色同字，或者「帥將」湊成對
export function isPair(t1: Tile, t2: Tile): boolean {
  if (t1.role === t2.role && t1.color === t2.color) return true;
  if ((t1.role === '帥' && t2.role === '將') || (t1.role === '將' && t2.role === '帥')) return true;
  return false;
}

// Check if a set of tiles can be perfectly partitioned into pairs
export function canPartitionIntoPairs(tiles: Tile[]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.length % 2 !== 0) return false;

  const t1 = tiles[0];
  for (let i = 1; i < tiles.length; i++) {
    const t2 = tiles[i];
    if (isPair(t1, t2)) {
      const remaining = tiles.filter((_, idx) => idx !== 0 && idx !== i);
      if (canPartitionIntoPairs(remaining)) {
        return true;
      }
    }
  }
  return false;
}

// Check if a set of tiles can be split into valid melds (each of size 3)
export function canSplitIntoMelds(tiles: Tile[]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;

  const t1 = tiles[0];
  for (let i = 1; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const m = [t1, tiles[i], tiles[j]];
      if (isValidMeld(m)) {
        const remaining = tiles.filter((_, idx) => idx !== 0 && idx !== i && idx !== j);
        if (canSplitIntoMelds(remaining)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if a concealed hand can be split into only triples and exactly one pair
export function checkAllTriples(concealedHand: Tile[], exposedMelds: Meld[]): boolean {
  if (exposedMelds.some(m => m.type === 'chow')) return false;

  const canSplitOnlyTriples = (tiles: Tile[]): boolean => {
    if (tiles.length === 0) return true;
    const t1 = tiles[0];
    const matching = tiles.filter(t => t.role === t1.role && t.color === t1.color);
    if (matching.length >= 3) {
      const rest = [...tiles];
      for (let count = 0; count < 3; count++) {
        const idx = rest.findIndex(t => t.role === t1.role && t.color === t1.color);
        rest.splice(idx, 1);
      }
      if (canSplitOnlyTriples(rest)) return true;
    }
    return false;
  };

  for (let i = 0; i < concealedHand.length; i++) {
    for (let j = i + 1; j < concealedHand.length; j++) {
      if (isPair(concealedHand[i], concealedHand[j])) {
        const remaining = concealedHand.filter((_, idx) => idx !== i && idx !== j);
        if (canSplitOnlyTriples(remaining)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Bulletproof Winning hand validation: Supports 32-tile (5-cards) and 56/64-tile (8-cards) sizes
export function isWinningHand(concealedHand: Tile[], exposedMelds: Meld[]): boolean {
  const totalCount = concealedHand.length + exposedMelds.length * 3;

  if (totalCount !== 5 && totalCount !== 8) {
    return false;
  }

  const allTiles = [...concealedHand, ...exposedMelds.flatMap(m => m.tiles)];

  // 1. 32-tile Mode (5 tiles total)
  if (totalCount === 5) {
    // Check Special Hand: 五兵 (5 red soldiers) or 五卒 (5 black soldiers)
    const redSoldiersCount = allTiles.filter(t => t.color === 'red' && t.role === '兵').length;
    const blackSoldiersCount = allTiles.filter(t => t.color === 'black' && t.role === '卒').length;
    if (redSoldiersCount === 5 || blackSoldiersCount === 5) {
      return true;
    }

    // Check standard 1 Meld + 1 Pair
    if (exposedMelds.length === 1 && concealedHand.length === 2) {
      return isPair(concealedHand[0], concealedHand[1]);
    }
    if (exposedMelds.length === 0 && concealedHand.length === 5) {
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          if (isPair(concealedHand[i], concealedHand[j])) {
            const remaining = concealedHand.filter((_, idx) => idx !== i && idx !== j);
            if (canSplitIntoMelds(remaining)) {
              return true;
            }
          }
        }
      }
    }
  }

  // 2. 56 or 64-tile Mode (8 tiles total)
  if (totalCount === 8) {
    // Check Special Hand: 對子四組 (4 pairs, 8 tiles)
    if (exposedMelds.length === 0 && concealedHand.length === 8) {
      if (canPartitionIntoPairs(concealedHand)) {
        return true;
      }
    }

    // Check standard 2 Melds + 1 Pair
    if (exposedMelds.length === 2 && concealedHand.length === 2) {
      return isPair(concealedHand[0], concealedHand[1]);
    }
    if (exposedMelds.length === 1 && concealedHand.length === 5) {
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          if (isPair(concealedHand[i], concealedHand[j])) {
            const remaining = concealedHand.filter((_, idx) => idx !== i && idx !== j);
            if (canSplitIntoMelds(remaining)) {
              return true;
            }
          }
        }
      }
    }
    if (exposedMelds.length === 0 && concealedHand.length === 8) {
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          if (isPair(concealedHand[i], concealedHand[j])) {
            const remaining = concealedHand.filter((_, idx) => idx !== i && idx !== j);
            if (canSplitIntoMelds(remaining)) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

// Find if player can call "Eat" (吃)
// Returns array of pairs of Tiles in hand that can combine with discard to form a sequence
// Each color has exactly two fixed sequences (see RED_SEQUENCES/BLACK_SEQUENCES above), and
// every role belongs to only one of them — so a given discard's role uniquely determines the
// one sequence it could complete, and thus the one role-pair needed from hand. There is never
// more than one semantically distinct chow choice for a given discard; this only returns more
// than one entry when hand happens to hold a DUPLICATE of one of those roles (e.g. two 帥),
// which are interchangeable, identical-looking choices, not real alternatives — deduped below
// by role-pair so callers never need to offer a "pick one" selection for what is really a
// single option.
export function getEatCombinations(hand: Tile[], discard: Tile): Tile[][] {
  const validCombos: Tile[][] = [];
  const seenRolePairs = new Set<string>();
  const discardColor = discard.color;
  const r = discard.role;

  // Helper check if three unique roles form a valid seq
  const isSeq = (roleList: TileRole[], color: TileColor) => {
    const dummyTiles = roleList.map((role, idx) => ({
      id: `dummy_${idx}`,
      color,
      role,
      character: role,
    }));
    return isValidMeld(dummyTiles);
  };

  // We look through all pairs in hand
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const h1 = hand[i];
      const h2 = hand[j];

      // Must match discard color
      if (h1.color !== discardColor || h2.color !== discardColor) continue;
      // Cannot eat with identical tiles (e.g., 兵, 兵, 兵 is a triple, not seq)
      if (h1.role === h2.role || h1.role === r || h2.role === r) continue;

      if (isSeq([r, h1.role, h2.role], discardColor)) {
        const rolePair = [h1.role, h2.role].sort().join('_');
        if (seenRolePairs.has(rolePair)) continue;
        seenRolePairs.add(rolePair);
        validCombos.push([h1, h2]);
      }
    }
  }

  return validCombos;
}

// Find if player can call "Pong" (碰)
// Returns the 2 identical tiles in hand if possible, otherwise null
export function getPongCombination(hand: Tile[], discard: Tile): Tile[] | null {
  const match = hand.filter(t => t.color === discard.color && t.role === discard.role);
  if (match.length >= 2) {
    return match.slice(0, 2); // Return the first two matches
  }
  return null;
}

// Find if player can call "Kong" (槓)
// Returns list of tiles that can be konged
export function getKongCombinations(hand: Tile[], exposedMelds: Meld[], discard: Tile | null): Tile[][] {
  const kongs: Tile[][] = [];

  // 1. Direct discard kong (明槓): someone discards, and you have a triple in your hand
  if (discard) {
    const match = hand.filter(t => t.color === discard.color && t.role === discard.role);
    if (match.length === 3) {
      kongs.push([...match, discard]);
    }
  }

  // 2. Hidden kong in hand (暗槓): during drawing phase, you have 4 identical pieces in hand
  if (!discard) {
    const counts: Record<string, Tile[]> = {};
    hand.forEach(t => {
      const key = `${t.color}_${t.role}`;
      if (!counts[key]) counts[key] = [];
      counts[key].push(t);
    });

    Object.values(counts).forEach(list => {
      if (list.length === 4) {
        kongs.push(list);
      }
    });

    // 3. Exposed kong upgrade (補槓): you have an exposed Pong, and draw the 4th piece in hand
    exposedMelds.forEach(meld => {
      if (meld.type === 'pong') {
        const repr = meld.tiles[0];
        const match4th = hand.filter(t => t.color === repr.color && t.role === repr.role);
        if (match4th.length === 1) {
          kongs.push([...meld.tiles, match4th[0]]);
        }
      }
    });
  }

  return kongs;
}

// A self-declared kong made on your own turn (no discard involved): either a concealed
// kong (暗槓, 4 identical tiles drawn into a fresh hand) or a supplement kong (補槓,
// upgrading an existing exposed pong with a newly-drawn 4th tile).
export interface SelfKongOption {
  tiles: Tile[];
  isUpgrade: boolean;
  upgradeMeldIndex: number; // index into exposedMelds being upgraded, -1 when concealed
}

export function getSelfKongOptions(hand: Tile[], exposedMelds: Meld[]): SelfKongOption[] {
  const combos = getKongCombinations(hand, exposedMelds, null);
  return combos.map(combo => {
    const tilesStillInHand = combo.filter(t => hand.some(h => h.id === t.id));
    const isUpgrade = tilesStillInHand.length === 1;
    const upgradeMeldIndex = isUpgrade
      ? exposedMelds.findIndex(m => m.type === 'pong' && m.tiles.some(mt => combo.some(c => c.id === mt.id)))
      : -1;
    return { tiles: combo, isUpgrade, upgradeMeldIndex };
  });
}

// Shared shape used by both a winning hand's decomposition (below) and a meld's chow/pong
// classification — a meld that isn't 3-of-a-kind must be a sequence, since isValidMeld only
// ever accepts those two shapes.
interface MeldShape {
  tiles: Tile[];
  isChow: boolean;
}

function extractMeldShapes(tiles: Tile[]): MeldShape[] | null {
  if (tiles.length === 0) return [];
  for (let i = 1; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const group = [tiles[0], tiles[i], tiles[j]];
      if (isValidMeld(group)) {
        const remaining = tiles.filter((_, idx) => idx !== 0 && idx !== i && idx !== j);
        const rest = extractMeldShapes(remaining);
        if (rest !== null) {
          const isChow = !(group[0].role === group[1].role && group[1].role === group[2].role);
          return [{ tiles: group, isChow }, ...rest];
        }
      }
    }
  }
  return null;
}

// Decomposes a winning hand into its eye (pair) and every meld — exposed melds are already
// split out by the game, but a fully concealed hand (no calls at all) still needs solving for
// which 2 tiles are the eye and how the rest divide into melds. Several fan categories below
// (將帥聽令's eye, 雙龍抱/一條龍's meld shapes) need this rather than just a flat tile list.
// Kongs are treated as their 3-tile triple shape — the 4th identical tile doesn't change
// whether the group reads as a chow or a pong for these checks.
function decomposeWinningShape(
  concealedHand: Tile[],
  exposedMelds: Meld[]
): { eye: [Tile, Tile]; melds: MeldShape[] } | null {
  const exposedShapes: MeldShape[] = exposedMelds.map(m => ({
    tiles: m.type === 'kong' ? m.tiles.slice(0, 3) : m.tiles,
    isChow: m.type === 'chow',
  }));

  if (concealedHand.length === 2) {
    return isPair(concealedHand[0], concealedHand[1])
      ? { eye: [concealedHand[0], concealedHand[1]], melds: exposedShapes }
      : null;
  }

  for (let i = 0; i < concealedHand.length; i++) {
    for (let j = i + 1; j < concealedHand.length; j++) {
      if (!isPair(concealedHand[i], concealedHand[j])) continue;
      const remaining = concealedHand.filter((_, idx) => idx !== i && idx !== j);
      const concealedMelds = extractMeldShapes(remaining);
      if (concealedMelds) {
        return { eye: [concealedHand[i], concealedHand[j]], melds: [...exposedShapes, ...concealedMelds] };
      }
    }
  }
  return null;
}

// Extra context calculateFans needs beyond the winning hand itself — grouped into one object
// since a 9th positional boolean would stop being readable at the call site.
export interface WinContext {
  isSelfDraw: boolean;
  isFirstMove: boolean; // winner has made zero discards yet (天胡/地胡 eligibility)
  isWinnerBanker: boolean;
  dealerStreak: number; // consecutive rounds the CURRENT round's dealer has held the seat
  mode: GameMode;
  isKongReplacement: boolean; // winning tile was a kong's replacement draw (槓上開花)
  isLastWallTile: boolean; // winning tile was the wall's last remaining tile (海底撈月)
}

// Score calculation (台數) — see docs/Xiangqi_Mahjong_Scoring_Guide (象棋麻將棋仔自摸計分全攻略)
// for the source ruleset this mirrors. The three modes intentionally score differently: 32-tile
// mode's tiny 1-meld hands get their own dedicated categories (莊家 flat bonus, 將帥聽令, the
// full 5-soldier hand shape), while 56/64-tile mode's 2-meld hands get a different set (門清,
// 斷頭尾, 碰碰胡/二槓子, 將帥領兵, 雙龍抱/一條龍) that would be structurally unreachable with
// only 1 meld. 64-tile mode alone can reach 5+ soldiers of one color in a single hand (its two
// full chess sets supply up to 10 of each), so 五兵合縱/五卒連橫/八家將 only fire there.
export function calculateFans(
  concealedHand: Tile[],
  exposedMelds: Meld[],
  ctx: WinContext
): { name: string; value: number }[] {
  const fans: { name: string; value: number }[] = [];
  const { mode } = ctx;

  const allTiles: Tile[] = [...concealedHand];
  exposedMelds.forEach(m => allTiles.push(...m.tiles));

  // 底台 / 胡牌 — every mode.
  fans.push({ name: '胡牌 (Base Win)', value: 1 });

  // 莊家 — 32-tile mode only: being banker adds a flat tai every round, win or lose, exactly
  // like 連莊 below (not conditioned on who actually wins this particular hand).
  if (mode === 32) {
    fans.push({ name: '莊家 (Banker)', value: 1 });
  }

  // 連莊 — this project's own addition (not part of the source ruleset, added per a direct
  // request since a 2-player-vs-AI match has no other players to track streaks against). Same
  // "applies regardless of who wins" logic as 莊家 above.
  if (ctx.dealerStreak > 1) {
    fans.push({ name: `連莊 (Dealer Streak, 連${ctx.dealerStreak - 1}莊)`, value: ctx.dealerStreak - 1 });
  }

  // 清一色 — entire winning hand is a single color. All modes. (Replaces separately-valued
  // 全紅/全黑 — the source ruleset grants one flat tai for either color, not two categories.)
  const allRed = allTiles.every(t => t.color === 'red');
  const allBlack = allTiles.every(t => t.color === 'black');
  if (allRed || allBlack) {
    fans.push({ name: '清一色 (One Color)', value: 1 });
  }

  // 海底撈月 / 槓上開花 — winning off the wall's last tile, or a kong's replacement draw.
  // Both share one bonus slot per mode; 32-tile's ruleset only names 海底撈月, but a
  // kong-replacement win there scores the same way.
  if (ctx.isSelfDraw && (ctx.isKongReplacement || ctx.isLastWallTile)) {
    const name = ctx.isKongReplacement ? '槓上開花 (Kong Replacement Draw)' : '海底撈月 (Last Wall Tile)';
    fans.push({ name, value: mode === 56 ? 2 : 1 });
  }

  // 自摸 — value scales by mode.
  if (ctx.isSelfDraw) {
    fans.push({ name: '自摸 (Self Draw)', value: mode === 56 ? 1 : 2 });
  }

  // 門清 — fully concealed hand (a self-declared 暗槓 doesn't break it). Not offered in
  // 32-tile mode, which the source ruleset omits entirely (its 1-meld cap makes "concealed"
  // too easy to reach to be worth its own tai there).
  if (mode !== 32) {
    const nonConcealedMelds = exposedMelds.filter(m => !(m.type === 'kong' && m.discardSource === 'self'));
    if (nonConcealedMelds.length === 0) {
      fans.push({ name: '門清 (Concealed Hand)', value: mode === 64 ? 2 : 1 });
    }
  }

  // 斷頭尾 — hand contains none of 將/帥/兵/卒. 56/64-tile only.
  if (mode !== 32) {
    if (allTiles.every(t => !['將', '帥', '兵', '卒'].includes(t.role))) {
      fans.push({ name: '斷頭尾 (No Generals or Soldiers)', value: 1 });
    }
  }

  // 碰碰胡 / 二槓子 — every group is a triple, or two of the melds are kongs. 56/64-tile only.
  if (mode !== 32) {
    const kongCount = exposedMelds.filter(m => m.type === 'kong').length;
    if (checkAllTriples(concealedHand, exposedMelds) || kongCount >= 2) {
      fans.push({ name: '碰碰胡/二槓子 (All Triples or Two Kongs)', value: 2 });
    }
  }

  const shape = decomposeWinningShape(concealedHand, exposedMelds);

  // 將帥聽令 — the eye is 將 or 帥 (isPair already allows 將/帥 to pair cross-color as the
  // "royal couple"). 32-tile only.
  if (mode === 32 && shape && (shape.eye[0].role === '將' || shape.eye[0].role === '帥')) {
    fans.push({ name: '將帥聽令 (King/General Eye)', value: 2 });
  }

  // 將帥領兵 — the entire hand is only 將/帥 and 兵/卒 (no other piece types at all). 56/64-tile only.
  if (mode !== 32 && allTiles.every(t => ['將', '帥', '兵', '卒'].includes(t.role))) {
    fans.push({ name: '將帥領兵 (Generals Leading Soldiers)', value: 2 });
  }

  // 雙龍抱 / 一條龍 — two identical sequences, or the complete two-sequence run of one color
  // (帥仕相+俥傌炮 / 將士象+車馬包). Needs both melds to be chows of the same color. 56/64-tile
  // only (32-tile's 1-meld cap can never produce two sequences to compare).
  if (mode !== 32 && shape) {
    const chows = shape.melds.filter(m => m.isChow);
    if (chows.length === 2 && chows[0].tiles[0].color === chows[1].tiles[0].color) {
      const rolesOf = (m: Tile[]) => [...m.map(t => t.role)].sort().join('');
      if (rolesOf(chows[0].tiles) === rolesOf(chows[1].tiles)) {
        fans.push({ name: '雙龍抱 (Twin Sequences)', value: 4 });
      } else {
        const color = chows[0].tiles[0].color;
        const combinedRoles = new Set([...chows[0].tiles, ...chows[1].tiles].map(t => t.role));
        const fullRun: TileRole[] = color === 'red' ? ['帥', '仕', '相', '車', '馬', '炮'] : ['將', '士', '象', '車', '馬', '包'];
        if (fullRun.every(r => combinedRoles.has(r))) {
          fans.push({ name: '一條龍 (Full Sequence Run)', value: 4 });
        }
      }
    }
  }

  // 五兵合縱 / 五卒連橫 / 八家將 — same-color-soldier counting, tiered by how many appear in
  // the winning hand. 32-tile's version is a whole-hand special shape (5 tiles, all one
  // soldier) already validated by isWinningHand elsewhere. 56-tile mode can never reach 5 (only
  // 4 of any single tile exist there), so this naturally never fires for it. 64-tile mode's
  // larger soldier supply (two full sets, 10 of each color) lets 5+ arise as a meld+pair
  // combination within an otherwise normal 8-tile hand, up to all 8 tiles being identical.
  const redSoldiers = allTiles.filter(t => t.color === 'red' && t.role === '兵').length;
  const blackSoldiers = allTiles.filter(t => t.color === 'black' && t.role === '卒').length;
  const maxSoldierCount = Math.max(redSoldiers, blackSoldiers);
  const soldierIsRed = redSoldiers >= blackSoldiers;
  if (mode === 32 && allTiles.length === 5 && maxSoldierCount === 5) {
    fans.push({ name: soldierIsRed ? '五兵合縱 (Five Red Soldiers)' : '五卒連橫 (Five Black Soldiers)', value: 5 });
  } else if (mode === 64 && maxSoldierCount === 8) {
    fans.push({ name: '八家將 (Eight Soldiers)', value: 8 });
  } else if (mode === 64 && maxSoldierCount >= 5) {
    fans.push({ name: soldierIsRed ? '五兵合縱 (Five Red Soldiers Meld)' : '五卒連橫 (Five Black Soldiers Meld)', value: 2 });
  }

  // 天胡 / 地胡 — both require a self-drawn win before the winner's first discard. isFirstMove
  // (zero discards) is the right test on its own: a self-kong (暗槓/補槓) drawn and resolved
  // within that same first turn — even chained multiple times — still counts, since the
  // winner hasn't discarded yet either way. It's only excluded once a REAL later turn has
  // begun (i.e. after their first discard), which isFirstMove already reflects.
  if (ctx.isFirstMove && ctx.isSelfDraw) {
    const value = mode === 32 ? 6 : 8;
    fans.push({ name: ctx.isWinnerBanker ? '天胡 (Heavenly Win)' : '地胡 (Earthly Win)', value });
  }

  return fans;
}

// Smart Heuristic Evaluation function for AI to decide discards or Melds.
export function evaluateHand(hand: Tile[]): number {
  if (hand.length === 0) return 0;

  let score = 0;

  // Let's count matching colors to encourage color purity (All Red / All Black builds)
  const redCount = hand.filter(t => t.color === 'red').length;
  const blackCount = hand.filter(t => t.color === 'black').length;
  score += Math.max(redCount, blackCount) * 4; // Reward color uniformity

  // Find pairs, triples, and sequence links
  const roles = hand.map(t => t.role);
  const colorRoles = hand.map(t => `${t.color}_${t.role}`);

  // Count identical pieces (Pairs)
  const uniqueItems = Array.from(new Set(colorRoles));
  uniqueItems.forEach(item => {
    const count = colorRoles.filter(ir => ir === item).length;
    if (count === 2) {
      score += 15; // Good pair/eyes potential, or triple potential!
    } else if (count === 3) {
      score += 35; // Triple found! Highly valuable
    } else if (count === 4) {
      score += 45; // Quads potential
    }
  });

  // Find partial sequences (consecutive chess steps)
  const checkPartialSeq = (rolesList: TileRole[], c: TileColor) => {
    const rSet = new Set(rolesList.filter((_, idx) => hand[idx]?.color === c));
    let seqScore = 0;
    
    // Red seq 1: 帥-仕-相
    if (c === 'red') {
      if (rSet.has('帥') && rSet.has('仕')) seqScore += 12;
      if (rSet.has('仕') && rSet.has('相')) seqScore += 12;
      if (rSet.has('帥') && rSet.has('相')) seqScore += 8; // inside gap

      // Red seq 2: 車-馬-炮
      if (rSet.has('車') && rSet.has('馬')) seqScore += 12;
      if (rSet.has('馬') && rSet.has('炮')) seqScore += 12;
      if (rSet.has('車') && rSet.has('炮')) seqScore += 8;
    } else {
      // Black seq 1: 將-士-象
      if (rSet.has('將') && rSet.has('士')) seqScore += 12;
      if (rSet.has('士') && rSet.has('象')) seqScore += 12;
      if (rSet.has('將') && rSet.has('象')) seqScore += 8;

      // Black seq 2: 車-馬-包
      if (rSet.has('車') && rSet.has('馬')) seqScore += 12;
      if (rSet.has('馬') && rSet.has('包')) seqScore += 12;
      if (rSet.has('車') && rSet.has('包')) seqScore += 8;
    }
    return seqScore;
  };

  score += checkPartialSeq(roles, 'red');
  score += checkPartialSeq(roles, 'black');

  // Check if we have multiple soldiers of same color (兵兵 or 卒卒)
  const redSoldiers = hand.filter(t => t.color === 'red' && t.role === '兵').length;
  const blackSoldiers = hand.filter(t => t.color === 'black' && t.role === '卒').length;

  if (redSoldiers === 2) score += 10;
  if (redSoldiers >= 3) score += 30; // Closer to兵兵兵 triple
  if (blackSoldiers === 2) score += 10;
  if (blackSoldiers >= 3) score += 30;

  return score;
}

// Decide what card AI will discard from its cards in hand
export function getAIDiscard(hand: Tile[]): Tile {
  if (hand.length === 0) return {} as Tile;

  let bestDiscard: Tile = hand[0];
  let highestScore = -1;

  for (let i = 0; i < hand.length; i++) {
    const candidateDiscards = hand[i];
    const resultingHand = hand.filter((_, idx) => idx !== i);
    const score = evaluateHand(resultingHand);

    if (score > highestScore) {
      highestScore = score;
      bestDiscard = candidateDiscards;
    }
  }

  return bestDiscard;
}

// ────────────────────────────────────────────────────────────────────────────
// Hard AI ("大師"): a shanten-style evaluator that actually models meld-building
// instead of the flat heuristic scoring above (which Easy AI keeps using as-is).
// ────────────────────────────────────────────────────────────────────────────

// Two tiles are a "partial sequence" if they're two-of-three members of the same
// valid 順子 for their shared color (e.g. 帥+仕, needing 相 to complete).
function isPartialSequence(a: TileRole, b: TileRole, color: TileColor): boolean {
  if (a === b) return false;
  const sequences = color === 'red' ? RED_SEQUENCES : BLACK_SEQUENCES;
  return sequences.some(seq => seq.includes(a) && seq.includes(b));
}

// Backtracking search for the MAXIMUM number of complete melds (面子) extractable
// from a tile list, returning that count plus whatever tiles are left over. Hand
// sizes here are always small (≤8), so exhaustive search is cheap.
function bestMeldExtraction(tiles: Tile[]): { count: number; remainder: Tile[] } {
  if (tiles.length < 3) return { count: 0, remainder: tiles };

  let best = { count: 0, remainder: tiles };
  const [head, ...rest] = tiles;

  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const candidate = [head, rest[i], rest[j]];
      if (!isValidMeld(candidate)) continue;
      const leftover = rest.filter((_, idx) => idx !== i && idx !== j);
      const sub = bestMeldExtraction(leftover);
      if (sub.count + 1 > best.count) {
        best = { count: sub.count + 1, remainder: sub.remainder };
      }
    }
  }

  // Also try leaving the head tile unused entirely, in case that yields more melds overall.
  const skipHead = bestMeldExtraction(rest);
  if (skipHead.count > best.count) {
    best = { count: skipHead.count, remainder: [head, ...skipHead.remainder] };
  }

  return best;
}

// Among leftover tiles (after pulling out complete melds and the eye), count
// non-overlapping "one tile away" proto-melds: pairs (→ triple) or partial sequences.
function countPartialGroups(tiles: Tile[]): number {
  const used = new Array(tiles.length).fill(false);
  let count = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < tiles.length; j++) {
      if (used[j]) continue;
      const a = tiles[i];
      const b = tiles[j];
      if (a.color !== b.color) continue;
      const isProtoTriple = a.role === b.role;
      const isProtoSequence = isPartialSequence(a.role, b.role, a.color);
      if (isProtoTriple || isProtoSequence) {
        used[i] = true;
        used[j] = true;
        count++;
        break;
      }
    }
  }
  return count;
}

// Greedy count of non-overlapping pairs across a whole hand — used to credit progress
// toward 對子四組 (four pairs), which the meld+eye shape analysis doesn't model.
function countGreedyPairs(tiles: Tile[]): number {
  const used = new Array(tiles.length).fill(false);
  let count = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < tiles.length; j++) {
      if (used[j]) continue;
      if (isPair(tiles[i], tiles[j])) {
        used[i] = true;
        used[j] = true;
        count++;
        break;
      }
    }
  }
  return count;
}

// Best achievable shape for a concealed hand: tries every candidate eye (pair), plus the
// option of no eye yet, and keeps whichever choice yields the most complete melds (with
// partial groups as a tiebreaker).
function analyzeHandShape(concealedHand: Tile[]): { completeMelds: number; hasEye: boolean; partialGroups: number } {
  let best = { completeMelds: 0, hasEye: false, partialGroups: 0 };
  let bestRank = -1;

  const consider = (completeMelds: number, hasEye: boolean, partialGroups: number) => {
    const rank = completeMelds * 100 + (hasEye ? 50 : 0) + partialGroups * 10;
    if (rank > bestRank) {
      bestRank = rank;
      best = { completeMelds, hasEye, partialGroups };
    }
  };

  // No eye committed yet — still worth ranking in case the hand is far from a pair.
  {
    const { count, remainder } = bestMeldExtraction(concealedHand);
    consider(count, false, countPartialGroups(remainder));
  }

  for (let i = 0; i < concealedHand.length; i++) {
    for (let j = i + 1; j < concealedHand.length; j++) {
      if (!isPair(concealedHand[i], concealedHand[j])) continue;
      const rest = concealedHand.filter((_, idx) => idx !== i && idx !== j);
      const { count, remainder } = bestMeldExtraction(rest);
      consider(count, true, countPartialGroups(remainder));
    }
  }

  return best;
}

// Higher = closer to a complete winning hand. Combines exposed + concealed melds against
// what the mode actually requires, whether a pair/eye is in place, and how many "one tile
// away" groups remain — with a sliver of the old heuristic as a tiebreaker only.
export function computeHandProgressScore(concealedHand: Tile[], exposedMeldsCount: number, mode: GameMode): number {
  const shape = analyzeHandShape(concealedHand);
  const totalMelds = exposedMeldsCount + shape.completeMelds;

  // A winning hand only ever needs 1 meld (32-tile mode) or 2 melds (56/64-tile mode) plus
  // the eye — melds beyond that don't bring the hand closer to winning, so they're capped
  // at full value and only credited a small residual afterward. Without this cap, the score
  // would keep rewarding "one more meld" even when doing so means sacrificing the only eye
  // in hand, which is never actually worth it once the meld requirement is already met.
  const requiredMelds = mode === 32 ? 1 : 2;
  const cappedMelds = Math.min(totalMelds, requiredMelds);
  const surplusMelds = totalMelds - cappedMelds;
  let score = cappedMelds * 1000 + surplusMelds * 50;
  if (shape.hasEye) score += 400;
  score += shape.partialGroups * 80;

  // The meld+eye shape above doesn't recognize the mode-specific special hands, so credit
  // progress toward those separately (only meaningful while still fully concealed).
  if (exposedMeldsCount === 0) {
    if (mode === 32) {
      const redSoldiers = concealedHand.filter(t => t.color === 'red' && t.role === '兵').length;
      const blackSoldiers = concealedHand.filter(t => t.color === 'black' && t.role === '卒').length;
      score += Math.max(redSoldiers, blackSoldiers) * 90; // building toward 五兵/五卒將星
    } else {
      score += countGreedyPairs(concealedHand) * 90; // building toward 對子四組
    }
  }

  score += evaluateHand(concealedHand) * 0.1;
  return score;
}

// Hard-only discard choice: for each candidate discard, score the resulting hand with the
// shanten-style evaluator above, and steer away from tiles the opponent has already shown
// (via their own exposed melds) that they collect — using only public information, not a
// peek at their concealed hand.
export function getAIDiscardAdvanced(
  hand: Tile[],
  ownMeldsCount: number,
  mode: GameMode,
  opponentMelds: Meld[] = []
): Tile {
  if (hand.length === 0) return {} as Tile;

  const dangerousKeys = new Set(opponentMelds.flatMap(m => m.tiles.map(t => `${t.color}_${t.role}`)));

  let bestDiscard: Tile = hand[0];
  let bestScore = -Infinity;

  for (let i = 0; i < hand.length; i++) {
    const candidate = hand[i];
    const resultingHand = hand.filter((_, idx) => idx !== i);
    let score = computeHandProgressScore(resultingHand, ownMeldsCount, mode);
    if (dangerousKeys.has(`${candidate.color}_${candidate.role}`)) {
      score -= 60;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDiscard = candidate;
    }
  }

  return bestDiscard;
}

// Hard-only pong/eat decision: only take the meld if it genuinely improves the hand's
// progress toward winning by more than the value of staying concealed (門清) would.
export function shouldTakeMeld(
  handBefore: Tile[],
  meldsCountBefore: number,
  handAfter: Tile[],
  meldsCountAfter: number,
  mode: GameMode
): boolean {
  const before = computeHandProgressScore(handBefore, meldsCountBefore, mode);
  const concealedBonus = meldsCountBefore === 0 ? 60 : 0;
  const after = computeHandProgressScore(handAfter, meldsCountAfter, mode);
  return after > before + concealedBonus;
}
