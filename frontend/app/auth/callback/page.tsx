'use client';

import { useEffect, useState } from 'react';
import { setToken } from '@/lib/api';

/**
 * Where the backend drops the browser after Google sign-in.
 *
 * The token arrives in the URL *fragment* rather than the query string, so it
 * never reaches a server log or a Referer header — it's read here and swapped
 * straight into localStorage.
 */
export default function AuthCallback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');

    if (!token) {
      setFailed(true);
      return;
    }

    setToken(token);
    // replace(), not assign() — the token must not sit in the back button.
    window.location.replace(process.env.NEXT_PUBLIC_BASE_PATH || '/');
  }, []);

  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        background: '#2a1f3d',
        color: '#fff4e3',
        font: '500 16px/1.5 system-ui, sans-serif',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      {failed ? (
        <div>
          <p>Sign-in didn&apos;t complete.</p>
          <p style={{ opacity: 0.7 }}>
            <a href={process.env.NEXT_PUBLIC_BASE_PATH || '/'} style={{ color: '#ff6f59' }}>
              Back to the game
            </a>
          </p>
        </div>
      ) : (
        <p>Signing you in…</p>
      )}
    </main>
  );
}
