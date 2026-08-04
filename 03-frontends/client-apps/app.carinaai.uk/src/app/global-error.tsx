'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          maxWidth: '28rem',
          margin: '0 auto',
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
        <p style={{ color: '#4a6575', marginBottom: '1rem' }}>
          We could not load this page. Refresh and try again. If you just created an account,
          complete any legal acceptance prompt, then continue to billing.
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#7a9ab0' }}>Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1dde6',
            background: '#0d1f2d',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
