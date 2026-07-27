import React from 'react';
import { motion } from 'motion/react';
import { Tile } from '../types';

interface ChessTileProps {
  tile: Tile;
  size?: 'xs' | 'sm' | 'handHalf' | 'hand' | 'md' | 'lg' | 'xl';
  isFaceDown?: boolean;
  /** Hand tile picked for discard: keeps its normal face, adds a yellow glow ring + gentle bounce. */
  isSelected?: boolean;
  isClickable?: boolean;
  /** Exposed meld display: tile renders at 90% with a glowing halo filling the remaining 10%. */
  glow?: 'blue' | 'red';
  onClick?: () => void;
  id?: string;
}

const SIZE_CLASSES: Record<NonNullable<ChessTileProps['size']>, { box: string; font: string }> = {
  xs: { box: 'w-7', font: 'text-xs' },
  sm: { box: 'w-10', font: 'text-lg' },
  // Hand/meld display size: the old "sm" hand size (40px/18px) enlarged by +10%/+20%.
  hand: { box: 'w-11', font: 'text-[22px]' },
  // Half of "hand" — landscape discards (same look as the hand, at half scale).
  handHalf: { box: 'w-[22px]', font: 'text-[11px]' },
  md: { box: 'w-12', font: 'text-xl' },
  lg: { box: 'w-16', font: 'text-3xl' },
  xl: { box: 'w-20', font: 'text-4xl' },
};

export const ChessTile: React.FC<ChessTileProps> = ({
  tile,
  size = 'md',
  isFaceDown = false,
  isSelected = false,
  isClickable = false,
  glow,
  onClick,
  id,
}) => {
  const widthClass = SIZE_CLASSES[size].box;
  const fontClass = SIZE_CLASSES[size].font;
  const isRed = tile.color === 'red';

  const textStyle = isRed ? 'text-[#b91c1c]' : 'text-[#111827]';

  // Face-down back, always sized to fill whatever box contains it (w-full h-full).
  const backContent = (
    <div className="w-full h-full relative rounded-full flex items-center justify-center bg-[#10b981] border-2 border-[#047857] shadow-[inset_0_0_10px_rgba(0,0,0,0.25),0_3px_6px_rgba(0,0,0,0.3)] select-none overflow-hidden">
      <div className="absolute inset-[8%] border border-dashed border-emerald-300/50 rounded-full opacity-60" />
      <span className="text-emerald-100/80 font-serif font-bold select-none" style={{ fontSize: '55%' }}>象</span>
    </div>
  );

  // Face-up card, always sized to fill whatever box contains it (w-full h-full).
  const faceContent = (
    <div
      className={`
        w-full h-full relative rounded-full flex items-center justify-center select-none
        border-2 bg-[#fdfcf0] border-[#d1d5db] transition-shadow
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

  // The outer box defines the actual rendered size.
  const box = glow ? (
    <div className={`${widthClass} aspect-square relative`}>
      <div
        className={`absolute inset-0 rounded-full ${
          glow === 'red'
            ? 'ring-4 ring-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]'
            : 'ring-4 ring-blue-400 shadow-[0_0_12px_4px_rgba(59,130,246,0.65)]'
        }`}
      />
      <div className="absolute inset-[5%]">{inner}</div>
    </div>
  ) : (
    <div className={`${widthClass} aspect-square`}>{inner}</div>
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
