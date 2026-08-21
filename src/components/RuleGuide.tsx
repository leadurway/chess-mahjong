import React, { useRef } from 'react';
import { ChessTile } from './ChessTile';
import { Tile } from '../types';
import { useIsLargeScreen, useSecondaryPageScale } from '../hooks/useResponsive';

interface RuleGuideProps {
  onClose?: () => void;
}

export const RuleGuide: React.FC<RuleGuideProps> = ({ onClose }) => {
  // Driven entirely by the device-tier boolean (not CSS `md:` breakpoints) so a phone in
  // landscape — whose viewport width comfortably exceeds Tailwind's 768px `md:` cutoff — still
  // gets the phone-tuned sizing rather than accidentally triggering the tablet-tuned one.
  const isLargeScreen = useIsLargeScreen();
  const demoTileSize = isLargeScreen ? 'lg' : 'sm';
  const rootPadClass = isLargeScreen ? 'p-10' : 'p-6';
  const rootMaxWidthClass = isLargeScreen ? 'max-w-6xl' : 'max-w-4xl';
  const headerTitleClass = isLargeScreen ? 'text-4xl' : 'text-2xl';
  const closeBtnClass = isLargeScreen ? 'px-5 py-2 text-xl' : 'px-3 py-1';
  const sectionHeadingClass = isLargeScreen ? 'text-2xl' : 'text-lg';
  const bodyTextClass = isLargeScreen ? 'text-lg' : 'text-sm';
  const cardPadClass = isLargeScreen ? 'p-6' : 'p-4';
  const smallTextClass = isLargeScreen ? 'text-base' : 'text-xs';
  const gridColsClass = isLargeScreen ? 'grid-cols-2' : 'grid-cols-1';
  const colSpan2Class = isLargeScreen ? 'col-span-2' : '';
  const subHeadingClass = isLargeScreen ? 'text-xl' : 'text-sm';
  const tableCellPadClass = isLargeScreen ? 'px-6 py-4' : 'px-4 py-3';

  // Card scale per device tier (see useSecondaryPageScale). The card's own max-height must be
  // computed in the UNSCALED coordinate space (transform doesn't feed back into layout/height,
  // so a fixed "85dvh" cap combined with an extra upscale would visually exceed the viewport
  // with no way to reach the excess) — dividing by scale keeps the VISUAL result capped at 85%
  // of the viewport regardless of scale, while the card's own overflow-y-auto (unchanged from
  // before) keeps handling the actual scrolling, exactly as it always has.
  const cardRef = useRef<HTMLDivElement>(null);
  const { scale } = useSecondaryPageScale(cardRef);
  const maxHeightPx = (typeof window !== 'undefined' ? window.innerHeight * 0.85 : 900) / scale;

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
    <div
      ref={cardRef}
      className={`bg-stone-900/95 text-stone-100 ${rootPadClass} rounded-2xl border border-amber-500/20 ${rootMaxWidthClass} w-full mx-auto shadow-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-stone-700`}
      style={{ maxHeight: `${maxHeightPx}px`, transform: `scale(${scale})` }}
    >
      <div className="flex justify-between items-center mb-6 border-b border-amber-500/20 pb-4">
        <h2 className={`${headerTitleClass} font-bold font-serif text-amber-400 flex items-center gap-2`}>
          🀄 象棋麻將 遊戲規則說明
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className={`text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 font-bold ${closeBtnClass} rounded-lg transition`}
          >
            關閉
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* Section 1: Introduction */}
        <div>
          <h3 className={`${sectionHeadingClass} font-semibold text-amber-300 mb-2 font-serif`}>1. 象棋麻將簡介與模式細則</h3>
          <p className={`text-stone-300 ${bodyTextClass} leading-relaxed space-y-1`}>
            象棋麻將結合了傳統<b>中國象棋棋子</b>與<b>麻將摸打玩法的快速博弈遊戲</b>。依據子數模式不同，玩法與胡牌組合均有所調整：
          </p>
          <div className={`bg-stone-800/60 ${cardPadClass} rounded-xl border border-amber-500/10 ${smallTextClass} mt-3 space-y-2`}>
            <p>🀄 <b>三塊二子型 (32子)</b>：紅黑象棋各一套。適合2人，莊家摸 5 張，閒家摸 4 張。胡牌需湊齊「<b>一組面子 ＋ 一對對子</b>」（共5張），例如：<b>＜順子 ＋ 對子＞、＜刻子 ＋ 對子＞</b>，或特殊牌型：<b>＜五兵（卒）＞</b>。</p>
            <p>🀄 <b>五十六子型 (56子)</b>：將到卒、帥到兵每種牌各 4 張。適合4人，莊家摸 8 張，閒家摸 7 張。胡牌需湊齊「<b>兩組面子 ＋ 一對對子</b>」（共8張），例如：<b>＜兩組面子 ＋ 對子＞</b>，或特殊牌型：<b>＜對子四組 (4對)＞</b>。</p>
            <p>🀄 <b>六十四子型 (64子)</b>：即32子型的兩倍數。玩法、胡牌組合同56子型（兩面子 ＋ 一對對子 或 四對子，共8張）。</p>
            <p className="text-amber-400 font-semibold mt-1">💡 將眼與對子：對子可由兩張相同牌面組成，此外「帥」字與「將」字亦可跨色湊成一對對子！</p>
          </div>
        </div>

        {/* Section 2: Winning Hands / Melds */}
        <div>
          <h3 className={`${sectionHeadingClass} font-semibold text-amber-300 mb-3 font-serif`}>2. 合法面子（搭子）組合</h3>
          <p className={`text-stone-300 ${bodyTextClass} mb-4`}>
            「面子（搭子）」係指由三張牌構成的組合，分為「同色順子」與「同色刻子（三張相同）」：
          </p>

          <div className={`grid ${gridColsClass} gap-6 ${smallTextClass}`}>
            {/* Red Sequences */}
            <div className={`bg-stone-800/80 ${cardPadClass} rounded-xl border border-red-500/10`}>
              <span className={`text-red-400 font-bold ${bodyTextClass} block mb-3`}>🔴 紅方專屬順子</span>
              <div className="space-y-4">
                <div>
                  <span className="text-stone-400 block mb-1">【帥仕相】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redShuai} size={demoTileSize} />
                    <ChessTile tile={redShi} size={demoTileSize} />
                    <ChessTile tile={redXiang} size={demoTileSize} />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【車馬炮】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redChe} size={demoTileSize} />
                    <ChessTile tile={redMa} size={demoTileSize} />
                    <ChessTile tile={redPao} size={demoTileSize} />
                  </div>
                </div>
              </div>
            </div>

            {/* Black Sequences */}
            <div className={`bg-stone-800/80 ${cardPadClass} rounded-xl border border-emerald-500/10`}>
              <span className={`text-emerald-400 font-bold ${bodyTextClass} block mb-3`}>🟢 黑方專屬順子</span>
              <div className="space-y-4">
                <div>
                  <span className="text-stone-400 block mb-1">【將士象】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackJiang} size={demoTileSize} />
                    <ChessTile tile={blackShi} size={demoTileSize} />
                    <ChessTile tile={blackXiang} size={demoTileSize} />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【車馬包】組合：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackChe} size={demoTileSize} />
                    <ChessTile tile={blackMa} size={demoTileSize} />
                    <ChessTile tile={blackBao} size={demoTileSize} />
                  </div>
                </div>
              </div>
            </div>

            {/* Triples */}
            <div className={`bg-stone-800/80 ${cardPadClass} rounded-xl border border-stone-700 ${colSpan2Class}`}>
              <span className={`text-amber-400 font-bold ${bodyTextClass} block mb-2`}>⭐ 刻子（同子同色三張，如兵、卒）</span>
              <p className={`text-stone-400 mb-3 ${smallTextClass}`}>
                在 32 子模式下，只有「兵」與「卒」有 5 張，因此只有兵、卒可以湊出刻子。在 56 與 64 子模式下，其餘棋子各加倍，亦可湊出刻子：
              </p>
              <div className="flex flex-wrap gap-8">
                <div>
                  <span className="text-stone-400 block mb-1">【兵兵兵】刻子：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={redBin} size={demoTileSize} />
                    <ChessTile tile={redBin} size={demoTileSize} />
                    <ChessTile tile={redBin} size={demoTileSize} />
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">【卒卒卒】刻子：</span>
                  <div className="flex gap-2">
                    <ChessTile tile={blackZu} size={demoTileSize} />
                    <ChessTile tile={blackZu} size={demoTileSize} />
                    <ChessTile tile={blackZu} size={demoTileSize} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Eat / Pong / Kong */}
        <div>
          <h3 className={`${sectionHeadingClass} font-semibold text-amber-300 mb-2 font-serif`}>3. 上碰槓機制</h3>
          <ul className={`list-disc pl-5 text-stone-300 ${bodyTextClass} space-y-2`}>
            <li><b>吃牌 (Eat/Chow)</b>：當你的對手打出一張牌，而你可以和自己手上的兩張牌拼成上述順子（如持有「帥、仕」吃「相」）時，即可稱「吃」。</li>
            <li><b>碰牌 (Pong)</b>：當任意角色打出一張牌，你手中已有兩張一模一樣的牌時，可以喊「碰」並亮在桌面上形成刻子。</li>
            <li><b>槓牌 (Kong)</b>：當你手中有三張相同的牌（如三張兵），而有人打出第四張（明槓），或者自摸第四張（暗槓），或是將碰過的牌加上第四張（補槓），可以進行「槓」，隨後需要從牌牆底部<b>補一張牌 (加補)</b>。</li>
          </ul>
        </div>

        {/* Section 4: Scoring Fan table — 32/56/64 子型各自獨立的台數表，對應
            src/utils/gameEngine.ts 的 calculateFans()。三種模式的牌型結構不同（32子僅
            1組面子＋眼睛；56/64子有2組面子＋眼睛），能達成的台數項目也因此不同，而非單純數值
            差異，所以分成三張表格，不合併成一張表。 */}
        <div>
          <h3 className={`${sectionHeadingClass} font-semibold text-amber-300 mb-2 font-serif`}>4. 計台標準 (Fans Score)</h3>
          <p className={`text-stone-300 ${bodyTextClass} mb-4`}>
            結算金額 = 底額 + (總台數 × 每台金額)。「連莊」為本局獨有規則（因僅玩家與電腦兩方對戰）：現任莊家每連莊一次即加
            1 台，不論該局是莊家胡牌或被閒家胡，都會計入台數。
          </p>

          <h4 className={`text-amber-300/90 font-semibold mb-2 font-serif ${subHeadingClass}`}>32 子型（經典傳統，1組面子＋1對眼睛）</h4>
          <div className="bg-stone-800 rounded-xl overflow-hidden border border-stone-700 mb-6">
            <table className={`min-w-full ${smallTextClass} text-left text-stone-300`}>
              <thead className="bg-stone-750 text-amber-400 border-b border-stone-700 font-serif">
                <tr>
                  <th className={tableCellPadClass}>台數名稱</th>
                  <th className={tableCellPadClass}>台數</th>
                  <th className={tableCellPadClass}>達成條件</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700">
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>胡牌</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>成功胡牌的基本台數。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>莊家</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>本局身為莊家，不論胡牌或放槍給閒家都加計。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>清一色</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>胡牌手牌全為紅棋或全為黑棋。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>海底撈月</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>摸進牌牆最後一張牌，或開槓補牌後自摸胡牌。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>自摸</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>自己摸進最後一張胡牌棋子。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>將帥聽令</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>胡牌時的眼睛（對子）為「將」或「帥」。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>五兵合縱／五卒連橫</td><td className={`${tableCellPadClass} text-amber-500`}>5 台</td><td className={tableCellPadClass}>手牌直接集齊 5 張同色的「兵」或「卒」（無視面子結構直接胡牌）。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>天胡</td><td className={`${tableCellPadClass} text-amber-500`}>6 台</td><td className={tableCellPadClass}>莊家起手配牌即完成胡牌。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>地胡</td><td className={`${tableCellPadClass} text-amber-500`}>6 台</td><td className={tableCellPadClass}>閒家在第一巡摸進第一張棋子時即自摸胡牌。</td></tr>
              </tbody>
            </table>
          </div>

          <h4 className={`text-amber-300/90 font-semibold mb-2 font-serif ${subHeadingClass}`}>56 / 64 子型（多張型，2組面子＋1對眼睛）</h4>
          <p className={`text-stone-400 ${smallTextClass} mb-2`}>
            56子型每種棋各 4 張；64子型為兩副完整棋（每色兵/卒各 10 張），因此「五兵合縱／五卒連橫」與「八家將」只有 64
            子型才可能湊到、56子型不會出現。
          </p>
          <div className="bg-stone-800 rounded-xl overflow-hidden border border-stone-700">
            <table className={`min-w-full ${smallTextClass} text-left text-stone-300`}>
              <thead className="bg-stone-750 text-amber-400 border-b border-stone-700 font-serif">
                <tr>
                  <th className={tableCellPadClass}>台數名稱</th>
                  <th className={tableCellPadClass}>56子</th>
                  <th className={tableCellPadClass}>64子</th>
                  <th className={tableCellPadClass}>達成條件</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700">
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>胡牌／清一色</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>基礎胡牌台數；或整副手牌皆為同一顏色。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>門清／自摸</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>全程無吃碰槓（暗槓除外）自摸；或自己摸進胡牌張。兩者各自獨立計台。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>槓上開花／海底撈月</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>開槓補牌自摸，或摸進牌牆最後一張自摸。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>斷頭尾</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={`${tableCellPadClass} text-amber-500`}>1 台</td><td className={tableCellPadClass}>整副胡牌手牌中完全沒有「將、帥、兵、卒」。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>碰碰胡／二槓子</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>手牌面子全部為刻子，或擁有兩組槓子。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>將帥領兵</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>整副手牌僅由「將／帥」與「兵／卒」兩種棋子組成。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>雙龍抱／一條龍</td><td className={`${tableCellPadClass} text-amber-500`}>4 台</td><td className={`${tableCellPadClass} text-amber-500`}>4 台</td><td className={tableCellPadClass}>兩組面子為完全相同的順子；或將士象＋車馬包（或帥仕相＋俥傌炮）全齊。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>五兵合縱／五卒連橫</td><td className={`${tableCellPadClass} text-stone-500`}>－</td><td className={`${tableCellPadClass} text-amber-500`}>2 台</td><td className={tableCellPadClass}>手牌中擁有 5～7 張同色的兵或卒（一組面子加眼睛湊成）。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>八家將（極限牌型）</td><td className={`${tableCellPadClass} text-stone-500`}>－</td><td className={`${tableCellPadClass} text-amber-500`}>8 台</td><td className={tableCellPadClass}>集齊 8 張同色的兵或卒（僅 64 子雙副棋型可能出現）。</td></tr>
                <tr><td className={`${tableCellPadClass} font-semibold text-stone-200`}>天胡／地胡</td><td className={`${tableCellPadClass} text-amber-500`}>8 台</td><td className={`${tableCellPadClass} text-amber-500`}>8 台</td><td className={tableCellPadClass}>起手配牌即完成胡牌，或閒家第一巡摸牌自摸。</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Play Counts Info */}
        <div className={`bg-amber-950/20 ${cardPadClass} rounded-xl border border-amber-900/40 ${smallTextClass} text-stone-300`}>
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
