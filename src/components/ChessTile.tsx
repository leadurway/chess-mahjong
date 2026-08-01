import React from 'react';
import { motion } from 'motion/react';
import { Tile } from '../types';

interface ChessTileProps {
  tile: Tile;
  size?: 'xs' | 'sm' | 'handHalf' | 'hand' | 'handLg' | 'md' | 'lg' | 'xl' | 'winReveal';
  /** Overrides `size`'s fixed box width with an exact pixel value — for tiles whose size is
   * computed at render time (e.g. discards sized to make a target row count fit the available
   * height) rather than picked from the fixed named sizes above. Font still scales via the
   * same container-query approach as `winReveal`. */
  sizePx?: number;
  isFaceDown?: boolean;
  /** Hand tile picked for discard: keeps its normal face, adds a yellow glow ring + gentle bounce. */
  isSelected?: boolean;
  isClickable?: boolean;
  /** Exposed meld / winning-tile display: tile stays at full size, with a glow ring overlaid
   * between its own inner and outer border (not a separate outer halo the tile shrinks to fit
   * inside). */
  glow?: 'blue' | 'red';
  onClick?: () => void;
  id?: string;
}

const SIZE_CLASSES: Record<NonNullable<ChessTileProps['size']>, { box: string; font: string }> = {
  xs: { box: 'w-7', font: 'text-xs' },
  sm: { box: 'w-10', font: 'text-lg' },
  // Hand/meld display size: the old "sm" hand size (40px/18px) enlarged by +10%/+20%.
  hand: { box: 'w-11', font: 'text-[22px]' },
  // Half of "hand" — landscape discards on phones (same look as the hand, at half scale).
  handHalf: { box: 'w-[22px]', font: 'text-[11px]' },
  // Double "hand" — iPad/desktop hand, melds, and discards all use this instead, since the
  // extra screen space means nothing needs to shrink to fit.
  handLg: { box: 'w-[88px]', font: 'text-[44px]' },
  md: { box: 'w-12', font: 'text-xl' },
  lg: { box: 'w-16', font: 'text-3xl' },
  xl: { box: 'w-20', font: 'text-4xl' },
  // Win-modal hand reveal: fluid width (the grid column, not a fixed px, sets the actual size)
  // so the row always fills its container exactly with no leftover side gaps on any screen,
  // and the character scales with it via a container-query font size.
  winReveal: { box: 'w-full', font: 'text-[45cqw]' },
};

export const ChessTile: React.FC<ChessTileProps> = ({
  tile,
  size = 'md',
  sizePx,
  isFaceDown = false,
  isSelected = false,
  isClickable = false,
  glow,
  onClick,
  id,
}) => {
  const widthClass = sizePx ? '' : SIZE_CLASSES[size].box;
  const fontClass = sizePx ? 'text-[45cqw]' : SIZE_CLASSES[size].font;
  const boxStyle = sizePx ? { width: `${sizePx}px`, height: `${sizePx}px` } : undefined;
  const isRed = tile.color === 'red';

  const textStyle = isRed ? 'text-[#b91c1c]' : 'text-[#111827]';

  // Face-down back: a traditional dark navy tile back with a woven diamond-lattice pattern
  // (in place of the old plain blue concentric-circle look), framed by a thin gold trim ring.
  const backContent = (
    <div className="w-full h-full relative rounded-full flex items-center justify-center bg-gradient-to-br from-[#1b2a4a] to-[#0a1226] border-2 border-[#060b18] shadow-[inset_0_0_10px_rgba(0,0,0,0.5),0_3px_6px_rgba(0,0,0,0.3)] select-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(148,163,184,0.22) 3px, rgba(148,163,184,0.22) 4px), repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(148,163,184,0.22) 3px, rgba(148,163,184,0.22) 4px)',
        }}
      />
      <div className="absolute inset-[10%] rounded-full border border-amber-200/40" />
    </div>
  );

  // Face-up card, always sized to fill whatever box contains it (w-full h-full). `@container`
  // lets the character span below use a container-query font size, so it scales correctly
  // even when this tile's own box is fluid-width (e.g. a CSS grid column) rather than fixed px.
  const faceContent = (
    <div
      className={`
        w-full h-full relative rounded-full flex items-center justify-center select-none
        border-2 bg-[#fdfcf0] border-[#d1d5db] transition-shadow @container
        ${isSelected ? 'ring-4 ring-yellow-400 shadow-[0_0_14px_4px_rgba(250,204,21,0.75)]' : ''}
      `}
    >
      <div className="absolute inset-[8%] border border-red-950/50 rounded-full pointer-events-none" />
      <span className={`${fontClass} ${textStyle} font-black leading-none select-none drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]`}>
        {tile.character}
      </span>
    </div>
  );

  const inner = isFaceDown ? backContent : faceContent;

  // The outer box defines the actual rendered size — the tile itself always fills it fully,
  // glow or not. Kong's center tile (red glow) gets a z-index bump so its ring + glow shadow —
  // which visually overflow past this tile's own box — render above the neighboring flanking
  // tiles instead of being clipped underneath them (adjacent flex/grid siblings otherwise
  // paint on top per DOM order).
  const box = (
    <div className={`${widthClass} aspect-square relative ${glow === 'red' ? 'z-10' : ''}`} style={boxStyle}>
      {inner}
      {glow && (
        <div
          className={`absolute inset-[3%] rounded-full pointer-events-none ${
            glow === 'red'
              ? 'ring-4 ring-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]'
              : 'ring-4 ring-blue-400 shadow-[0_0_12px_4px_rgba(59,130,246,0.65)]'
          }`}
        />
      )}
    </div>
  );

  if (!isClickable) return <div id={id}>{box}</div>;

  return (
    <motion.div
      id={id}
      animate={isSelected ? { y: [0, -4, 0] } : { y: 0 }}
      transition={isSelected ? { repeat: Infinity, duration: 1 } : { duration: 0.15 }}
      whileHover={{ y: isFaceDown ? -4 : -6, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      {box}
    </motion.div>
  );
};
