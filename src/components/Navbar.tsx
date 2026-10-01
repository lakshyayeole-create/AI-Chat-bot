import React, { useState, useEffect, useRef } from 'react';

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
  logoHeightMobile: 36,

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

const defaultItems: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'events', label: 'Events' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'contact', label: 'Contact' },
];

export const Navbar: React.FC<NavbarProps> = ({
  logoSrc = '/assets/ANANTYA.png',
  activeId = 'home',
  items = defaultItems,
  onSelect,
  morphProgress = 1.0,
  className = '',
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeId);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const menuRef = useRef<HTMLDivElement>(null);
  const cfg = NAVBAR_CONFIG;

  const p = Math.max(0, Math.min(1, morphProgress));

  useEffect(() => {
    setSelectedId(activeId);
  }, [activeId]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobileMenuOpen]);

  // Auto-close mobile menu on scroll or Escape key
  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedId(id);
    setIsMobileMenuOpen(false);
    if (onSelect) {
      onSelect(id);
    }
  };

  // Interpolated values based on morphProgress
  // At p = 0: centered vertically at 50%
  // At p = 1: locked at 20px from top
  const topPosition = `calc(50% * (1 - ${p}) + ${cfg.top} * ${p})`;
  const transformY = `calc(-50% * (1 - ${p}))`;

  // Logo height interpolates from 110px down to 48px (or 36px on mobile)
  const finalLogoH = isMobile ? cfg.logoHeightMobile : cfg.logoHeightFinal;
  const currentLogoHeight = cfg.logoHeightInitial * (1 - p) + finalLogoH * p;

  // Nav links & divider emerge as logo reaches the top
  const linksProgress = p < 0.25 ? 0 : (p - 0.25) / 0.75;

  return (
    <header
      ref={menuRef}
      className={`navbar-morph-container ${className}`}
      style={{
        position: 'fixed',
        top: topPosition,
        left: '50%',
        transform: `translate(-50%, ${transformY})`,
        zIndex: 100,
        pointerEvents: p >= 0.85 ? 'auto' : 'none',
        transition: 'none',
      }}
    >
      <nav
        aria-label="Main Navigation"
        className="navbar-pill-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `rgba(8, 14, 26, ${0.85 * p})`,
          backdropFilter: `blur(${20 * p}px)`,
          WebkitBackdropFilter: `blur(${20 * p}px)`,
          border: `${p > 0.05 ? cfg.borderWidth : '0px'} solid rgba(255, 255, 255, ${0.14 * p})`,
          borderRadius: cfg.borderRadius,
          boxShadow: `0 ${16 * p}px ${48 * p}px rgba(0, 0, 0, ${0.65 * p}), inset 0 1px 0 rgba(255, 255, 255, ${0.12 * p})`,
          padding: isMobile
            ? `calc(4px * (1 - ${p}) + 6px * ${p}) calc(12px * (1 - ${p}) + 16px * ${p})`
            : `calc(4px * (1 - ${p}) + 8px * ${p}) calc(12px * (1 - ${p}) + 24px * ${p})`,
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

        {/* Divider line between Logo and Navigation Links (Desktop Only) */}
        <div
          className="desktop-nav-divider"
          style={{
            width: cfg.dividerWidth,
            height: cfg.dividerHeight,
            background: cfg.dividerColor,
            margin: cfg.dividerMargin,
            opacity: linksProgress,
            transform: `scaleY(${linksProgress})`,
            transition: 'none',
          }}
        />

        {/* Desktop Navigation Items */}
        <div
          className="desktop-nav-links"
          style={{
            alignItems: 'center',
            gap: '4px',
            opacity: linksProgress,
            maxWidth: `${linksProgress * 550}px`,
            overflow: 'hidden',
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
                  background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  borderRadius: '9999px',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'color 0.2s ease, background 0.2s ease',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        {/* Mobile Hamburger Trigger Button (Appears only on mobile once navbar is formed) */}
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          className="mobile-hamburger-btn"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          style={{
            opacity: linksProgress,
            pointerEvents: p >= 0.85 ? 'auto' : 'none',
          }}
        >
          <span className={`bar bar-top ${isMobileMenuOpen ? 'open' : ''}`} />
          <span className={`bar bar-mid ${isMobileMenuOpen ? 'open' : ''}`} />
          <span className={`bar bar-bot ${isMobileMenuOpen ? 'open' : ''}`} />
        </button>
      </nav>

      {/* Mobile Navigation Dropdown Menu (Floating Glass Sheet) */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-drawer" role="dialog" aria-modal="true">
          <div className="mobile-drawer-header">
            <span className="mobile-drawer-tag">ANANTYA 2026 // NAV</span>
            <span className="mobile-drawer-gem" />
          </div>

          <div className="mobile-drawer-links">
            {items.map((item, index) => {
              const isActive = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => handleItemClick(item.id, e)}
                  className={`mobile-drawer-item ${isActive ? 'active' : ''}`}
                >
                  <span className="mobile-item-num">0{index + 1}</span>
                  <span className="mobile-item-label">{item.label}</span>
                  {isActive && <span className="mobile-item-indicator" />}
                </button>
              );
            })}
          </div>

          <div className="mobile-drawer-footer">
            <span className="footer-meta">PCCOE TECHNO-CULTURAL ARENA</span>
          </div>
        </div>
      )}

      <style>{`
        .desktop-nav-divider {
          display: block;
        }

        .desktop-nav-links {
          display: flex;
        }

        .mobile-hamburger-btn {
          display: none;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          margin-left: 12px;
          border-radius: 8px;
          outline: none;
        }

        .mobile-hamburger-btn .bar {
          display: block;
          width: 20px;
          height: 2px;
          background-color: #38bdf8;
          border-radius: 2px;
          transition: transform 0.28s ease, opacity 0.28s ease, background-color 0.28s ease;
          box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
        }

        .mobile-hamburger-btn .bar-top.open {
          transform: translateY(7px) rotate(45deg);
          background-color: #ffffff;
        }

        .mobile-hamburger-btn .bar-mid.open {
          opacity: 0;
        }

        .mobile-hamburger-btn .bar-bot.open {
          transform: translateY(-7px) rotate(-45deg);
          background-color: #ffffff;
        }

        .mobile-nav-drawer {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          width: calc(100vw - 32px);
          max-width: 380px;
          background: rgba(8, 14, 26, 0.94);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 20px;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          animation: mobileDrawerSlide 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          z-index: 105;
        }

        @keyframes mobileDrawerSlide {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        .mobile-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mobile-drawer-tag {
          font-family: monospace;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #7dd3fc;
        }

        .mobile-drawer-gem {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 10px #38bdf8;
        }

        .mobile-drawer-links {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .mobile-drawer-item {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          width: 100%;
          min-height: 48px;
          padding: 0.7rem 1rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }

        .mobile-drawer-item:hover,
        .mobile-drawer-item.active {
          background: rgba(56, 189, 248, 0.12);
          border-color: rgba(56, 189, 248, 0.35);
          transform: translateX(3px);
        }

        .mobile-item-num {
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 700;
          color: #38bdf8;
          letter-spacing: 0.1em;
        }

        .mobile-item-label {
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #e2e8f0;
          text-transform: uppercase;
        }

        .mobile-drawer-item.active .mobile-item-label {
          color: #ffffff;
        }

        .mobile-item-indicator {
          margin-left: auto;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 12px #38bdf8;
        }

        .mobile-drawer-footer {
          padding-top: 0.6rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        .footer-meta {
          font-family: monospace;
          font-size: 0.62rem;
          letter-spacing: 0.18em;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .desktop-nav-divider {
            display: none !important;
          }
          .desktop-nav-links {
            display: none !important;
          }
          .mobile-hamburger-btn {
            display: flex !important;
          }
          .navbar-pill-nav {
            padding: 6px 14px !important;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
