import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

export const NAVBAR_CONFIG = {
  top: '20px',
  minHeight: '68px',
  padding: '8px 24px',
  gap: '18px',

  background: 'rgba(8, 14, 26, 0.85)',
  backdropBlur: '20px',
  borderColor: 'rgba(255, 255, 255, 0.14)',
  borderWidth: '1px',
  borderRadius: '9999px',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)',

  logoHeightFinal: 48,
  logoHeightInitial: 110,
  logoHeightMobile: 22,

  showDivider: true,
  dividerWidth: '1.5px',
  dividerHeight: '32px',
  dividerColor: 'rgba(255, 255, 255, 0.18)',
  dividerMargin: '0 10px',

  fontSize: '0.92rem',
  fontWeight: 600,
  letterSpacing: '1.5px',
  itemPadding: '8px 16px',

  textColor: '#9ca3af',
  activeTextColor: '#38bdf8',
  hoverTextColor: '#ffffff',
};

export interface NavItem {
  id: string;
  label: string;
  href?: string;
}

export interface NavbarProps {
  /** Optional logo image source */
  logoSrc?: string;
  /** Active item id */
  activeId?: string;
  /** Navigation items list */
  items?: NavItem[];
  /** Callback when an item is clicked */
  onSelect?: (id: string) => void;
  /** Morph progress: 0.0 = center large logo, 1.0 = top compact navigation bar */
  morphProgress?: number;
  /** Optional custom class name */
  className?: string;
}

export interface NavbarHandle {
  /** Imperative setter for morph progress without causing React re-render */
  setMorphProgress: (progress: number) => void;
}

const defaultItems: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'events', label: 'Events' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'contact', label: 'Contact' },
];

