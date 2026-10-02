import React, { useState, useEffect } from 'react';
import './ScrollGuidance.css';

interface ScrollGuidanceProps {
  activeSection: 'home' | 'about' | 'events' | 'gallery' | 'contact';
  onNavigate?: (sectionId: string) => void;
}

export const ScrollGuidance: React.FC<ScrollGuidanceProps> = ({
  activeSection,
}) => {
  const [globalProgress, setGlobalProgress] = useState(0);

  // Monitor window scroll to compute overall page depth (throttled to integer percentage changes)
  useEffect(() => {
    let lastPct = -1;
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
      const pct = Math.round(progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        setGlobalProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const isContact = activeSection === 'contact' || globalProgress > 0.95;

  return (
    <>
      {/* 1. Global Holographic Top Laser Scroll Progress Bar */}
      <div className="hud-top-progress-bar-container" aria-hidden="true">
        <div
          className="hud-top-progress-bar-fill"
          style={{ width: `${Math.round(globalProgress * 100)}%` }}
        />
        <div
          className="hud-top-progress-beacon"
          style={{ left: `${Math.round(globalProgress * 100)}%` }}
        />
      </div>

      {/* 2. Non-Clickable Floating Bottom Scroll Prompter */}
      <div
        className={`hud-bottom-prompter ${isContact ? 'hidden' : ''}`}
        aria-hidden="true"
      >
        <div className="prompter-inner-glass">
          {/* Text Cue: Keep Scrolling */}
          <span className="prompter-main-msg">KEEP SCROLLING</span>

          {/* Mouse Logo */}
          <div className="prompter-mouse-chassis">
            <div className="prompter-mouse-roller" />
          </div>
        </div>
      </div>
    </>
  );
};

export default ScrollGuidance;

