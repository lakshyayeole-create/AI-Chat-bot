import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BackgroundAudio.css';

interface BackgroundAudioProps {
  isVisible?: boolean;
}

const STORAGE_KEY = 'anantya_audio_muted';
const AUDIO_SRC = '/background_audio.mpeg';
const DEFAULT_VOLUME = 0.35;

export const BackgroundAudio: React.FC<BackgroundAudioProps> = ({ isVisible = true }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize background audio element
  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = isMuted ? 0 : DEFAULT_VOLUME;
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    // Attempt to start playback if not muted
    if (!isMuted) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Autoplay blocked by browser policy until first user interaction
            setIsPlaying(false);
          });
      }
    }

    // First user interaction listener to trigger audio playback if blocked by browser policy
    const unlockAudio = () => {
      if (audioRef.current && !audioRef.current.muted && audioRef.current.paused) {
        const storedMute = localStorage.getItem(STORAGE_KEY) === 'true';
        if (!storedMute) {
          audioRef.current.volume = DEFAULT_VOLUME;
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(() => {});
        }
      }
      cleanupListeners();
    };

    const cleanupListeners = () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('scroll', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('scroll', unlockAudio, { passive: true });

    return () => {
      cleanupListeners();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Toggle Mute / Unmute handler
  const toggleMute = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      // Unmuting
      audio.muted = false;
      audio.volume = DEFAULT_VOLUME;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
      setIsMuted(false);
      localStorage.setItem(STORAGE_KEY, 'false');
    } else {
      // Muting
      audio.muted = true;
      audio.pause();
      setIsPlaying(false);
      setIsMuted(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, [isMuted]);

  return (
    <div
      className={`audio-controller-root ${isVisible ? 'is-visible' : ''}`}
      aria-label="Background music controller"
    >
      <button
        type="button"
        className={`audio-hud-btn ${isMuted ? 'is-muted' : 'is-playing'}`}
        onClick={toggleMute}
        title={isMuted ? 'Unmute Background Music' : 'Mute Background Music'}
        aria-pressed={!isMuted}
      >
        {/* Animated Equalizer Wave Bars */}
        <div className={`audio-eq-waves ${!isMuted && isPlaying ? 'active' : ''}`} aria-hidden="true">
          <span className="eq-bar bar-1" />
          <span className="eq-bar bar-2" />
          <span className="eq-bar bar-3" />
        </div>

        {/* Dynamic Speaker / Mute Icon */}
        <div className="audio-icon-wrap" aria-hidden="true">
          {isMuted ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </div>

        {/* Text Label */}
        <span className="audio-btn-label">
          {isMuted ? 'MUTED' : 'SOUND'}
        </span>
      </button>
    </div>
  );
};

export default BackgroundAudio;