export const Navbar = forwardRef<NavbarHandle, NavbarProps>(({
  logoSrc = '/assets/ANANTYA.webp',
  activeId = 'home',
  items = defaultItems,
  onSelect,
  morphProgress: initialMorphProgress = 1.0,
  className = '',
}, ref) => {
  const [selectedId, setSelectedId] = useState<string>(activeId);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const headerRef = useRef<HTMLDivElement>(null);
  const navPillRef = useRef<HTMLElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const linksWrapRef = useRef<HTMLDivElement>(null);

  const cfg = NAVBAR_CONFIG;

  useEffect(() => {
    setSelectedId(activeId);
  }, [activeId]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedId(id);
    if (onSelect) {
      onSelect(id);
    }
  };

  // Direct DOM style application for zero-rerender morphing
  const applyMorph = useCallback((prog: number) => {
    const p = Math.max(0, Math.min(1, prog));
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (headerRef.current) {
      headerRef.current.style.top = `calc(50% * (1 - ${p}) + ${cfg.top} * ${p})`;
      headerRef.current.style.transform = `translate(-50%, calc(-50% * (1 - ${p})))`;
      headerRef.current.style.pointerEvents = p >= 0.85 ? 'auto' : 'none';
    }

    if (navPillRef.current) {
      navPillRef.current.style.background = `rgba(8, 14, 26, ${0.85 * p})`;
      const blurAmt = mobile ? 8 * p : 20 * p;
      navPillRef.current.style.backdropFilter = `blur(${blurAmt}px)`;
      (navPillRef.current.style as any).webkitBackdropFilter = `blur(${blurAmt}px)`;
      navPillRef.current.style.border = `${p > 0.05 ? cfg.borderWidth : '0px'} solid rgba(255, 255, 255, ${0.14 * p})`;
      navPillRef.current.style.boxShadow = `0 ${16 * p}px ${48 * p}px rgba(0, 0, 0, ${0.65 * p}), inset 0 1px 0 rgba(255, 255, 255, ${0.12 * p})`;
    }

    if (logoImgRef.current) {
      const finalLogoH = mobile ? cfg.logoHeightMobile : cfg.logoHeightFinal;
      const currentLogoHeight = cfg.logoHeightInitial * (1 - p) + finalLogoH * p;
      logoImgRef.current.style.height = `${currentLogoHeight}px`;
      logoImgRef.current.style.filter = `drop-shadow(0 0 ${25 * (1 - p)}px rgba(255, 90, 0, ${0.75 * (1 - p)}))`;
    }

    const linksProgress = p < 0.25 ? 0 : (p - 0.25) / 0.75;
    if (dividerRef.current) {
      dividerRef.current.style.opacity = String(linksProgress);
      dividerRef.current.style.transform = `scaleY(${linksProgress})`;
    }

    if (linksWrapRef.current) {
      linksWrapRef.current.style.opacity = String(linksProgress);
      linksWrapRef.current.style.maxWidth = `${linksProgress * (mobile ? 440 : 650)}px`;
      linksWrapRef.current.style.pointerEvents = p >= 0.95 ? 'auto' : 'none';
    }
  }, [cfg]);

  useImperativeHandle(ref, () => ({
    setMorphProgress: applyMorph,
  }), [applyMorph]);

  // Initial style sync
  useEffect(() => {
    applyMorph(initialMorphProgress);
  }, [applyMorph, initialMorphProgress]);

  const p = Math.max(0, Math.min(1, initialMorphProgress));
  const topPosition = `calc(50% * (1 - ${p}) + ${cfg.top} * ${p})`;
  const transformY = `calc(-50% * (1 - ${p}))`;
  const finalLogoH = isMobile ? cfg.logoHeightMobile : cfg.logoHeightFinal;
  const currentLogoHeight = cfg.logoHeightInitial * (1 - p) + finalLogoH * p;
  const linksProgress = p < 0.25 ? 0 : (p - 0.25) / 0.75;

  return (
    <header
      ref={headerRef}
      className={`navbar-morph-container ${className}`}
      style={{
        position: 'fixed',
        top: topPosition,
        left: '50%',
        transform: `translate(-50%, ${transformY})`,
        zIndex: 100,
        pointerEvents: p >= 0.85 ? 'auto' : 'none',
        transition: 'none',
        maxWidth: isMobile ? '98vw' : '96vw',
      }}
    >
      <nav
        ref={navPillRef}
        aria-label="Main Navigation"
        className="navbar-pill-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `rgba(8, 14, 26, ${0.85 * p})`,
          backdropFilter: `blur(${isMobile ? 8 * p : 20 * p}px)`,
          WebkitBackdropFilter: `blur(${isMobile ? 8 * p : 20 * p}px)`,
          border: `${p > 0.05 ? cfg.borderWidth : '0px'} solid rgba(255, 255, 255, ${0.14 * p})`,
          borderRadius: cfg.borderRadius,
          boxShadow: `0 ${16 * p}px ${48 * p}px rgba(0, 0, 0, ${0.65 * p}), inset 0 1px 0 rgba(255, 255, 255, ${0.12 * p})`,
          padding: isMobile ? '3px 8px' : '8px 24px',
          transition: 'none',
        }}
      >
        {/* Anantya Brand Logo */}
        <a
          href="#home"
          onClick={(e) => handleItemClick('home', e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            flexShrink: 0,
            cursor: p >= 0.85 ? 'pointer' : 'default',
          }}
        >
          <img
            ref={logoImgRef}
            src={logoSrc}
            alt="Anantya Logo"
            style={{
              height: `${currentLogoHeight}px`,
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              filter: `drop-shadow(0 0 ${25 * (1 - p)}px rgba(255, 90, 0, ${0.75 * (1 - p)}))`,
              transition: 'none',
            }}
          />
        </a>

        {/* Divider line between Logo and Navigation Links */}
        <div
          ref={dividerRef}
          className="navbar-divider"
          style={{
            width: cfg.dividerWidth,
            height: isMobile ? '18px' : cfg.dividerHeight,
            background: cfg.dividerColor,
            margin: isMobile ? '0 5px' : cfg.dividerMargin,
            opacity: linksProgress,
            transform: `scaleY(${linksProgress})`,
            transition: 'none',
            flexShrink: 0,
          }}
        />

        {/* Navigation Items (Inline on both desktop and mobile with smooth touch-scrolling on small screens) */}
        <div
          ref={linksWrapRef}
          className="navbar-links-scrollable"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '2px' : '4px',
            opacity: linksProgress,
            maxWidth: `${linksProgress * (isMobile ? 440 : 650)}px`,
            overflowX: 'auto',
            overflowY: 'hidden',
            pointerEvents: p >= 0.95 ? 'auto' : 'none',
            whiteSpace: 'nowrap',
            transition: 'none',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((item) => {
            const isActive = selectedId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleItemClick(item.id, e)}
                className={`nav-pill-item ${isActive ? 'nav-item-active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: isMobile ? '4px 7px' : cfg.itemPadding,
                  minHeight: isMobile ? '26px' : 'auto',
                  fontSize: isMobile ? '0.62rem' : cfg.fontSize,
                  fontWeight: cfg.fontWeight,
                  letterSpacing: isMobile ? '0.5px' : cfg.letterSpacing,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: isActive ? cfg.activeTextColor : cfg.textColor,
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  borderRadius: '9999px',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                  transition: 'color 0.18s ease, background 0.18s ease, border-color 0.18s ease',
                  cursor: 'pointer',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        .navbar-links-scrollable::-webkit-scrollbar {
          display: none;
        }

        .nav-pill-item:hover {
          color: #ffffff !important;
          background: rgba(255, 255, 255, 0.06) !important;
        }

        .nav-pill-item.nav-item-active:hover {
          color: #38bdf8 !important;
          background: rgba(56, 189, 248, 0.16) !important;
        }

        @media (max-width: 768px) {
          .navbar-morph-container {
            max-width: 98vw !important;
          }
          .navbar-pill-nav {
            padding: 3px 6px !important;
            gap: 0px !important;
          }
          .navbar-divider {
            margin: 0 4px !important;
            height: 16px !important;
          }
          .nav-pill-item {
            font-size: 0.62rem !important;
            padding: 4px 6px !important;
            min-height: 26px !important;
            letter-spacing: 0.4px !important;
          }
        }
      `}</style>
    </header>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
