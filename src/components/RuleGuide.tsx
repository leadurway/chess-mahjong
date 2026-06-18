import React from 'react';
import { ChessTile } from './ChessTile';
import { Tile } from '../types';

interface RuleGuideProps {
  onClose?: () => void;
}

export const RuleGuide: React.FC<RuleGuideProps> = ({ onClose }) => {
  // Mock tiles for demo sequences
  const redShuai: Tile = { id: 'demo1', color: 'red', role: '帥', character: '帥' };
  const redShi: Tile = { id: 'demo2', color: 'red', role: '仕', character: '仕' };
  const redXiang: Tile = { id: 'demo3', color: 'red', role: '相', character: '相' };
  
  const redChe: Tile = { id: 'demo4', color: 'red', role: '車', character: '車' };
  const redMa: Tile = { id: 'demo5', color: 'red', role: '馬', character: '馬' };
  const redPao: Tile = { id: 'demo6', color: 'red', role: '炮', character: '炮' };

  const blackJiang: Tile = { id: 'demo7', color: 'black', role: '將', character: '將' };
  const blackShi: Tile = { id: 'demo8', color: 'black', role: '士', character: '士' };
  const blackXiang: Tile = { id: 'demo9', color: 'black', role: '象', character: '象' };

  const blackChe: Tile = { id: 'demo10', color: 'black', role: '車', character: '車' };
  const blackMa: Tile = { id: 'demo11', color: 'black', role: '馬', character: '馬' };
  const blackBao: Tile = { id: 'demo12', color: 'black', role: '包', character: '包' };

  const redBin: Tile = { id: 'demo13', color: 'red', role: '兵', character: '兵' };
  const blackZu: Tile = { id: 'demo14', color: 'black', role: '卒', character: '卒' };

  return (
    <div className="bg-stone-900/95 text-stone-100 p-6 rounded-2xl border border-amber-500/20 max-w-4xl w-full mx-auto shadow-2xl overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-stone-700">
      <div className="flex justify-between items-center mb-6 border-b border-amber-500/20 pb-4">
        <h2 className="text-2xl font-bold font-serif text-amber-400 flex items-center gap-2">
          🀄 象棋麻將 遊戲規則說明
        </h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 font-bold px-3 py-1 rounded-lg transition"
          >
            關閉
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* Section 1: Introduction */}
        <div>
          <h3 className="text-lg font-semibold text-amber-300 mb-2 font-serif">1. 象棋麻將簡介與模式細則</h3>
          <p className="text-stone-300 text-sm leading-relaxed space-y-1">
            象棋麻將結合了傳統<b>中國象棋棋子</b>與<b>麻將摸打玩法的快速博弈遊戲</b>。依據子數模式不同，玩法與胡牌組合均有所調整：
          </p>
          <div className="bg-stone-800/60 p-4 rounded-xl border border-amber-500/10 text-xs mt-3 space-y-2">
            <p>🀄 <b>三塊二子型 (32子)</b>：紅黑象棋各一套。適合2人，莊家摸 5 張，閒家摸 4 張。胡牌需湊齊「<b>一組面子 ＋ 一對對子</b>」（共5張），例如：<b>＜順子 ＋ 對子＞、＜刻子 ＋ 對子＞</b>，或特殊牌型：<b>＜五兵（卒）＞</b>。</p>
            <p>🀄 <b>五十六子型 (56子)</b>：將到卒、帥到兵每種牌各 4 張。適合4人，莊家摸 8 張，閒家摸 7 張。胡牌需湊齊「<b>兩組面子 ＋ 一對對子</b>」（共8張），例如：<b>＜兩組面子 ＋ 對子＞</b>，或特殊牌型：<b>＜對子四組 (4對)＞</b>。</p>
            <p>🀄 <b>六十四子型 (64子)</b>：即32子型的兩倍數。玩法、胡牌組合同56子型（兩面子 ＋ 一對對子 或 四對子，共8張）。</p>
            <p className="text-amber-400 font-semibold mt-1">💡 將眼與對子：對子可由兩張相同牌面組成，此外「帥」字與「將」字亦可跨色湊成一對對子！</p>
          </div>
        </div>

        {/* Section 2: Winning Hands / Melds */}
        <div>
          <h3 className="text-lg font-semibold text-amber-300 mb-3 font-serif">2. 合法面子（搭子）組合</h3>
          <p className="text-stone-300 text-sm mb-4">
            「面子（搭子）」係指由三張牌構成的組合，分為「同色順子」與「同色刻子（三張相同）」：
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Red Sequences */}
            <div className="bg-stone-800/80 p-4 rounded-xl border border-red-500/10">
              <span className="text-red-400 font-bold text-sm block mb-3">🔴 紅方專屬順子</span>
              <div className="space-y-4">
                <div>
                  <span className="text-stone-400 block mb-1">【帥仕相】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redShuai} size="sm" />
                    <ChessTile tile={redShi} size="sm" />
                    <ChessTile tile={redXiang} size="sm" />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【車馬炮】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redChe} size="sm" />
                    <ChessTile tile={redMa} size="sm" />
                    <ChessTile tile={redPao} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Black Sequences */}
            <div className="bg-stone-800/80 p-4 rounded-xl border border-emerald-500/10">
              <span className="text-emerald-400 font-bold text-sm block mb-3">🟢 黑方專屬順子</span>
              <div className="space-y-4">
                <div>
                  <span className="text-stone-400 block mb-1">【將士象】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackJiang} size="sm" />
                    <ChessTile tile={blackShi} size="sm" />
                    <ChessTile tile={blackXiang} size="sm" />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【車馬包】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackChe} size="sm" />
                    <ChessTile tile={blackMa} size="sm" />
                    <ChessTile tile={blackBao} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Triples */}
            <div className="bg-stone-800/80 p-4 rounded-xl border border-stone-700 md:col-span-2">
              <span className="text-amber-400 font-bold text-sm block mb-2">⭐ 刻子（同子同色三張，如兵、卒）</span>
              <p className="text-stone-400 mb-3 text-xs">
                在 32 子模式下，只有「兵」與「卒」有 5 張，因此只有兵、卒可以湊出刻子。在 56 與 64 子模式下，其餘棋子各加倍，亦可湊出刻子：
              </p>
              <div className="flex flex-wrap gap-8">
                <div>
                  <span className="text-stone-400 block mb-1">【兵兵兵】刻子：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redBin} size="sm" />
                    <ChessTile tile={redBin} size="sm" />
                    <ChessTile tile={redBin} size="sm" />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【卒卒卒】刻子：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackZu} size="sm" />
                    <ChessTile tile={blackZu} size="sm" />
                    <ChessTile tile={blackZu} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Eat / Pong / Kong */}
        <div>
          <h3 className="text-lg font-semibold text-amber-300 mb-2 font-serif">3. 上碰槓機制</h3>
          <ul className="list-disc pl-5 text-stone-300 text-sm space-y-2">
            <li><b>吃牌 (Eat/Chow)</b>：當你的對手打出一張牌，而你可以和自己手上的兩張牌拼成上述順子（如持有「帥、仕」吃「相」）時，即可稱「吃」。</li>
            <li><b>碰牌 (Pong)</b>：當任意角色打出一張牌，你手中已有兩張一模一樣的牌時，可以喊「碰」並亮在桌面上形成刻子。</li>
            <li><b>槓牌 (Kong)</b>：當你手中有三張相同的牌（如三張兵），而有人打出第四張（明槓），或者自摸第四張（暗槓），或是將碰過的牌加上第四張（補槓），可以進行「槓」，隨後需要從牌牆底部<b>補一張牌 (加補)</b>。</li>
          </ul>
        </div>

        {/* Section 4: Scoring Fan table */}
        <div>
          <h3 className="text-lg font-semibold text-amber-300 mb-3 font-serif">4. 計台標準 (Fans Score)</h3>
          <div className="bg-stone-800 rounded-xl overflow-hidden border border-stone-700">
            <table className="min-w-full text-xs text-left text-stone-300">
              <thead className="bg-stone-750 text-amber-400 border-b border-stone-700 font-serif">
                <tr>
                  <th className="px-4 py-3">台數名稱</th>
                  <th className="px-4 py-3">台數</th>
                  <th className="px-4 py-3">達成條件</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700">
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">胡牌 (Winning Base)</td>
                  <td className="px-4 py-3 text-amber-500">1 台</td>
                  <td className="px-4 py-3">成功胡牌的基本台數。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">自摸 (Self-Draw)</td>
                  <td className="px-4 py-3 text-amber-500">1 台</td>
                  <td className="px-4 py-3">自己摸起贏牌所需的最後一張牌。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">門清 (Concealed Hand)</td>
                  <td className="px-4 py-3 text-amber-500">1 台</td>
                  <td className="px-4 py-3">整局不吃、不碰也不槓（暗槓除外），全憑手牌胡牌。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">全紅 (All Red)</td>
                  <td className="px-4 py-3 text-amber-500">4 台</td>
                  <td className="px-4 py-3">胡牌時手牌加亮牌全部都是紅色棋子（帥仕相、車馬炮、兵）。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">全黑 (All Black)</td>
                  <td className="px-4 py-3 text-amber-500">4 台</td>
                  <td className="px-4 py-3">胡牌時手牌加亮牌全部都是黑色棋子（將士象、車馬包、卒）。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">半紅黑 (Half Red Black)</td>
                  <td className="px-4 py-3 text-amber-500">1 台</td>
                  <td className="px-4 py-3">胡牌的搭子中，正好包含紅色與黑色搭子。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">碰碰胡 (All Triples)</td>
                  <td className="px-4 py-3 text-amber-500">2 台</td>
                  <td className="px-4 py-3">胡牌的搭子組合全都是刻子（三重字）。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">兵卒刻組 (Soldier Melds)</td>
                  <td className="px-4 py-3 text-amber-500">1 台</td>
                  <td className="px-4 py-3">手牌或亮牌中含有「兵兵兵」或「卒卒卒」刻子，每組加 1 台。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">對子四組 (Four Pairs)</td>
                  <td className="px-4 py-3 text-amber-500">4 台</td>
                  <td className="px-4 py-3">於56子或64子型，手牌由4對對子組成（共8張牌且門清）。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">五兵全會/五卒將星</td>
                  <td className="px-4 py-3 text-amber-500">8 台</td>
                  <td className="px-4 py-3">於32子型中，手牌剛好由五張「兵」或五張「卒」組成。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">天胡 (Heavenly Win)</td>
                  <td className="px-4 py-3 text-amber-500">8 台</td>
                  <td className="px-4 py-3">莊家起手發完牌剛好胡牌。</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-stone-200">地胡 (Earthly Win)</td>
                  <td className="px-4 py-3 text-amber-500">8 台</td>
                  <td className="px-4 py-3">閒家在莊家丟出第一張牌即宣告胡牌（胡他人打的第一張牌）。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Play Counts Info */}
        <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/40 text-xs text-stone-300">
          <span className="text-amber-400 font-bold block mb-1">🎮 棋子總數模式差異：</span>
          <p>
            • <b>32子模式</b>：僅完整一副象棋（紅16黑16）。適合2人，胡牌需要 5 張牌（1順組/刻組 ＋ 1對子 或 5張兵/卒）。<br />
            • <b>56子模式</b>：每個兵/卒/仕/相等全數均增或均勻分布至 4 張。適合4人，胡牌需要 8 張牌（2順組/刻組/槓組 ＋ 1對子 或 對子四組）。<br />
            • <b>64子模式</b>：完整的兩副象棋棋子，胡牌規則與56子相同，碰牌率最高！
          </p>
        </div>
      </div>
    </div>
  );
};
