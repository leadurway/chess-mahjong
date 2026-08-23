import React, { createContext, useContext, useEffect, useState, type RefObject } from 'react';

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

// Within 'iphone'/'ipad' there are two named size tiers: a "primary" reference device (iPhone
// 14 Pro / iPad) whose layout is already hand-tuned, and a "secondary" device (iPhone 11 / iPad
// mini) that should reuse the primary's settings, scaled to fit. There's no reliable UA signal
// for exact phone/tablet MODEL (Mobile Safari's UA doesn't name it), so this is detected once,
// like detectDeviceType, from window.screen's shorter side (stable across orientation, unlike
// innerWidth/innerHeight which can shift with browser chrome) against a threshold sitting
// between the two named devices' point sizes:
//   iphone: iPhone 14 Pro = 393pt, iPhone 11 = 414pt  -> cutoff 400
//   ipad:   iPad mini = 744pt, a full-size iPad = 820pt+ -> cutoff 780
// PC web has no primary/secondary split at all (a resizable desktop window isn't a fixed named
// device), so it's always reported as not-secondary.
function detectIsSecondaryScreenTier(deviceType: DeviceType): boolean {
  if (deviceType === 'pcweb' || typeof window === 'undefined' || !window.screen) return false;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return deviceType === 'iphone' ? shortSide > 400 : shortSide < 780;
}

export function useIsSecondaryScreenTier(): boolean {
  const deviceType = useDeviceType();
  const [isSecondary] = useState<boolean>(() => detectIsSecondaryScreenTier(deviceType));
  return isSecondary;
}

// Reference viewport sizes (CSS points) for the two primary devices, used only by the game
// page's fixed-canvas contain-fit scaling — secondary pages instead measure their own card's
// actual rendered size (see useSecondaryPageScale) rather than working from hardcoded reference
// pixel dimensions.
export const IPHONE_REFERENCE = { portrait: { width: 393, height: 852 }, landscape: { width: 852, height: 393 } };
export const IPAD_REFERENCE = { portrait: { width: 820, height: 1180 }, landscape: { width: 1180, height: 820 } };

// Game-page contain-fit scale: fits a fixed refWidth x refHeight reference canvas into whatever
// the real, live viewport currently is (reactive to resize/orientation change), preserving
// aspect ratio (shrinks OR grows as needed, capped so an oversized desktop monitor doesn't
// balloon the game board to an absurd size). `active` gates whether this computation should run
// at all — callers pass false for the two protected primary-landscape cases so the hook never
// needs to touch those paths.
export function useGameFitScale(refWidth: number, refHeight: number, active: boolean): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active) return;
    const compute = () => {
      const widthScale = window.innerWidth / refWidth;
      const heightScale = window.innerHeight / refHeight;
      setScale(Math.min(widthScale, heightScale, 2.2));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [active, refWidth, refHeight]);
  return active ? scale : 1;
}

// Safety-net correction for the game page: some of the game board's rows have a fixed pixel
// budget (tile size × row count) tuned against an assumed reference device size — on a real
// device whose exact dimensions differ even slightly (a different iPad model, a shorter real
// viewport once the browser's own chrome is accounted for), that fixed budget can genuinely
// overflow its container, clipping whatever's at the bottom. This measures the rendered
// element's own scrollHeight/scrollWidth (which still reports the true, un-clipped content
// extent even under `overflow-hidden`) against its clientHeight/clientWidth and returns a
// SHRINK-ONLY correction (never > 1, so it's a no-op whenever content already fits) meant to be
// multiplied into the outer fit-scale.
export function useSelfFitCorrection(elRef: RefObject<HTMLElement | null>, active: boolean): number {
  const [correction, setCorrection] = useState(1);
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el) return;
    const compute = () => {
      if (el.clientHeight === 0 || el.clientWidth === 0) return;
      const heightRatio = el.clientHeight / el.scrollHeight;
      const widthRatio = el.clientWidth / el.scrollWidth;
      setCorrection(Math.min(1, heightRatio, widthRatio));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [active, elRef]);
  return active ? correction : 1;
}

