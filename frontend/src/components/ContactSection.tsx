import React, { useState } from 'react';
import './ContactSection.css';

interface ContactSectionProps {
  onNavigate?: (sectionId: string) => void;
}

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Google Apps Script Web App Webhook for Anantya Contact Responses
const GOOGLE_SHEET_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbw5lw-O3JbcedDwAkjuvxjjiJR3LPMQUUASR_WsJkNwkJlmgcgAJ5UTxF5jq1Wkjlz8/exec';

export const ContactSection: React.FC<ContactSectionProps> = ({ onNavigate: _onNavigate }) => {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToken, setSuccessToken] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (errorMessage) setErrorMessage(null);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill in your name, email, and message.');
      return;
    }

    setFormStatus('sending');
    setErrorMessage(null);

    const backendUrl =
      (typeof window !== 'undefined' && (window as any).__BACKEND_URL__) ||
      'http://localhost:8001';

    try {
      // 1. Submit directly to FastAPI backend which stores message in MongoDB
      const res = await fetch(`${backendUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject?.trim() || 'General Inquiry',
          message: formData.message.trim(),
        }),
      });

      // 2. Also notify Google Sheet webhook in background for legacy tracking
      try {
        fetch(GOOGLE_SHEET_WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            subject: formData.subject || 'General Inquiry',
            message: formData.message,
            timestamp: new Date().toLocaleString(),
          }),
        }).catch(() => {});
      } catch (_) {}

      if (res.ok) {
        const data = await res.json();
        setSuccessToken(data.reference_code || `AVN-COMM-${Math.floor(1000 + Math.random() * 9000)}`);
        setErrorMessage(null);
        setFormStatus('success');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('Backend contact submission note:', errData);
        let detailMsg = 'Failed to relay transmission. Please verify your details.';
        if (errData.detail) {
          if (Array.isArray(errData.detail) && errData.detail[0]?.msg) {
            detailMsg = errData.detail[0].msg.replace('Value error, ', '');
          } else if (typeof errData.detail === 'string') {
            detailMsg = errData.detail;
          }
        }
        setErrorMessage(detailMsg);
        setFormStatus('idle');
      }
    } catch (error) {
      console.error('Transmission error:', error);
      setErrorMessage('Could not reach backend service. Check if backend is running on port 8001.');
      setFormStatus('idle');
    }
  };


  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: '',
    });
    setFormStatus('idle');
  };

  return (
    <section id="contact" className="marvel-contact-section">
      {/* Background Dark Gradient Overlay for optimal legibility */}
      <div className="marvel-contact-overlay" />

      <div className="marvel-contact-container">
        {/* Top Header */}
        <div className="marvel-contact-header">
          <span className="marvel-overline">LET&apos;S CONNECT</span>
          <h2 className="marvel-main-title">
            CONTACT <span className="marvel-title-accent">US</span>
          </h2>
          <p className="marvel-header-desc">
            Have a question, suggestion, or want to be a part of something amazing?
            <br />
            We&apos;d love to hear from you.
          </p>
        </div>

        {/* Main Form Glass Card */}
        <div className="marvel-form-card">
          {/* Glowing Red Corner Notches (Top-Left & Bottom-Right) */}
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-br" />

          {formStatus === 'success' ? (
            <div className="marvel-success-view">
              <div className="marvel-success-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="marvel-success-title">TRANSMISSION RECEIVED</h3>
              <p className="marvel-success-msg">
                Thank you, <strong>{formData.name}</strong>. Your message has been encrypted and relayed directly to Anantya 2026 Central Command.
              </p>
              <div className="marvel-success-ref">
                REF CODE: <span>{successToken}</span>
              </div>
              <button
                type="button"
                className="marvel-reset-btn"
                onClick={handleReset}
              >
                SEND ANOTHER MESSAGE
              </button>
            </div>
          ) : (
            <form className="marvel-form" onSubmit={handleSubmit}>
              {/* Row 1: Your Name & Your Email */}
              <div className="marvel-form-row-2col">
                <div className="marvel-input-group">
                  <span className="marvel-input-icon">
                    {/* User Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your Name"
                    className="marvel-input"
                  />
                </div>

                <div className="marvel-input-group">
                  <span className="marvel-input-icon">
                    {/* Mail Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Your Email"
                    className="marvel-input"
                  />
                </div>
              </div>

              {/* Row 2: Subject */}
              <div className="marvel-form-row">
                <div className="marvel-input-group">
                  <span className="marvel-input-icon">
                    {/* Document / File Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="contact-subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Subject"
                    className="marvel-input"
                  />
                </div>
              </div>

              {/* Row 3: Your Message */}
              <div className="marvel-form-row">
                <div className="marvel-input-group textarea-group">
                  <span className="marvel-input-icon textarea-icon">
                    {/* Message Bubble Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Your Message"
                    className="marvel-textarea"
                  />
                  {/* Subtle Resize Grip */}
                  <div className="textarea-grip">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                      <line x1="9" y1="5" x2="5" y2="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Error Message HUD */}
              {errorMessage && (
                <div
                  className="marvel-form-error"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    color: '#fca5a5',
                    fontSize: '0.85rem',
                    letterSpacing: '0.02em',
                    lineHeight: 1.4,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={formStatus === 'sending'}
                className={`marvel-submit-btn ${formStatus === 'sending' ? 'sending' : ''}`}
              >
                <span className="btn-label">
                  {formStatus === 'sending' ? 'TRANSMITTING...' : 'SEND MESSAGE'}
                </span>
                <span className="btn-arrow-icon">
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                    <path
                      d="M1 6H20.5M20.5 6L15.5 1M20.5 6L15.5 11"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
