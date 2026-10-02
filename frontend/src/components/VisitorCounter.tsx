import React, { useState, useEffect } from 'react';
import './VisitorCounter.css';

interface VisitorCounterProps {
  isVisible?: boolean;
}

const STORAGE_KEY = 'anantya_site_visitor_count';
const SESSION_KEY = 'anantya_session_counted';

export const VisitorCounter: React.FC<VisitorCounterProps> = ({ isVisible = true }) => {
  const [displayCount, setDisplayCount] = useState<number>(0);

  // Initialize and increment count starting from 0
  useEffect(() => {
    try {
      // Clear legacy mock counter if present
      if (localStorage.getItem('anantya_2026_visitor_count')) {
        localStorage.removeItem('anantya_2026_visitor_count');
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      let currentCount = stored !== null ? parseInt(stored, 10) : 0;
      if (isNaN(currentCount) || currentCount < 0) {
        currentCount = 0;
      }

      // Check if this browser session has already been counted
      const sessionLogged = sessionStorage.getItem(SESSION_KEY);
      if (!sessionLogged) {
        currentCount += 1;
        sessionStorage.setItem(SESSION_KEY, 'true');
        localStorage.setItem(STORAGE_KEY, currentCount.toString());
      }

      setDisplayCount(currentCount);
    } catch {
      setDisplayCount(1);
    }
  }, []);

  return (
    <aside
      className={`visitor-counter-root ${isVisible ? 'is-visible' : ''}`}
      aria-label="Website visitor count"
    >
      <div className="visitor-hud-pill">
        {/* Glowing Radar Beacon */}
        <div className="visitor-beacon-wrap" title="Live telemetry active">
          <span className="beacon-ping" />
          <span className="beacon-core" />
        </div>

        {/* User Icon */}
        <div className="visitor-icon-wrap" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        {/* Counter Number Only */}
        <span className="visitor-number">
          {displayCount.toLocaleString()}
        </span>
      </div>
    </aside>
  );
};

export default VisitorCounter;