// Width-only fit scale for "long scrollable document" secondary pages (RuleGuide): unlike
// GameSettings/WinModal's compact single-screen card, a rules document is MEANT to be taller
// than the viewport and scroll — so height must never factor into its scale (feeding a document's
// full, un-clamped scrollHeight into a height-constrained fit, as useSecondaryPageScale below
// does, drags the scale down to a tiny fraction to make the whole thing fit vertically, which is
// wrong here). This only ever fits the card's natural WIDTH to the available viewport width, so
// it reads as large as it can regardless of how tall the content ends up being; the caller is
// still responsible for its own overflow-y-auto/dynamic max-height to make that height scrollable.
// Applies to every device tier, iPhone included — this isn't a "reuse the primary reference's
// tuning" mechanism like useSecondaryPageScale (nothing about a rules document needs protecting
// as an untouched reference), it's purely "use the available width", which iPhone benefits from
// just as much: without this, the card sits at its raw padded natural width (max-w-4xl capped by
// the backdrop's own p-4), leaving iPhone portrait using only ~92% of the screen width while
// other tiers — already covered by this same formula — reach ~97%.
export function useWidthFitScale(cardRef: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const compute = () => {
      const naturalWidth = el.offsetWidth;
      if (naturalWidth === 0) return;
      setScale(Math.min((window.innerWidth - 24) / naturalWidth, 2.2));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [cardRef]);
  return scale;
}

// Shared scale computation for secondary pages (GameSettings/WinModal): measures a
// card element's own natural (unscaled) size via offsetWidth/offsetHeight — unaffected by the
// transform the caller applies, so safe to re-measure without any feedback loop — then compares
// it against the available space according to this device's tier:
//   iPhone primary (Pro14): always scale 1 (landscape relies on the page's own scroll/overflow
//     to absorb whatever the portrait-tuned card doesn't fit — "collapse to portrait" happens
//     for free since the card is always rendered at its fixed portrait-tuned classes anyway).
//   iPhone secondary (11): genuine contain-fit against the real, orientation-aware viewport, no
//     floor (11 is only ~5% bigger than Pro14 either way, but shrinking must be allowed on
//     principle rather than assumed away).
//   iPad primary (full-size): LOCKED to portrait dimensions regardless of actual orientation
//     (`[min(w,h), max(w,h)]`) with a floor of 1 (never shrinks) — this is the already-shipped,
//     already-verified GameSettings behavior for iPad, preserved as-is; landscape's shortfall is
//     absorbed by the caller's own scroll mechanism.
//   iPad secondary (mini): ALSO locked to its own portrait dimensions regardless of actual
//     orientation (mini-landscape reuses mini-portrait's settings, scrollable for the shortfall —
//     same pattern as the primary-iPad case above, just with no floor, since a mini is ~9%
//     smaller than a full iPad and must be allowed to genuinely shrink to fit).
//   pcweb: genuine contain-fit against the real, orientation-aware viewport, floor of 1 (already-
//     shipped behavior — an arbitrary desktop window is usually bigger than the phone-tuned
//     card, so this only ever upscales in practice, but the floor is kept for parity with the
//     previously-verified behavior).
export function useSecondaryPageScale(cardRef: RefObject<HTMLElement | null>): {
  scale: number;
  natural: { width: number; height: number };
} {
  const deviceType = useDeviceType();
  const isSecondaryTier = useIsSecondaryScreenTier();
  const isLargeScreen = deviceType !== 'iphone';
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isLargeScreen) { setScale(1); return; }
    const el = cardRef.current;
    if (!el) return;
    const compute = () => {
      const naturalWidth = el.offsetWidth;
      // scrollHeight (not offsetHeight) deliberately: some callers (RuleGuide) apply their own
      // scale-dependent max-height/overflow-y-auto to this same element to keep it from visually
      // exceeding the viewport once scaled — offsetHeight would then read back the CAPPED height
      // instead of the true content height, creating a feedback loop with the scale this hook is
      // computing. scrollHeight always reflects the full content height regardless of any
      // overflow clipping, so it's immune to that circularity.
      const naturalHeight = el.scrollHeight;
      if (naturalWidth === 0 || naturalHeight === 0) return;

      let w: number, h: number, floor: number;
      if (deviceType === 'ipad') {
        // iPad (full-size or mini): lock to portrait proportions regardless of actual
        // orientation — landscape reuses portrait's own settings, scrollable for the shortfall.
        // Only the floor differs: a full iPad never shrinks below its natural size; a mini is
        // smaller than the full-iPad-tuned card and must be allowed to.
        w = Math.min(window.innerWidth, window.innerHeight);
        h = Math.max(window.innerWidth, window.innerHeight);
        floor = isSecondaryTier ? 0 : 1;
      } else if (deviceType === 'pcweb') {
        w = window.innerWidth;
        h = window.innerHeight;
        floor = 1;
      } else {
        // iPhone-secondary (11): real, orientation-aware viewport, no floor
        w = window.innerWidth;
        h = window.innerHeight;
        floor = 0;
      }

      const heightScale = (h - 24) / naturalHeight;
      const widthScale = (w - 24) / naturalWidth;
      setScale(Math.max(floor, Math.min(heightScale, widthScale, 2.2)));
      setNatural({ width: naturalWidth, height: naturalHeight });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [isLargeScreen, deviceType, isSecondaryTier, cardRef]);

  return { scale, natural };
}
