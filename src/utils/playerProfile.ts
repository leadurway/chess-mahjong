export interface PlayerProfile {
  name: string;
  score: number;
}

const STORAGE_KEY = 'chess-mahjong-player-profile';
export const STARTING_SCORE = 10000;
export const BASE_PAYOUT = 200; // 底
export const PER_FAN_PAYOUT = 100; // 台

const DEFAULT_NAME = '玩家';

// Each player name keeps its own independent score — switching names must load that name's own
// record, never carry over whichever score happened to be active before the switch.
interface StoredData {
  activeName: string;
  scoresByName: Record<string, number>;
}

function normalizeName(name: string): string {
  return name.trim() || DEFAULT_NAME;
}

function readStoredData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeName: DEFAULT_NAME, scoresByName: { [DEFAULT_NAME]: STARTING_SCORE } };
    const parsed = JSON.parse(raw);
    // Pre-multi-player-fix saves were a single flat {name, score} — migrate that into this
    // name's own entry instead of losing it.
    if (!parsed.scoresByName && typeof parsed.name === 'string' && typeof parsed.score === 'number') {
      const name = normalizeName(parsed.name);
      return { activeName: name, scoresByName: { [name]: parsed.score } };
    }
    const scoresByName: Record<string, number> = {};
    if (parsed.scoresByName && typeof parsed.scoresByName === 'object') {
      for (const [name, score] of Object.entries(parsed.scoresByName as Record<string, unknown>)) {
        if (typeof score === 'number' && Number.isFinite(score)) scoresByName[name] = score;
      }
    }
    const activeName = typeof parsed.activeName === 'string' && parsed.activeName.trim() ? parsed.activeName : DEFAULT_NAME;
    if (!(activeName in scoresByName)) scoresByName[activeName] = STARTING_SCORE;
    return { activeName, scoresByName };
  } catch {
    return { activeName: DEFAULT_NAME, scoresByName: { [DEFAULT_NAME]: STARTING_SCORE } };
  }
}

function writeStoredData(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently, nothing else to do.
  }
}

// The currently active player's own record.
export function loadPlayerProfile(): PlayerProfile {
  const data = readStoredData();
  return { name: data.activeName, score: data.scoresByName[data.activeName] ?? STARTING_SCORE };
}

// Call when the player changes their name: makes `name` the active profile, loading its own
// previously-saved score (or starting fresh at STARTING_SCORE if this name has never played
// before) instead of inheriting whichever score was active before the switch.
export function switchPlayerProfile(name: string): PlayerProfile {
  const data = readStoredData();
  const normalized = normalizeName(name);
  if (!(normalized in data.scoresByName)) data.scoresByName[normalized] = STARTING_SCORE;
  data.activeName = normalized;
  writeStoredData(data);
  return { name: normalized, score: data.scoresByName[normalized] };
}

export function savePlayerProfile(profile: PlayerProfile): void {
  const data = readStoredData();
  const normalized = normalizeName(profile.name);
  data.scoresByName[normalized] = profile.score;
  data.activeName = normalized;
  writeStoredData(data);
}

// 台灣麻將計分公式：贏家從輸家那裡拿走 底 + 台數 × 每台金額
export function calculatePayout(totalFans: number): number {
  return BASE_PAYOUT + totalFans * PER_FAN_PAYOUT;
}
