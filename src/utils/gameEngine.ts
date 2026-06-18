import { Tile, TileColor, TileRole, GameMode, Meld, PlayerState, GameState } from '../types';

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

  if (color === 'red') {
    // Red sequences allowed: {帥, 仕, 相}, {車, 馬, 炮}
    const seq1 = ['仕', '相', '帥'].sort();
    const seq2 = ['砲', '車', '馬'].sort(); // Handle potential typing variants
    const seq2_alt = ['炮', '車', '馬'].sort();

    const rolesKey = JSON.stringify(roles);
    if (rolesKey === JSON.stringify(seq1)) return true;
    if (rolesKey === JSON.stringify(seq2)) return true;
    if (rolesKey === JSON.stringify(seq2_alt)) return true;
  } else {
    // Black sequences allowed: {將, 士, 象}, {車, 馬, 包}
    const seq1 = ['士', '將', '象'].sort();
    const seq2 = ['包', '車', '馬'].sort();

    const rolesKey = JSON.stringify(roles);
    if (rolesKey === JSON.stringify(seq1)) return true;
    if (rolesKey === JSON.stringify(seq2)) return true;
  }

  return false;
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
export function getEatCombinations(hand: Tile[], discard: Tile): Tile[][] {
  const validCombos: Tile[][] = [];
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

// Score calculation (台數)
export function calculateFans(
  concealedHand: Tile[],
  exposedMelds: Meld[],
  isSelfDraw: boolean,
  isFirstMove: boolean,
  winner: 'player' | 'ai'
): { name: string; value: number }[] {
  const fans: { name: string; value: number }[] = [];
  
  // Base Win / 贏牌底
  fans.push({ name: '胡牌 (Base Win)', value: 1 });

  // Self Draw
  if (isSelfDraw) {
    fans.push({ name: '自摸 (Self Draw)', value: 1 });
  }

  // Concealed Hand
  if (exposedMelds.length === 0) {
    fans.push({ name: '門清 (Concealed Hand)', value: 1 });
  }

  // Extract all tiles in the winning configuration
  const allTiles: Tile[] = [...concealedHand];
  exposedMelds.forEach(m => allTiles.push(...m.tiles));

  const allRed = allTiles.every(t => t.color === 'red');
  const allBlack = allTiles.every(t => t.color === 'black');

  // All Red / All Black
  if (allRed) {
    fans.push({ name: '全紅 (All Red)', value: 4 });
  } else if (allBlack) {
    fans.push({ name: '全黑 (All Black)', value: 4 });
  } else {
    const redCount = allTiles.filter(t => t.color === 'red').length;
    const blackCount = allTiles.filter(t => t.color === 'black').length;
    if (redCount >= 2 && blackCount >= 2) {
      fans.push({ name: '半紅黑 (Half Red Half Black)', value: 1 });
    }
  }

  // Special Wins
  const isFiveRedSoldiers = allTiles.length === 5 && allTiles.every(t => t.color === 'red' && t.role === '兵');
  const isFiveBlackSoldiers = allTiles.length === 5 && allTiles.every(t => t.color === 'black' && t.role === '卒');
  if (isFiveRedSoldiers) {
    fans.push({ name: '五兵全會 (Five Red Soldiers)', value: 8 });
  } else if (isFiveBlackSoldiers) {
    fans.push({ name: '五卒將星 (Five Black Soldiers)', value: 8 });
  } else {
    // All Triples
    if (checkAllTriples(concealedHand, exposedMelds)) {
      fans.push({ name: '碰碰胡 (All Triples)', value: 2 });
    }

    // Four Pairs
    const is4Pairs = allTiles.length === 8 && exposedMelds.length === 0 && canPartitionIntoPairs(concealedHand);
    if (is4Pairs) {
      fans.push({ name: '對子四組 (Four Pairs)', value: 4 });
    }
  }

  // Double Check if we have Soldier Melds (兵/卒 刻子) -> 兵兵兵 or 卒卒卒
  const redSoldiers = allTiles.filter(t => t.color === 'red' && t.role === '兵').length;
  const blackSoldiers = allTiles.filter(t => t.color === 'black' && t.role === '卒').length;
  if (redSoldiers >= 3 && redSoldiers < 5) {
    fans.push({ name: '兵卒刻組 (Soldier Melds)', value: 1 });
  }
  if (blackSoldiers >= 3 && blackSoldiers < 5) {
    fans.push({ name: '兵卒刻組 (Soldier Melds)', value: 1 });
  }

  // Heavenly/Earthly Win
  if (isFirstMove) {
    if (winner === 'player' && isSelfDraw) {
      fans.push({ name: '天胡 (Heavenly Win)', value: 8 });
    } else {
      fans.push({ name: '地胡 (Earthly Win)', value: 8 });
    }
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
