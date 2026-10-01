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
  logoHeightMobile: 28,

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
  subtitle?: string;
  number?: string;
  accent?: string;
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
  { id: 'home', label: 'Home', subtitle: 'Suit-Up & Armor Core', number: '01', accent: '#f59e0b' },
  { id: 'about', label: 'About', subtitle: 'Galactic Extravaganza', number: '02', accent: '#f43f5e' },
  { id: 'events', label: 'Events', subtitle: '8 Multiverse Arenas', number: '03', accent: '#38bdf8' },
  { id: 'gallery', label: 'Gallery', subtitle: 'Quantum Archives', number: '04', accent: '#a855f7' },
  { id: 'contact', label: 'Contact', subtitle: 'S.H.I.E.L.D. Comm-Link', number: '05', accent: '#10b981' },
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const navPillRef = useRef<HTMLElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const desktopLinksRef = useRef<HTMLDivElement>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);

  const cfg = NAVBAR_CONFIG;

  useEffect(() => {
    setSelectedId(activeId);
  }, [activeId]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  const handleItemClick = (id: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setSelectedId(id);
    setIsDrawerOpen(false);
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
      navPillRef.current.style.background = `rgba(8, 14, 26, ${0.88 * p})`;
      const blurAmt = mobile ? 12 * p : 20 * p;
      navPillRef.current.style.backdropFilter = `blur(${blurAmt}px)`;
      (navPillRef.current.style as any).webkitBackdropFilter = `blur(${blurAmt}px)`;
      navPillRef.current.style.border = `${p > 0.05 ? cfg.borderWidth : '0px'} solid rgba(56, 189, 248, ${0.28 * p})`;
      navPillRef.current.style.boxShadow = `0 ${16 * p}px ${48 * p}px rgba(0, 0, 0, ${0.75 * p}), inset 0 1px 0 rgba(255, 255, 255, ${0.14 * p})`;
    }

    if (logoImgRef.current) {
      const finalLogoH = mobile ? cfg.logoHeightMobile : cfg.logoHeightFinal;
      const currentLogoHeight = cfg.logoHeightInitial * (1 - p) + finalLogoH * p;
      logoImgRef.current.style.height = `${currentLogoHeight}px`;
      logoImgRef.current.style.filter = `drop-shadow(0 0 ${25 * (1 - p)}px rgba(255, 90, 0, ${0.75 * (1 - p)}))`;
    }

    const linksProgress = p < 0.25 ? 0 : (p - 0.25) / 0.75;

    // Desktop divider
    if (dividerRef.current) {
      dividerRef.current.style.opacity = String(mobile ? 0 : linksProgress);
      dividerRef.current.style.transform = `scaleY(${linksProgress})`;
    }

    // Desktop links
    if (desktopLinksRef.current) {
      desktopLinksRef.current.style.opacity = String(mobile ? 0 : linksProgress);
      desktopLinksRef.current.style.maxWidth = `${linksProgress * 650}px`;
      desktopLinksRef.current.style.pointerEvents = (!mobile && p >= 0.95) ? 'auto' : 'none';
    }

    // Mobile controls (active chip + cyber menu button)
    if (mobileBarRef.current) {
      mobileBarRef.current.style.opacity = String(mobile ? linksProgress : 0);
      mobileBarRef.current.style.pointerEvents = (mobile && p >= 0.95) ? 'auto' : 'none';
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

  const currentItem = items.find((i) => i.id === selectedId) || items[0];

  return (
    <>
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
          maxWidth: isMobile ? 'calc(100vw - 24px)' : '96vw',
          width: isMobile ? 'calc(100vw - 24px)' : 'auto',
        }}
      >
        <nav
          ref={navPillRef}
          aria-label="Main Navigation"
          className="navbar-pill-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'center',
            background: `rgba(8, 14, 26, ${0.88 * p})`,
            backdropFilter: `blur(${isMobile ? 12 * p : 20 * p}px)`,
            WebkitBackdropFilter: `blur(${isMobile ? 12 * p : 20 * p}px)`,
            border: `${p > 0.05 ? cfg.borderWidth : '0px'} solid rgba(56, 189, 248, ${0.28 * p})`,
            borderRadius: cfg.borderRadius,
            boxShadow: `0 ${16 * p}px ${48 * p}px rgba(0, 0, 0, ${0.75 * p}), inset 0 1px 0 rgba(255, 255, 255, ${0.14 * p})`,
            padding: isMobile ? '6px 14px' : '8px 24px',
            width: isMobile ? '100%' : 'auto',
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

          {/* Desktop Divider line between Logo and Navigation Links */}
          {!isMobile && (
            <div
              ref={dividerRef}
              className="navbar-divider"
              style={{
                width: cfg.dividerWidth,
                height: cfg.dividerHeight,
                background: cfg.dividerColor,
                margin: cfg.dividerMargin,
                opacity: linksProgress,
                transform: `scaleY(${linksProgress})`,
                transition: 'none',
                flexShrink: 0,
              }}
            />
          )}

          {/* ── DESKTOP NAVIGATION ITEMS (Inline Floating Glass Pill) ── */}
          {!isMobile && (
            <div
              ref={desktopLinksRef}
              className="navbar-desktop-links"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: linksProgress,
                maxWidth: `${linksProgress * 650}px`,
                pointerEvents: p >= 0.95 ? 'auto' : 'none',
                whiteSpace: 'nowrap',
                transition: 'none',
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
                      padding: cfg.itemPadding,
                      fontSize: cfg.fontSize,
                      fontWeight: cfg.fontWeight,
                      letterSpacing: cfg.letterSpacing,
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                      color: isActive ? cfg.activeTextColor : cfg.textColor,
                      background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      borderRadius: '9999px',
                      border: isActive ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                      boxShadow: isActive ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'none',
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
          )}

          {/* ── MOBILE CONTROLS: Active Section HUD Capsule + Cyber Hamburger Button ── */}
          {isMobile && (
            <div
              ref={mobileBarRef}
              className="navbar-mobile-controls"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: linksProgress,
                pointerEvents: p >= 0.95 ? 'auto' : 'none',
                transition: 'none',
              }}
            >
              {/* Active Section HUD Pill */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="mobile-active-hud-chip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '9999px',
                  padding: '4px 10px',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: currentItem.accent || '#38bdf8',
                    boxShadow: `0 0 8px ${currentItem.accent || '#38bdf8'}`,
                  }}
                />
                <span>{currentItem.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Stark Cyber Hamburger Button */}
              <button
                type="button"
                aria-label={isDrawerOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                className={`cyber-hamburger-btn ${isDrawerOpen ? 'is-open' : ''}`}
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
                }}
              >
                <span className="hamburger-bar bar-1" />
                <span className="hamburger-bar bar-2" />
                <span className="hamburger-bar bar-3" />
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* ── MOBILE CYBER HUD FULL-SCREEN NAVIGATION DRAWER ── */}
      {isMobile && (
        <div
          className={`cyber-hud-drawer-backdrop ${isDrawerOpen ? 'drawer-active' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDrawerOpen(false);
            }
          }}
          aria-hidden={!isDrawerOpen}
        >
          <aside className="cyber-hud-drawer-sheet">
            {/* Holographic Header */}
            <div className="drawer-header">
              <div className="drawer-system-tag">
                <span className="system-pulse-dot" />
                <span>SYSTEM NAVIGATION // HUD v2.6</span>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                aria-label="Close menu"
                onClick={() => setIsDrawerOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Navigation Cards List */}
            <div className="drawer-nav-list">
              {items.map((item) => {
                const isActive = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    className={`drawer-nav-card ${isActive ? 'is-active' : ''}`}
                    style={{
                      '--card-accent': item.accent || '#38bdf8',
                    } as React.CSSProperties}
                  >
                    <div className="drawer-card-left">
                      <span className="drawer-item-number">{item.number}</span>
                      <div className="drawer-item-info">
                        <span className="drawer-item-title">{item.label}</span>
                        {item.subtitle && <span className="drawer-item-desc">{item.subtitle}</span>}
                      </div>
                    </div>
                    <div className="drawer-card-arrow">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Action Footer */}
            <div className="drawer-footer">
              <button
                type="button"
                className="drawer-action-btn"
                onClick={() => handleItemClick('events')}
              >
                <span>EXPLORE 8 ARENAS</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
              <div className="drawer-college-credit">
                <span>PCCOE • DEPARTMENT OF COMPUTER ENGINEERING</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      <style>{`
        /* ==========================================================================
           DESKTOP NAVBAR STYLING
           ========================================================================== */
        .nav-pill-item:hover {
          color: #ffffff !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .nav-pill-item.nav-item-active:hover {
          color: #38bdf8 !important;
          background: rgba(56, 189, 248, 0.22) !important;
        }

        /* ==========================================================================
           MOBILE HAMBURGER BUTTON (Animated 3-Bar to 'X')
           ========================================================================== */
        .hamburger-bar {
          width: 18px;
          height: 2px;
          background-color: #38bdf8;
          border-radius: 2px;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, background-color 0.2s ease;
          box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
        }

        .cyber-hamburger-btn.is-open .bar-1 {
          transform: translateY(6px) rotate(45deg);
        }

        .cyber-hamburger-btn.is-open .bar-2 {
          opacity: 0;
          transform: scaleX(0);
        }

        .cyber-hamburger-btn.is-open .bar-3 {
          transform: translateY(-6px) rotate(-45deg);
        }

        /* ==========================================================================
           MOBILE CYBER HUD NAVIGATION DRAWER
           ========================================================================== */
        .cyber-hud-drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
          background: rgba(2, 6, 16, 0.75);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cyber-hud-drawer-backdrop.drawer-active {
          opacity: 1;
          pointer-events: auto;
        }

        .cyber-hud-drawer-sheet {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          max-height: 85vh;
          overflow-y: auto;
          background: linear-gradient(180deg, rgba(6, 14, 28, 0.98) 0%, rgba(3, 8, 18, 0.99) 100%);
          border-bottom: 2px solid rgba(56, 189, 248, 0.35);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.15);
          border-radius: 0 0 24px 24px;
          padding: 1.4rem 1.2rem 1.6rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          transform: translateY(-100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cyber-hud-drawer-backdrop.drawer-active .cyber-hud-drawer-sheet {
          transform: translateY(0);
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .drawer-system-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #38bdf8;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          font-family: monospace;
        }

        .system-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 10px #38bdf8;
          animation: navSystemPulse 1.8s infinite;
        }

        @keyframes navSystemPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .drawer-close-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.2s, background 0.2s;
        }

        .drawer-close-btn:hover {
          color: #ffffff;
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
        }

        .drawer-nav-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .drawer-nav-card {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 3px solid var(--card-accent);
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .drawer-nav-card:hover,
        .drawer-nav-card.is-active {
          background: rgba(56, 189, 248, 0.12);
          border-color: rgba(56, 189, 248, 0.45);
          border-left: 3px solid var(--card-accent);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(56, 189, 248, 0.08);
          transform: translateX(4px);
        }

        .drawer-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .drawer-item-number {
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--card-accent);
          opacity: 0.9;
        }

        .drawer-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .drawer-item-title {
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #ffffff;
        }

        .drawer-item-desc {
          font-size: 0.65rem;
          color: #94a3b8;
          letter-spacing: 0.3px;
        }

        .drawer-card-arrow {
          color: #64748b;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .drawer-nav-card:hover .drawer-card-arrow,
        .drawer-nav-card.is-active .drawer-card-arrow {
          color: var(--card-accent);
          transform: translateX(3px);
        }

        .drawer-footer {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          margin-top: 0.4rem;
          padding-top: 0.8rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .drawer-action-btn {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #0284c7 0%, #00e5ff 100%);
          border: 1px solid rgba(0, 229, 255, 0.6);
          border-radius: 10px;
          color: #030712;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 1.2px;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(0, 229, 255, 0.35);
          transition: transform 0.18s, box-shadow 0.18s;
        }

        .drawer-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0, 229, 255, 0.55);
        }

        .drawer-college-credit {
          text-align: center;
          font-size: 0.55rem;
          color: #64748b;
          letter-spacing: 1px;
          font-family: monospace;
        }
      `}</style>
    </>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
