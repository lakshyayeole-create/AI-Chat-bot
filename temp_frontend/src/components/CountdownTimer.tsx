import React, { useState, useEffect } from 'react';
import './CountdownTimer.css';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

// Target: 9th October 2026 at 09:00 AM IST
const TARGET_TIMESTAMP = new Date('2026-10-09T09:00:00+05:30').getTime();

export const CountdownTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  function calculateTimeLeft(): TimeLeft {
    const now = Date.now();
    const difference = TARGET_TIMESTAMP - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isExpired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => String(num).padStart(2, '0');

  return (
    <div className="hero-countdown-wrap">
      <div className="countdown-telemetry-header">
        <span className="countdown-pulse-dot" />
        <span className="countdown-telemetry-label">EVENT BEGINS IN • 9TH OCT 2026</span>
      </div>

      <div className="countdown-units-grid">
        <div className="countdown-box">
          <span className="countdown-digit">{formatNumber(timeLeft.days)}</span>
          <span className="countdown-unit-label">DAYS</span>
        </div>
        <span className="countdown-colon">:</span>
        <div className="countdown-box">
          <span className="countdown-digit">{formatNumber(timeLeft.hours)}</span>
          <span className="countdown-unit-label">HOURS</span>
        </div>
        <span className="countdown-colon">:</span>
        <div className="countdown-box">
          <span className="countdown-digit">{formatNumber(timeLeft.minutes)}</span>
          <span className="countdown-unit-label">MINS</span>
        </div>
        <span className="countdown-colon">:</span>
        <div className="countdown-box">
          <span className="countdown-digit">{formatNumber(timeLeft.seconds)}</span>
          <span className="countdown-unit-label">SECS</span>
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;
