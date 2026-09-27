import React, { useState } from 'react';

/**
 * ============================================================================
 * NAVBAR CUSTOMIZATION VARIABLES
 * You can edit all these values directly here to customize the navbar!
 * ============================================================================
 */
export const NAVBAR_CONFIG = {
  // --- Position & Dimensions ---
  top: '24px',                             // Distance from top of screen
  minHeight: '96px',                       // Height of the navbar (frames the 80px logo)
  minWidth: '820px',                       // Width of the navbar
  padding: '10px 36px',                    // Inner padding: vertical horizontal
  gap: '24px',                             // Spacing between nav items

  // --- Background & Glassmorphism ---
  background: 'rgba(8, 14, 26, 0.78)',     // Frosted glass background
  backdropBlur: '20px',                    // Glass blur radius
  borderColor: 'rgba(255, 255, 255, 0.14)',// Border color
  borderWidth: '1px',                      // Border width
  borderRadius: '9999px',                  // Capsule rounded corners
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)',

  // --- Anantya Logo ---
  logoHeight: '80px',                      // Logo image height
  logoMaxHeight: '200px',                  // Logo maximum height
  logoFilter: 'none',                      // No glow filter

  // --- Divider between Logo and Links ---
  showDivider: true,                       // Set to false to hide divider
  dividerWidth: '1.5px',                   // Divider thickness
  dividerHeight: '46px',                   // Divider vertical height
  dividerColor: 'rgba(255, 255, 255, 0.18)',// Divider color
  dividerMargin: '0 12px',                 // Divider horizontal margin

  // --- Nav Items: Typography & Colors ---
  fontSize: '1.25rem',                     // Constant font size (~20px)
  fontWeight: 600,                         // Font weight
  letterSpacing: '1.8px',                  // Letter spacing
  itemPadding: '10px 18px',                // Padding per item

  // Colors (no glow, just clean color change)
  textColor: '#9ca3af',                    // Inactive text color (grey)
  activeTextColor: '#ffffff',              // Active text color (white)
  hoverTextColor: '#e5e7eb',               // Hover text color (light grey)
};

export interface NavItem {
  id: string;
  label: string;
  href?: string;
}

export interface NavbarProps {
  /** Optional logo image source (defaults to 'assets/ANANTYA.png') */
  logoSrc?: string;
  /** Active item id (defaults to 'home') */
  activeId?: string;
  /** Callback when an item is clicked */
  onSelect?: (id: string) => void;
  /** Optional custom class name */
  className?: string;
  /** Optional config overrides */
  configOverrides?: Partial<typeof NAVBAR_CONFIG>;
}

const defaultItems: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'events', label: 'Events' },
  { id: 'contact', label: 'Contact' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'admin', label: 'Login' }
];

export const Navbar: React.FC<NavbarProps> = ({
  logoSrc = 'assets/ANANTYA.png',
  activeId = 'home',
  onSelect,
  className = '',
  configOverrides = {},
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeId);
  const cfg = { ...NAVBAR_CONFIG, ...configOverrides };

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedId(id);
    if (onSelect) {
      onSelect(id);
    }
  };

  return (
    <header
      className={className}
      style={{
        position: 'fixed',
        top: cfg.top,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        pointerEvents: 'auto',
      }}
    >
      <nav
        aria-label="Main Navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: cfg.gap,
          minHeight: cfg.minHeight,
          minWidth: cfg.minWidth,
          background: cfg.background,
          backdropFilter: `blur(${cfg.backdropBlur})`,
          WebkitBackdropFilter: `blur(${cfg.backdropBlur})`,
          padding: cfg.padding,
          borderRadius: cfg.borderRadius,
          border: `${cfg.borderWidth} solid ${cfg.borderColor}`,
          boxShadow: cfg.boxShadow,
          boxSizing: 'border-box',
        }}
      >
        {/* 1) Anantya Logo */}
        <a
          href="#home"
          onClick={(e) => handleItemClick('home', e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 8px',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          title="Anantya"
        >
          <img
            src={logoSrc}
            alt="Anantya Logo"
            style={{
              height: cfg.logoHeight,
              width: 'auto',
              maxHeight: cfg.logoMaxHeight,
              objectFit: 'contain',
              display: 'block',
              filter: cfg.logoFilter || 'none',
              transform: 'none',
            }}
          />
        </a>

        {/* Divider line */}
        {cfg.showDivider && (
          <div
            style={{
              width: cfg.dividerWidth,
              height: cfg.dividerHeight,
              background: cfg.dividerColor,
              margin: cfg.dividerMargin,
            }}
          />
        )}

        {/* 2) Home, 3) Events, 4) Contact, 5) Gallery */}
        {defaultItems.map((item) => {
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
                textShadow: 'none',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                transition: 'color 0.2s ease',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = cfg.hoverTextColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = cfg.textColor;
                }
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
};

export default Navbar;

