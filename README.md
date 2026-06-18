# 象棋麻將 Chess Mahjong

A 1v1 Chinese Chess Mahjong simulator built with React, TypeScript, and Tailwind CSS.

**Live:** https://chess-mahjong.pages.dev

## About

象棋麻將 replaces standard mahjong tiles with Chinese chess pieces (象棋). Two players draw, discard, eat, pong, and kong their way to a winning hand using chess piece combinations instead of bamboo/characters/circles.

## Game Modes

| Mode | Tiles | Hand Size | Win Condition |
|------|-------|-----------|---------------|
| 32子 (Classic) | 32 — one full chess set | Banker 5 / Idle 4 | 1 meld + 1 pair, or Five Soldiers |
| 56子 (Medium) | 56 — 4× each piece | Banker 8 / Idle 7 | 2 melds + 1 pair, or Four Pairs |
| 64子 (Double) | 64 — two full chess sets | Banker 8 / Idle 7 | 2 melds + 1 pair, or Four Pairs |

## Valid Melds (面子)

**Sequences (順子) — same color:**
- Red: 帥仕相 · 車馬炮
- Black: 將士象 · 車馬包

**Triples (刻子):** three identical pieces of the same color

**Pairs (對子):** same color + same role, or 帥將 cross-pair

## Scoring (台數)

| Fan | Value |
|-----|-------|
| Base Win 胡牌 | 1 |
| Self Draw 自摸 | 1 |
| Concealed Hand 門清 | 1 |
| Half Red-Black 半紅黑 | 1 |
| Soldier Triple 兵卒刻組 | 1 |
| All Triples 碰碰胡 | 2 |
| All Red 全紅 / All Black 全黑 | 4 |
| Four Pairs 對子四組 | 4 |
| Five Soldiers 五兵全會/五卒將星 | 8 |
| Heavenly Win 天胡 / Earthly Win 地胡 | 8 |

## Run Locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=chess-mahjong
```
