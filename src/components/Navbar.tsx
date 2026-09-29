import React, { useState, useEffect } from 'react';

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
  { id: 'events', label: 'Events' },
  { id: 'contact', label: 'Contact' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'admin', label: 'Login' }
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
  const cfg = NAVBAR_CONFIG;

  const p = Math.max(0, Math.min(1, morphProgress));

  useEffect(() => {
    setSelectedId(activeId);
  }, [activeId]);

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedId(id);
    if (onSelect) {
      onSelect(id);
    }
  };

  // Interpolated values based on morphProgress
  // At p = 0: centered vertically at 50%
  // At p = 1: locked at 20px from top
  const topPosition = `calc(50% * (1 - ${p}) + ${cfg.top} * ${p})`;
  const transformY = `calc(-50% * (1 - ${p}))`;

  // Logo height interpolates from 110px down to 48px
  const currentLogoHeight = cfg.logoHeightInitial * (1 - p) + cfg.logoHeightFinal * p;

  // Nav links & divider emerge as logo reaches the top
  const linksProgress = p < 0.25 ? 0 : (p - 0.25) / 0.75;

  return (
    <header
      className={`navbar-morph-container ${className}`}
      style={{
        position: 'fixed',
        top: topPosition,
        left: '50%',
        transform: `translate(-50%, ${transformY})`,
        zIndex: 100,
        pointerEvents: p >= 0.85 ? 'auto' : 'none',
        transition: 'none', // Controlled directly by scroll scrub
      }}
    >
      <nav
        aria-label="Main Navigation"
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
          padding: `calc(4px * (1 - ${p}) + 8px * ${p}) calc(12px * (1 - ${p}) + 24px * ${p})`,
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
              filter: `drop-shadow(0 0 ${25 * (1 - p)}px rgba(134, 59, 255, ${0.75 * (1 - p)}))`,
              transition: 'none',
            }}
          />
        </a>

        {/* Divider line between Logo and Navigation Links */}
        <div
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

        {/* Navigation Items (Emerge smoothly as navbar forms) */}
        <div
          style={{
            display: 'flex',
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
      </nav>
    </header>
  );
};

export default Navbar;
