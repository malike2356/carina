import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split-root">
      <div className="auth-split-brand">
        <div className="auth-split-brand-inner">
          <div className="auth-split-logo">
            <span className="auth-split-logo-mark">A</span>
            <span className="auth-split-logo-name">Aiva</span>
          </div>
          <div className="auth-split-copy">
            <h2 className="auth-split-headline">Your AI employee is ready to work.</h2>
            <p className="auth-split-sub">
              Aiva handles messages, bookings, follow-ups, and recurring admin
              so you stay focused on what matters.
            </p>
          </div>
          <ul className="auth-split-trust">
            <li>15-day free trial</li>
            <li>No card required</li>
            <li>Cancel any time</li>
          </ul>
        </div>
      </div>
      <div className="auth-split-form">
        <div className="auth-split-form-inner">
          {children}
        </div>
        <p className="auth-split-help">
          Need help?{' '}
          <a href="mailto:hello@carinaai.uk">hello@carinaai.uk</a>
        </p>
      </div>
      <style>{`
        .auth-split-root {
          display: flex;
          min-height: 100vh;
        }

        /* Dark brand panel */
        .auth-split-brand {
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #0d1f2d;
          padding: 3rem 3.5rem;
          width: 40%;
          flex-shrink: 0;
        }
        .auth-split-brand-inner {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          max-width: 320px;
        }
        .auth-split-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .auth-split-logo-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f5a623;
          color: #0d1f2d;
          font-weight: 700;
          font-size: 1rem;
          font-family: ui-sans-serif, system-ui, sans-serif;
          flex-shrink: 0;
        }
        .auth-split-logo-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: #f0f4f7;
          font-family: ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.01em;
        }
        .auth-split-headline {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.85rem;
          font-weight: 400;
          line-height: 1.25;
          color: #f0f4f7;
          margin: 0;
        }
        .auth-split-sub {
          font-size: 0.9rem;
          line-height: 1.65;
          color: #7a9ab0;
          margin: 0;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .auth-split-trust {
          list-style: none;
          margin: 0;
          padding: 0;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .auth-split-trust li {
          font-size: 0.8rem;
          color: #5c7f96;
          font-family: ui-sans-serif, system-ui, sans-serif;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .auth-split-trust li::before {
          content: '';
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #f5a623;
          flex-shrink: 0;
        }

        /* Light form panel */
        .auth-split-form {
          flex: 1;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 3rem 2rem 2rem;
          position: relative;
        }
        .auth-split-form-inner {
          width: 100%;
          max-width: 400px;
        }
        /* Override dark-mode token colours inside the light panel */
        .auth-split-form,
        .auth-split-form * {
          color-scheme: light;
        }
        .auth-split-form h1 {
          color: #0d1f2d;
        }
        .auth-split-form p,
        .auth-split-form label {
          color: #4a6575;
        }
        .auth-split-form input[type="email"],
        .auth-split-form input[type="password"],
        .auth-split-form input[type="text"],
        .auth-split-form input:not([type="checkbox"]):not([type="hidden"]):not([type="submit"]) {
          background: #f7fafc;
          border-color: #d1dde6;
          color: #0d1f2d;
        }
        .auth-split-form .bg-elevated {
          background: #f7fafc !important;
        }
        .auth-split-form input:focus {
          border-color: #1a5f7a;
          outline: none;
          box-shadow: 0 0 0 2px rgba(26,95,122,0.12);
        }
        .auth-split-form form {
          background: #f7fafc;
          border-color: #e2ecf2;
        }
        .auth-split-form button[type="submit"] {
          background: #0d1f2d;
          color: #ffffff;
          border: none;
        }
        .auth-split-form button[type="submit"]:hover {
          background: #1a3a52;
        }
        .auth-split-form a {
          color: #1a5f7a;
        }
        .auth-split-form .text-accent {
          color: #1a5f7a !important;
        }
        .auth-split-form .text-text-primary {
          color: #0d1f2d !important;
        }
        .auth-split-form .text-text-secondary {
          color: #4a6575 !important;
        }
        .auth-split-form .text-text-muted {
          color: #7a9ab0 !important;
        }
        .auth-split-form .bg-surface {
          background: #f7fafc !important;
        }
        .auth-split-form .border-border {
          border-color: #e2ecf2 !important;
        }
        .auth-split-form .text-danger {
          color: #c0392b !important;
        }
        .auth-split-help {
          position: absolute;
          bottom: 1.5rem;
          font-size: 0.78rem;
          color: #7a9ab0;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .auth-split-help a {
          color: #1a5f7a;
        }

        /* Hide the outer min-h-screen centering from page components */
        .auth-split-form-inner > main {
          min-height: unset !important;
          max-width: unset !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        /* Mobile: hide brand panel, full width light form */
        @media (max-width: 767px) {
          .auth-split-brand { display: none; }
          .auth-split-form { padding: 2rem 1.25rem 4rem; }
        }
      `}</style>
    </div>
  );
}
