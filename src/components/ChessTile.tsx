import React from 'react';
import { motion } from 'motion/react';
import { Tile } from '../types';

interface ChessTileProps {
  tile: Tile;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isFaceDown?: boolean;
  isSelected?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  id?: string;
}

export const ChessTile: React.FC<ChessTileProps> = ({
  tile,
  size = 'md',
  isFaceDown = false,
  isSelected = false,
  isClickable = false,
  onClick,
  id,
}) => {
  const getSizing = () => {
    switch (size) {
      case 'sm':
        return {
          width: 'w-10 h-14',
          fontSize: 'text-lg',
          charPadding: 'p-1',
          ringSize: 'ring-1',
        };
      case 'lg':
        return {
          width: 'w-16 h-22',
          fontSize: 'text-3xl',
          charPadding: 'p-2',
          ringSize: 'ring-2',
        };
      case 'xl':
        return {
          width: 'w-20 h-28',
          fontSize: 'text-4xl',
          charPadding: 'p-3',
          ringSize: 'ring-3',
        };
      case 'md':
    default:
        return {
          width: 'w-12 h-18',
          fontSize: 'text-2xl',
          charPadding: 'p-1.5',
          ringSize: 'ring-2',
        };
    }
  };

  const dims = getSizing();
  const isRed = tile.color === 'red';

  // Character style - Red side uses crimson red (#b91c1c), Black side uses deep charcoal (#111827)
  const textStyle = isRed
    ? 'text-[#b91c1c] font-black drop-shadow-[0_1px_0_rgba(255,255,255,1)] font-sans'
    : 'text-[#111827] font-black drop-shadow-[0_1px_0_rgba(255,255,255,1)] font-sans';

  // Inner ring accent
  const innerRingStyle = isRed
    ? 'border-red-100 bg-red-50/30'
    : 'border-stone-200 bg-stone-50/20';

  if (isFaceDown) {
    return (
      <motion.div
        id={id}
        whileHover={isClickable ? { y: -4, scale: 1.05 } : {}}
        whileTap={isClickable ? { scale: 0.95 } : {}}
        onClick={isClickable ? onClick : undefined}
        className={`
          ${dims.width} 
          relative rounded-[6px] flex flex-col items-center justify-center
          bg-[#10b981] border-2 border-[#047857] shadow-[inset_0_0_10px_rgba(0,0,0,0.25),0_4px_6px_rgba(0,0,0,0.3)]
          cursor-default select-none overflow-hidden
        `}
      >
        {/* Elegant geometric pattern on the back of mahjong tiles */}
        <div className="absolute inset-1 border border-emerald-400/40 rounded flex items-center justify-center opacity-40">
          <div className="w-5 h-5 border border-dashed border-emerald-300 rounded-full rotate-45 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-200 rounded-full"></div>
          </div>
        </div>
        <div className="text-[10px] text-emerald-100/75 font-serif font-bold scale-75 rotate-90 leading-none">象</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      whileHover={isClickable ? { y: -8, scale: 1.05, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' } : {}}
      whileTap={isClickable ? { scale: 0.95 } : {}}
      animate={{
        y: isSelected ? -12 : 0,
        boxShadow: isSelected 
          ? '0 12px 20px -5px rgba(245,158,11,0.5), 0 4px 6px -2px rgba(245,158,11,0.3)' 
          : '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={isClickable ? onClick : undefined}
      className={`
        ${dims.width} 
        relative rounded-[6px] flex flex-col items-center justify-between
        bg-[#fdfcf0] border-r-2 border-b-4 border-[#d1d5db] border-l border-t border-stone-200/50 select-none
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-amber-500 border-amber-400' : ''}
      `}
    >
      {/* Decorative Traditional Border Ring inside */}
      <div className="absolute inset-1 border border-stone-300/35 rounded-[4px] pointer-events-none"></div>

      {/* Main Character Display directly centered */}
      <div className="flex-1 flex items-center justify-center w-full z-10">
        <span className={`${dims.fontSize} ${textStyle} select-none font-black leading-none`}>
          {tile.character}
        </span>
      </div>

      {/* Subtle indicator of role name at the very bottom corner */}
      <div className={`text-[8.5px] mb-1.5 opacity-40 font-mono font-bold leading-none ${isRed ? 'text-rose-900' : 'text-stone-900'}`}>
        {tile.color.toUpperCase()}
      </div>
    </motion.div>
  );
};
