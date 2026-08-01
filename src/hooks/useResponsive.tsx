import React, { createContext, useContext, useEffect, useState } from 'react';

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

export type DeviceType = 'iphone' | 'ipad' | 'pcweb';

// Detected ONCE, from the actual device/platform — not from the current window size — so
// every page's layout (lobby, rules, game screen, win modal) agrees on the same
// iPhone/iPad/PC-web classification for the whole session. Resizing a desktop browser window
// narrower, for instance, must NOT suddenly switch it to phone-style layout; only rotating an
// actual iPhone/iPad changes anything, and that's handled separately by useIsLandscape.
export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'pcweb';
  const ua = navigator.userAgent || '';
  if (/iPad/.test(ua)) return 'ipad';
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  // iPadOS 13+ Safari reports itself as "Macintosh" (desktop-class UA) — the only reliable way
  // to tell it apart from an actual Mac is that a real Mac has no touch points.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ipad';
  return 'pcweb';
}

const DeviceTypeContext = createContext<DeviceType>('pcweb');

export const DeviceTypeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceType] = useState<DeviceType>(() => detectDeviceType());
  return <DeviceTypeContext.Provider value={deviceType}>{children}</DeviceTypeContext.Provider>;
};

export function useDeviceType(): DeviceType {
  return useContext(DeviceTypeContext);
}

// iPad and PC web get the enlarged/"large screen" treatment; iPhone doesn't — derived from
// the one-time device detection above rather than the current viewport size.
export function useIsLargeScreen(): boolean {
  return useDeviceType() !== 'iphone';
}
