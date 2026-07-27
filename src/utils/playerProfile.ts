export interface PlayerProfile {
  name: string;
  score: number;
}

const STORAGE_KEY = 'chess-mahjong-player-profile';
export const STARTING_SCORE = 10000;
export const BASE_PAYOUT = 200; // 底
export const PER_FAN_PAYOUT = 100; // 台

const DEFAULT_PROFILE: PlayerProfile = { name: '玩家', score: STARTING_SCORE };

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : DEFAULT_PROFILE.name,
      score: typeof parsed.score === 'number' && Number.isFinite(parsed.score) ? parsed.score : STARTING_SCORE,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently, nothing else to do.
  }
}

// 台灣麻將計分公式：贏家從輸家那裡拿走 底 + 台數 × 每台金額
export function calculatePayout(totalFans: number): number {
  return BASE_PAYOUT + totalFans * PER_FAN_PAYOUT;
}
