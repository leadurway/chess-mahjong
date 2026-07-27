import React from 'react';
import { motion } from 'motion/react';
import { Tile } from '../types';

interface ChessTileProps {
  tile: Tile;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Fill the parent cell's width (height follows via aspect-square) — for the 8-per-row hand grid. */
  fill?: boolean;
  isFaceDown?: boolean;
  /** Hand tile picked for discard: bright yellow face, black text, glowing ring. */
  isSelected?: boolean;
  isClickable?: boolean;
  /** Exposed meld display: tile renders at 90% with a glowing halo filling the remaining 10%. */
  glow?: 'green' | 'red';
  onClick?: () => void;
  id?: string;
}

const SIZE_CLASSES: Record<NonNullable<ChessTileProps['size']>, { box: string; font: string }> = {
  xs: { box: 'w-7', font: 'text-xs' },
  sm: { box: 'w-10', font: 'text-lg' },
  md: { box: 'w-12', font: 'text-xl' },
  lg: { box: 'w-16', font: 'text-3xl' },
  xl: { box: 'w-20', font: 'text-4xl' },
};

export const ChessTile: React.FC<ChessTileProps> = ({
  tile,
  size = 'md',
  fill = false,
  isFaceDown = false,
  isSelected = false,
  isClickable = false,
  glow,
  onClick,
  id,
}) => {
  const widthClass = fill ? 'w-full' : SIZE_CLASSES[size].box;
  const fontClass = fill ? 'text-2xl' : SIZE_CLASSES[size].font;
  const isRed = tile.color === 'red';

  const textStyle = isSelected ? 'text-black' : isRed ? 'text-[#b91c1c]' : 'text-[#111827]';

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
        border-2 transition-colors
        ${isSelected
          ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_14px_4px_rgba(250,204,21,0.75)] ring-2 ring-yellow-200'
          : 'bg-[#fdfcf0] border-[#d1d5db]'}
      `}
    >
      <div className="absolute inset-[8%] border border-stone-300/40 rounded-full pointer-events-none" />
      <span className={`${fontClass} ${textStyle} font-black leading-none select-none drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]`}>
        {tile.character}
      </span>
    </div>
  );

  const inner = isFaceDown ? backContent : faceContent;

  // The outer box defines the actual rendered size (fixed px via `size`, or 100% of the parent cell via `fill`).
  const box = glow ? (
    <div className={`${widthClass} aspect-square relative`}>
      <div
        className={`absolute inset-0 rounded-full ${
          glow === 'red'
            ? 'ring-4 ring-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]'
            : 'ring-4 ring-emerald-400 shadow-[0_0_12px_4px_rgba(52,211,153,0.65)]'
        }`}
      />
      <div className="absolute inset-[5%]">{inner}</div>
    </div>
  ) : (
    <div className={`${widthClass} aspect-square`}>{inner}</div>
  );

  if (!isClickable) return <div id={id} className={fill ? 'w-full' : undefined}>{box}</div>;

  return (
    <motion.div
      id={id}
      whileHover={{ y: isFaceDown ? -4 : -6, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={fill ? 'w-full cursor-pointer' : 'cursor-pointer'}
    >
      {box}
    </motion.div>
  );
};
