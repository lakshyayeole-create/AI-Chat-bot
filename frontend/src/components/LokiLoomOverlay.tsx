import React, { useState, useEffect, useMemo } from 'react';
import './LokiLoomOverlay.css';

export interface LoomItem {
  id: string;
  branchCode: string;
  title: string;
  tag: string;
  images: string[];
  cardPosClass: string;
  eventUrl?: string;
  // Scroll threshold intervals (0.0 to 1.0)
  threadStart: number;
  threadEnd: number;
  cardStart: number;
  cardEnd: number;
}

const LOOM_ITEMS: LoomItem[] = [
  // ── LEFT COLUMN (Top, Middle, Bottom) ──
  {
    id: 'loom-1',
    branchCode: 'BRANCH α-01',
    title: 'Codigo Competitive Programming',
    tag: 'CODING ARENA',
    images: [
      '/gallery/codigo/codigo-1.jpg',
      '/gallery/codigo/codigo-2.jpg',
      '/gallery/codigo/codigo-3.jpg',
      '/gallery/codigo/codigo-4.jpg',
      '/gallery/codigo/codigo-5.jpg',
      '/gallery/codigo/codigo-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-1', // Left Top
    threadStart: 0.00,
    threadEnd: 0.20,
    cardStart: 0.10,
    cardEnd: 0.22,
  },
  {
    id: 'loom-3',
    branchCode: 'BRANCH γ-03',
    title: 'SheSolves Innovation Arena',
    tag: 'WOMEN IN TECH',
    images: [
      '/gallery/shesolves/shesolves-1.jpg',
      '/gallery/shesolves/shesolves-2.jpg',
      '/gallery/shesolves/shesolves-3.jpg',
      '/gallery/shesolves/shesolves-4.jpg',
      '/gallery/shesolves/shesolves-5.jpg',
      '/gallery/shesolves/shesolves-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-3', // Left Middle
    threadStart: 0.16,
    threadEnd: 0.36,
    cardStart: 0.26,
    cardEnd: 0.38,
  },
  {
    id: 'loom-2',
    branchCode: 'BRANCH β-02',
    title: 'IoThrone Hardware & Robotics',
    tag: 'ROBOTICS & IOT',
    eventUrl: 'https://iothrone.vercel.app/',
    images: [
      '/gallery/iothrone/iothrone-1.jpg',
      '/gallery/iothrone/iothrone-2.jpg',
      '/gallery/iothrone/iothrone-3.jpg',
      '/gallery/iothrone/iothrone-4.jpg',
      '/gallery/iothrone/iothrone-5.jpg',
      '/gallery/iothrone/iothrone-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-2', // Left Bottom
    threadStart: 0.32,
    threadEnd: 0.52,
    cardStart: 0.42,
    cardEnd: 0.54,
  },

  // ── RIGHT COLUMN (Top, Middle, Bottom) ──
  {
    id: 'loom-4',
    branchCode: 'BRANCH δ-04',
    title: 'DecentraHack Web3 Hackathon',
    tag: 'WEB3 & BLOCKCHAIN',
    images: [
      '/gallery/decentrahack/decentrahack-1.jpg',
      '/gallery/decentrahack/decentrahack-2.jpg',
      '/gallery/decentrahack/decentrahack-3.jpg',
      '/gallery/decentrahack/decentrahack-4.jpg',
      '/gallery/decentrahack/decentrahack-5.jpg',
      '/gallery/decentrahack/decentrahack-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-4', // Right Top
    threadStart: 0.48,
    threadEnd: 0.68,
    cardStart: 0.58,
    cardEnd: 0.70,
  },
  {
    id: 'loom-6',
    branchCode: 'BRANCH ζ-06',
    title: 'MasterChef UI Design Arena',
    tag: 'UI/UX DESIGN',
    eventUrl: 'https://masterchefui-gdgc.vercel.app/',
    images: [
      '/gallery/masterchef-ui/masterchef-ui-1.jpg',
      '/gallery/masterchef-ui/masterchef-ui-2.jpg',
      '/gallery/masterchef-ui/masterchef-ui-3.jpg',
      '/gallery/masterchef-ui/masterchef-ui-4.jpg',
      '/gallery/masterchef-ui/masterchef-ui-5.jpg',
      '/gallery/masterchef-ui/masterchef-ui-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-6', // Right Middle
    threadStart: 0.64,
    threadEnd: 0.84,
    cardStart: 0.74,
    cardEnd: 0.86,
  },
  {
    id: 'loom-5',
    branchCode: 'BRANCH ε-05',
    title: 'ByteMe Cybersecurity CTF Arena',
    tag: 'CYBERSECURITY',
    eventUrl: 'https://bytemectf.owasppccoe.in/',
    images: [
      '/gallery/byteme-ctf/byteme-ctf-1.jpg',
      '/gallery/byteme-ctf/byteme-ctf-2.jpg',
      '/gallery/byteme-ctf/byteme-ctf-3.jpg',
      '/gallery/byteme-ctf/byteme-ctf-4.jpg',
      '/gallery/byteme-ctf/byteme-ctf-5.jpg',
      '/gallery/byteme-ctf/byteme-ctf-6.jpg',
    ],
    cardPosClass: 'loom-card-pos-5', // Right Bottom
    threadStart: 0.80,
    threadEnd: 1.00,
    cardStart: 0.88,
    cardEnd: 1.00,
  },
];

export interface GalleryPhoto {
  id: string;
  url: string;
  title: string;
  branchCode: string;
  tag: string;
}

const EXTRA_GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 'inaug-1', url: '/gallery/inauguration/inauguration-1.jpg', title: 'Grand Inauguration & Keynote', branchCode: 'KEYNOTE', tag: 'CEREMONY' },
  { id: 'inaug-2', url: '/gallery/inauguration/inauguration-2.jpg', title: 'Grand Inauguration & Keynote', branchCode: 'KEYNOTE', tag: 'CEREMONY' },
  { id: 'inaug-3', url: '/gallery/inauguration/inauguration-3.jpg', title: 'Grand Inauguration & Keynote', branchCode: 'KEYNOTE', tag: 'CEREMONY' },
  { id: 'art-1', url: '/gallery/art-core/art-core-1.jpg', title: 'Art Core & Doodle Live Arena', branchCode: 'CREATIVE', tag: 'ART CORE' },
  { id: 'art-2', url: '/gallery/art-core/art-core-2.jpg', title: 'Art Core & Doodle Live Arena', branchCode: 'CREATIVE', tag: 'ART CORE' },
];

const ALL_PHOTOS: GalleryPhoto[] = [
  ...LOOM_ITEMS.flatMap((item) =>
    item.images.map((img, idx) => ({
      id: `${item.id}-${idx}`,
      url: img,
      title: item.title,
      branchCode: item.branchCode,
      tag: item.tag,
    }))
  ),
  ...EXTRA_GALLERY_PHOTOS,
];

/**
 * Helper to compute the authentic organic cubic Bézier spline curve between
 * Loki's hand anchor and the card's nexus docking port.
 */
function computeSplinePath(
  i: number,
  start: { x: number; y: number },
  end: { x: number; y: number }
): { pathData: string; approxLength: number } {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  let cp1 = { x: start.x, y: start.y };
  let cp2 = { x: end.x, y: end.y };

  if (i === 0) {
    // Left Top: shoots up and left along the artwork's upper ray fan
    cp1 = { x: start.x + deltaX * 0.35, y: start.y + deltaY * 0.45 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y - deltaY * 0.15 };
  } else if (i === 1) {
    // Left Middle: shoots directly outward horizontally along middle rays
    cp1 = { x: start.x + deltaX * 0.40, y: start.y + deltaY * 0.30 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y };
  } else if (i === 2) {
    // Left Bottom: cascades down and left along lower ray fan
    cp1 = { x: start.x + deltaX * 0.35, y: start.y + deltaY * 0.45 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y - deltaY * 0.15 };
  } else if (i === 3) {
    // Right Top: shoots up and right along upper ray fan
    cp1 = { x: start.x + deltaX * 0.35, y: start.y + deltaY * 0.45 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y - deltaY * 0.15 };
  } else if (i === 4) {
    // Right Middle: shoots directly outward horizontally along middle rays
    cp1 = { x: start.x + deltaX * 0.40, y: start.y + deltaY * 0.30 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y };
  } else if (i === 5) {
    // Right Bottom: cascades down and right along lower ray fan
    cp1 = { x: start.x + deltaX * 0.35, y: start.y + deltaY * 0.45 };
    cp2 = { x: end.x - deltaX * 0.25, y: end.y - deltaY * 0.15 };
  }

  const pathData = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  const approxLength = Math.hypot(deltaX, deltaY) * 1.25;

  return { pathData, approxLength };
}

function computeMobileSpline(
  start: { x: number; y: number },
  end: { x: number; y: number }
): { pathData: string; approxLength: number } {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const cp1 = { x: start.x + deltaX * 0.30 - 15, y: start.y + deltaY * 0.35 };
  const cp2 = { x: end.x - deltaX * 0.30 + 15, y: end.y - deltaY * 0.25 };
  const pathData = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  const approxLength = Math.hypot(deltaX, deltaY) * 1.15;
  return { pathData, approxLength };
}

interface LokiLoomOverlayProps {
  /** 0.0 = Threads unsprouted at crown horns; 1.0 = All threads & memory images fully woven */
  loomProgress: number;
}

export const LokiLoomOverlay: React.FC<LokiLoomOverlayProps> = ({ loomProgress }) => {
  const [dimensions, setDimensions] = useState({ width: 1440, height: 900 });
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [cardActiveIndices, setCardActiveIndices] = useState<Record<string, number>>({});
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState<number>(0);
  const [modalData, setModalData] = useState<{
    images: string[];
    activeIndex: number;
    title: string;
  } | null>(null);

  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);

  // Debounced hover state management to eliminate side-hover flicker loops
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSlotMouseEnter = (id: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredCardId(id);
  };

  const handleSlotMouseLeave = (_id: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCardId(null);
      hoverTimeoutRef.current = null;
    }, 50);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = touchStartYRef.current ? e.changedTouches[0].clientY - touchStartYRef.current : 0;
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        // Swiped left -> next photo
        setMobilePhotoIndex((prev) => (prev + 1) % ALL_PHOTOS.length);
      } else {
        // Swiped right -> prev photo
        setMobilePhotoIndex((prev) => (prev - 1 + ALL_PHOTOS.length) % ALL_PHOTOS.length);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const portRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const threadPathRefs = React.useRef<
    Record<
      string,
      {
        glow: SVGPathElement | null;
        core: SVGPathElement | null;
        pulse: SVGPathElement | null;
      }
    >
  >({});

  useEffect(() => {
    const updateSize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Modal navigation handlers
  const handleNextModalImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!modalData) return;
    setModalData((prev) =>
      prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % prev.images.length } : null
    );
  };

  const handlePrevModalImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!modalData) return;
    setModalData((prev) =>
      prev ? { ...prev, activeIndex: (prev.activeIndex - 1 + prev.images.length) % prev.images.length } : null
    );
  };

  // Keyboard navigation for image lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!modalData) return;
      if (e.key === 'Escape') {
        setModalData(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setModalData((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % prev.images.length } : null
        );
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setModalData((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex - 1 + prev.images.length) % prev.images.length } : null
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalData]);

  // Card arrow navigation handlers
  const handleCardNext = (itemId: string, numImages: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardActiveIndices((prev) => ({
      ...prev,
      [itemId]: ((prev[itemId] || 0) + 1) % numImages,
    }));
  };

  const handleCardPrev = (itemId: string, numImages: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardActiveIndices((prev) => ({
      ...prev,
      [itemId]: ((prev[itemId] || 0) - 1 + numImages) % numImages,
    }));
  };

  const openDesktopModal = (item: LoomItem, imgIdx: number) => {
    setModalData({
      images: item.images,
      activeIndex: imgIdx,
      title: item.title,
    });
  };

  const openMobileModal = () => {
    const current = ALL_PHOTOS[mobilePhotoIndex] || ALL_PHOTOS[0];
    setModalData({
      images: ALL_PHOTOS.map((p) => p.url),
      activeIndex: mobilePhotoIndex,
      title: current.title,
    });
  };

  // Mobile single thread data radiating from Loki down to the mobile card
  const mobileThreadData = useMemo(() => {
    const { width: w, height: h } = dimensions;
    const cx = w * 0.5;
    // Lowered Loki center (+42px to match shifted background image)
    const cy = h * 0.50 + 42;

    const imgAspect = 855 / 1024;
    const isWConstrained = (w / h) < imgAspect;
    const renderedH = isWConstrained ? w / imgAspect : h;
    const handY = Math.round(cy + (63 / 1024) * renderedH);

    const start = { x: cx, y: handY };
    const end = { x: cx, y: Math.max(h * 0.55, h - 330) };
    const { pathData, approxLength } = computeMobileSpline(start, end);

    return { start, pathData, approxLength };
  }, [dimensions]);

  // Compute 6 thread spline paths radiating symmetrically from Loki's Horned Crown for desktop
  const threads = useMemo(() => {
    const { width: w, height: h } = dimensions;
    const cx = w * 0.5;
    // Lowered Loki crown vertical center (+42px to match shifted background image)
    const cy = h * 0.50 + 42;

    // 6 distinct anchor points on Loki's crown settled on his head in the background artwork:
    const imgAspect = 855 / 1024;
    const isWConstrained = (w / h) < imgAspect;
    const renderedW = isWConstrained ? w : h * imgAspect;
    const renderedH = isWConstrained ? w / imgAspect : h;

    // Loki's hands holding the golden thread epicenters:
    const handDx = Math.round((187.5 / 855) * renderedW);
    const handY = Math.round(cy + (63 / 1024) * renderedH);

    // 3 distinct thread origination anchors fanning out from each hand:
    const handAnchors = [
      // Left Hand (indices 0, 1, 2)
      { x: cx - handDx - 4, y: handY - 14 }, // 0: Left Hand Upper (to Left Top Card)
      { x: cx - handDx - 10, y: handY },     // 1: Left Hand Mid (to Left Mid Card)
      { x: cx - handDx - 4, y: handY + 14 }, // 2: Left Hand Lower (to Left Bottom Card)

      // Right Hand (indices 3, 4, 5)
      { x: cx + handDx + 4, y: handY - 14 }, // 3: Right Hand Upper (to Right Top Card)
      { x: cx + handDx + 10, y: handY },     // 4: Right Hand Mid (to Right Mid Card)
      { x: cx + handDx + 4, y: handY + 14 }, // 5: Right Hand Lower (to Right Bottom Card)
    ];

    // Fixed card width & height (300x200) with identical 20px gap
    const cardW = 300;
    const cardH = 200;
    const cardStep = cardH + 20; // 120px from center to card center

    const leftMargin = Math.max(30, Math.min(65, w * 0.035));
    const rightMargin = Math.max(30, Math.min(65, w * 0.035));

    // Target docking coordinates (nexus ports) on the cards (equidistant from cy):
    const targetPoints = [
      { x: leftMargin + cardW,      y: cy - cardStep }, // 0: Left Top (Card 1)
      { x: leftMargin + cardW,      y: cy },            // 1: Left Middle (Card 3)
      { x: leftMargin + cardW,      y: cy + cardStep }, // 2: Left Bottom (Card 2)
      { x: w - rightMargin - cardW, y: cy - cardStep }, // 3: Right Top (Card 4)
      { x: w - rightMargin - cardW, y: cy },            // 4: Right Middle (Card 6)
      { x: w - rightMargin - cardW, y: cy + cardStep }, // 5: Right Bottom (Card 5)
    ];

    return LOOM_ITEMS.map((item, i) => {
      const start = handAnchors[i];
      const end = targetPoints[i];
      const { pathData, approxLength } = computeSplinePath(i, start, end);

      const instantProgress = loomProgress > 0.01 ? 1.0 : Math.min(1, loomProgress * 20);
      const threadGrowth = instantProgress;
      const cardReveal = loomProgress > 0.01 ? 1.0 : 0.0;

      return {
        ...item,
        start,
        end,
        pathData,
        approxLength,
        threadGrowth,
        cardReveal,
      };
    });
  }, [dimensions, loomProgress]);

  // Real-time spline tracking loop: ensures string stays attached to image during hover & transitions
  useEffect(() => {
    let animId: number;
    let keepRunningUntil = performance.now() + 850;

    const updatePaths = () => {
      if (!containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      if (cRect.width === 0 || cRect.height === 0) return;

      if (dimensions.width < 768) {
        const portEl = portRefs.current['mobile-card'];
        const paths = threadPathRefs.current['mobile-card'];
        if (portEl && paths) {
          const pRect = portEl.getBoundingClientRect();
          const currentEndX = pRect.left + pRect.width * 0.5 - cRect.left;
          const currentEndY = pRect.top + pRect.height * 0.5 - cRect.top;
          const { pathData } = computeMobileSpline(mobileThreadData.start, {
            x: currentEndX,
            y: currentEndY,
          });

          if (paths.glow) paths.glow.setAttribute('d', pathData);
          if (paths.core) paths.core.setAttribute('d', pathData);
          if (paths.pulse) paths.pulse.setAttribute('d', pathData);
        }
      } else {
        threads.forEach((t, i) => {
          const portEl = portRefs.current[t.id];
          const paths = threadPathRefs.current[t.id];
          if (!portEl || !paths) return;

          const pRect = portEl.getBoundingClientRect();
          const currentEndX = pRect.left + pRect.width * 0.5 - cRect.left;
          const currentEndY = pRect.top + pRect.height * 0.5 - cRect.top;

          const { pathData } = computeSplinePath(i, t.start, {
            x: currentEndX,
            y: currentEndY,
          });

          if (paths.glow) paths.glow.setAttribute('d', pathData);
          if (paths.core) paths.core.setAttribute('d', pathData);
          if (paths.pulse) paths.pulse.setAttribute('d', pathData);
        });
      }
    };

    const loop = (time: number) => {
      updatePaths();
      if (hoveredCardId !== null || time < keepRunningUntil) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [hoveredCardId, mobilePhotoIndex, threads, dimensions, mobileThreadData]);

  const isVisible = loomProgress > 0.005;
  const overlayOpacity = Math.min(1, loomProgress * 8);

  if (!isVisible) return null;

  const mobileGrowth = loomProgress > 0.01 ? 1.0 : Math.min(1, loomProgress * 20);

  return (
    <div
      ref={containerRef}
      className="loki-loom-overlay-root"
      style={{ opacity: overlayOpacity }}
      aria-hidden={!isVisible}
    >
      {/* ── SVG Timeline Threads Layer ── */}
      <svg
        className={`loom-svg-canvas ${hoveredCardId ? 'has-hovered-thread' : ''}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lokiThreadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#10b981" />
            <stop offset="70%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <filter id="lokiGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {dimensions.width < 768 ? (
          <g className="loom-thread-group loom-thread-active">
            {/* Outer glowing aura */}
            <path
              ref={(el) => {
                if (!threadPathRefs.current['mobile-card']) {
                  threadPathRefs.current['mobile-card'] = { glow: null, core: null, pulse: null };
                }
                threadPathRefs.current['mobile-card'].glow = el;
              }}
              d={mobileThreadData.pathData}
              className="loom-thread-glow"
              strokeDasharray={mobileThreadData.approxLength}
              strokeDashoffset={mobileThreadData.approxLength * (1 - mobileGrowth)}
            />

            {/* Core gradient multiversal thread */}
            <path
              ref={(el) => {
                if (!threadPathRefs.current['mobile-card']) {
                  threadPathRefs.current['mobile-card'] = { glow: null, core: null, pulse: null };
                }
                threadPathRefs.current['mobile-card'].core = el;
              }}
              d={mobileThreadData.pathData}
              className="loom-thread-core"
              strokeDasharray={mobileThreadData.approxLength}
              strokeDashoffset={mobileThreadData.approxLength * (1 - mobileGrowth)}
            />

            {/* Flowing energy pulse traveling from Loki to mobile card */}
            {mobileGrowth >= 0.85 && (
              <path
                ref={(el) => {
                  if (!threadPathRefs.current['mobile-card']) {
                    threadPathRefs.current['mobile-card'] = { glow: null, core: null, pulse: null };
                  }
                  threadPathRefs.current['mobile-card'].pulse = el;
                }}
                d={mobileThreadData.pathData}
                className="loom-thread-pulse"
                strokeDasharray={mobileThreadData.approxLength}
                strokeDashoffset={0}
              />
            )}

            {/* Glowing anchor flare at Loki's hand origin */}
            <circle
              cx={mobileThreadData.start.x}
              cy={mobileThreadData.start.y}
              r={5}
              className="loom-horn-origin-dot"
              style={{
                opacity: mobileGrowth,
              }}
            />
          </g>
        ) : (
          threads.map((t) => {
            if (t.threadGrowth <= 0) return null;
            const isHovered = hoveredCardId === t.id;
            const strokeDashoffset = t.approxLength * (1 - t.threadGrowth);

            return (
              <g
                key={t.id}
                className={`loom-thread-group ${isHovered ? 'loom-thread-active' : ''}`}
              >
                {/* Outer glowing aura */}
                <path
                  ref={(el) => {
                    if (!threadPathRefs.current[t.id]) {
                      threadPathRefs.current[t.id] = { glow: null, core: null, pulse: null };
                    }
                    threadPathRefs.current[t.id].glow = el;
                  }}
                  d={t.pathData}
                  className="loom-thread-glow"
                  strokeDasharray={t.approxLength}
                  strokeDashoffset={strokeDashoffset}
                />

                {/* Core gradient multiversal thread */}
                <path
                  ref={(el) => {
                    if (!threadPathRefs.current[t.id]) {
                      threadPathRefs.current[t.id] = { glow: null, core: null, pulse: null };
                    }
                    threadPathRefs.current[t.id].core = el;
                  }}
                  d={t.pathData}
                  className="loom-thread-core"
                  strokeDasharray={t.approxLength}
                  strokeDashoffset={strokeDashoffset}
                />

                {/* Flowing energy pulse traveling from crown horn to card */}
                {t.threadGrowth >= 0.85 && (
                  <path
                    ref={(el) => {
                      if (!threadPathRefs.current[t.id]) {
                        threadPathRefs.current[t.id] = { glow: null, core: null, pulse: null };
                      }
                      threadPathRefs.current[t.id].pulse = el;
                    }}
                    d={t.pathData}
                    className="loom-thread-pulse"
                    strokeDasharray={t.approxLength}
                    strokeDashoffset={strokeDashoffset}
                  />
                )}

                {/* Glowing anchor flare at the Hand Origin */}
                <circle
                  cx={t.start.x}
                  cy={t.start.y}
                  r={isHovered ? 7 : 4}
                  className="loom-horn-origin-dot"
                  style={{
                    opacity: Math.min(1, t.threadGrowth * 2),
                  }}
                />
              </g>
            );
          })
        )}
      </svg>

      {/* ── Mobile Layout (< 768px): One Single Card Holding All Photos ── */}
      {dimensions.width < 768 ? (
        <div
          className="loom-mobile-showcase"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {(() => {
            const currentPhoto = ALL_PHOTOS[mobilePhotoIndex] || ALL_PHOTOS[0];
            if (!currentPhoto) return null;

            return (
              <>
                <div
                  className="loom-memory-card loom-mobile-active-card"
                onClick={openMobileModal}
              >
                {/* Glowing Nexus Docking Port on the card top rim */}
                <div
                  ref={(el) => {
                    portRefs.current['mobile-card'] = el;
                  }}
                  className="card-nexus-port mobile-nexus-port"
                  aria-hidden="true"
                />

                {/* Image Container with Nav Arrows - PURE IMAGE, NO BADGES OR TEXT OVER IMAGE */}
                <div className="loom-card-img-wrap">
                  <img
                    key={currentPhoto.id}
                    src={currentPhoto.url}
                    alt={`${currentPhoto.title} ${mobilePhotoIndex + 1}`}
                    className="loom-card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/contact_avengers_bg.jpg';
                    }}
                  />
                  <div className="loom-card-overlay" />

                  {/* Left & Right Arrows on Card to flip through all photos */}
                  <button
                    type="button"
                    className="card-nav-arrow card-nav-prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobilePhotoIndex((prev) => (prev - 1 + ALL_PHOTOS.length) % ALL_PHOTOS.length);
                    }}
                    aria-label="Previous photo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="card-nav-arrow card-nav-next"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobilePhotoIndex((prev) => (prev + 1) % ALL_PHOTOS.length);
                    }}
                    aria-label="Next photo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Mobile Hint below card */}
              <div className="loom-mobile-swipe-hint">
                <span>SWIPE OR TAP ARROWS TO BROWSE ALL PHOTOS</span>
              </div>
            </>
          );
        })()}
        </div>
      ) : (
        /* ── Desktop Layout (>= 768px): 6 Memory Cards Framing Loki ── */
        <div className={`loom-cards-layer ${hoveredCardId ? 'has-hovered-card' : ''}`}>
        {threads.map((t) => {
          if (t.cardReveal <= 0.01) return null;

          const isHovered = hoveredCardId === t.id;
          const cardScale = 0.70 + 0.30 * t.cardReveal;
          const currentImgIdx = cardActiveIndices[t.id] || 0;
          const activeImage = t.images[currentImgIdx];

          const isMiddleCard = t.cardPosClass === 'loom-card-pos-3' || t.cardPosClass === 'loom-card-pos-6';
          const isLeftCard = t.cardPosClass === 'loom-card-pos-1' || t.cardPosClass === 'loom-card-pos-2' || t.cardPosClass === 'loom-card-pos-3';
          const slideX = isLeftCard ? -(1 - t.cardReveal) * 22 : (1 - t.cardReveal) * 22;

          const isMobile = dimensions.width < 768;
          const isTablet = dimensions.width >= 768 && dimensions.width < 1024;
          const forwardZ = isMobile ? 55 : 95;
          const forwardScale = isMobile ? 1.05 : 1.10;

          // Smooth and stable inward glide towards screen center
          const baseInwardShift = isMobile ? 25 : isTablet ? 35 : 45;
          const inwardShift = isLeftCard ? baseInwardShift : -baseInwardShift;

          // Normal resting transform in 3D
          const restingTransform = `scale(${cardScale}) translateX(${slideX}px) perspective(1200px) rotateY(${isLeftCard ? 3 : -3}deg) translateZ(0px)`;

          // Coming forward hover transform: moves smoothly inward, elevates in 3D, scales up, front-facing
          const hoverTransform = `scale(${cardScale * forwardScale}) translateX(${slideX + inwardShift}px) perspective(1200px) rotateY(0deg) translateZ(${forwardZ}px)`;

          const transformStyle = isHovered ? hoverTransform : restingTransform;

          return (
            <div
              key={t.id}
              className={`loom-card-slot ${t.cardPosClass} ${isHovered ? 'slot-hovered' : ''}`}
              style={{
                zIndex: isHovered ? 60 : (isMiddleCard ? 5 : 3),
                pointerEvents: t.cardReveal > 0.65 ? 'auto' : 'none',
              }}
              onMouseEnter={() => handleSlotMouseEnter(t.id)}
              onMouseLeave={() => handleSlotMouseLeave(t.id)}
            >
              <div
                className={`loom-memory-card ${isHovered ? 'active is-hovered' : ''}`}
                style={{
                  opacity: t.cardReveal,
                  transform: transformStyle,
                }}
                onClick={() => openDesktopModal(t, currentImgIdx)}
              >
                {/* Glowing Nexus Docking Port on the card rim */}
                <div
                  ref={(el) => {
                    portRefs.current[t.id] = el;
                  }}
                  className="card-nexus-port"
                  aria-hidden="true"
                />

                {/* Image Container with Nav Arrows - PURE IMAGE, NO BADGES OR TEXT OVER IMAGE */}
                <div className="loom-card-img-wrap">
                  <img
                    key={`${t.id}-${currentImgIdx}`}
                    src={activeImage}
                    alt={`${t.title} ${currentImgIdx + 1}`}
                    className="loom-card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/contact_avengers_bg.jpg';
                    }}
                  />
                  <div className="loom-card-overlay" />

                  {/* Left & Right Arrows on Card */}
                  {t.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="card-nav-arrow card-nav-prev"
                        onClick={(e) => handleCardPrev(t.id, t.images.length, e)}
                        aria-label="Previous image"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="card-nav-arrow card-nav-next"
                        onClick={(e) => handleCardNext(t.id, t.images.length, e)}
                        aria-label="Next image"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* ── Pure Image Lightbox Modal (Text Clutter Removed - Image Only with Arrows) ── */}
      {modalData && (
        <div
          className="temporal-modal-backdrop"
          onClick={() => setModalData(null)}
          style={{ pointerEvents: 'auto' }}
        >
          <div
            className="pure-image-lightbox-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setModalData(null)}
              aria-label="Close image viewer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Main Pure Image Stage */}
            <div className="lightbox-image-viewport">
              <img
                key={`${modalData.activeIndex}`}
                src={modalData.images[modalData.activeIndex]}
                alt={`${modalData.title} - ${modalData.activeIndex + 1}`}
                className="lightbox-pure-image"
              />

              {/* Left Arrow Button */}
              {modalData.images.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow-btn lightbox-arrow-prev"
                  onClick={handlePrevModalImage}
                  aria-label="Previous image"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

              {/* Right Arrow Button */}
              {modalData.images.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow-btn lightbox-arrow-next"
                  onClick={handleNextModalImage}
                  aria-label="Next image"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}

              {/* Bottom Image Counter */}
              <div className="lightbox-footer-pill">
                <span className="lightbox-count-badge">
                  {modalData.activeIndex + 1} / {modalData.images.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LokiLoomOverlay;
