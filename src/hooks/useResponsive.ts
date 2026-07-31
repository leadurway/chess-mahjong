import { useEffect, useState } from 'react';

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = () => setIsLandscape(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isLandscape;
}

// Distinguishes tablets/desktop from phones using the SHORTER of the two viewport
// dimensions, so it stays correct across orientation changes (a phone's shorter side is
// its width in portrait or its height in landscape, always well under this threshold; an
// iPad's shorter side — 744px at its smallest, portrait or landscape — is comfortably
// above it, as is any normal desktop browser window).
const LARGE_SCREEN_THRESHOLD_PX = 700;

export function useIsLargeScreen(): boolean {
  const getIsLarge = () =>
    typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) >= LARGE_SCREEN_THRESHOLD_PX;
  const [isLarge, setIsLarge] = useState<boolean>(getIsLarge);
  useEffect(() => {
    const handler = () => setIsLarge(getIsLarge());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isLarge;
}
