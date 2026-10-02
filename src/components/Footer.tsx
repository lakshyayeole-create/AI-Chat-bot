import React from 'react';
import './Footer.css';

interface FooterProps {
  onNavigate?: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (sectionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="anantya-footer">
      {/* ── Glowing Marvel Neon Horizon Seam ── */}
      <div className="footer-glow-seam" aria-hidden="true">
        <div className="footer-seam-core" />
        <div className="footer-seam-glow" />
      </div>

      <div className="footer-container">
        {/* ── Main 4-Column Grid ── */}
        <div className="footer-grid">
          {/* Column 1: Brand & Multiverse Core */}
          {/* Column 1: Brand & Multiverse Core */}
          <div className="footer-col brand-col">
            <div className="footer-brand-header">
              <img
                src="/assets/ANANTYA.png"
                alt="Anantya 2026 Logo"
                className="footer-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="footer-brand-text">
                <span className="footer-title-main">ANANTYA</span>
                <span className="footer-title-sub">2026 • MULTIVERSE</span>
              </div>
            </div>

            <div className="footer-institute">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Pimpri Chinchwad College of Engineering (PCCOE), Pune</span>
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="footer-col nav-col">
            <h4 className="footer-col-title">
              <span className="title-dash" /> NAVIGATION
            </h4>
            <ul className="footer-links-list">
              <li>
                <a href="#home" onClick={(e) => handleNavClick('home', e)}>
                  <span className="link-arrow">›</span> Home
                </a>
              </li>
              <li>
                <a href="#about" onClick={(e) => handleNavClick('about', e)}>
                  <span className="link-arrow">›</span> About
                </a>
              </li>
              <li>
                <a href="#events" onClick={(e) => handleNavClick('events', e)}>
                  <span className="link-arrow">›</span> Events
                </a>
              </li>
              <li>
                <a href="#gallery" onClick={(e) => handleNavClick('gallery', e)}>
                  <span className="link-arrow">›</span> Gallery
                </a>
              </li>
              <li>
                <a href="#contact" onClick={(e) => handleNavClick('contact', e)}>
                  <span className="link-arrow">›</span> Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Event Portals (Direct URLs) */}
          <div className="footer-col portals-col">
            <h4 className="footer-col-title">
              <span className="title-dash" /> EVENT SITES
            </h4>
            <ul className="footer-links-list">
              <li>
                <a href="https://pccoe-codigo-2026.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> CODIGO! (ACM) ↗
                </a>
              </li>
              <li>
                <a href="https://shesolves3-0.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> SheSolves 3.0 (ACM-W) ↗
                </a>
              </li>
              <li>
                <a href="https://bytemectf.owasppccoe.in/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> BYTE ME CTF &apos;26 (OWASP) ↗
                </a>
              </li>
              <li>
                <a href="https://masterchefui-gdgc.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> MasterChef UI (GDGC) ↗
                </a>
              </li>
              <li>
                <a href="https://decentrahack.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> DecentraHack 2.0 (LFDT) ↗
                </a>
              </li>
              <li>
                <a href="https://iothrone.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> IoThrone 2026 (IRIS) ↗
                </a>
              </li>
              <li>
                <a href="https://make-a-doodle.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <span className="link-arrow">›</span> Make a Doodle (Art) ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Socials */}
          <div className="footer-col connect-col">
            <h4 className="footer-col-title">
              <span className="title-dash" /> CONTACT
            </h4>

            <a href="mailto:cesa@pccoepune.org" className="footer-email-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>cesa@pccoepune.org</span>
            </a>

            {/* Social Icons */}
            <div className="footer-social-row">
              <a
                href="https://www.instagram.com/pccoepune/"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Instagram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>

              <a
                href="https://twitter.com/pccoe_pune"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Twitter (X)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              <a
                href="https://www.linkedin.com/company/pccoe-pune?trk=biz-companies-cym"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>

              <a
                href="https://www.youtube.com/channel/UCQiPDETOiteTLmAvvPk1WjA"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="YouTube"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                </svg>
              </a>
            </div>

            {/* Back to top Cyber button */}
            <button
              type="button"
              className="footer-top-btn"
              onClick={scrollToTop}
              aria-label="Scroll to top"
            >
              <span>RETURN TO APEX</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Sub-Footer Bottom Bar ── */}
        <div className="footer-bottom-bar">
          <div className="bottom-left">
            <span>© 2026 ANANTYA PCCOE. All Rights Reserved.</span>
          </div>

          <div className="bottom-right">
            <span>Organized with ❤️ by CESA</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
