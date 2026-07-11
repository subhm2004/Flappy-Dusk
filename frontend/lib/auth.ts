/**
 * Google sign-in, from the game's side.
 *
 * The awkward bit is Android: Google refuses OAuth inside an embedded WebView,
 * which is exactly what the APK is. So the app opens the *system* browser, the
 * backend finishes the exchange there, and hands the session back by redirecting
 * to `com.subhm2004.flappydusk://auth?token=…`, which Android routes into the
 * app (see frontend/scripts/android-deeplink.mjs).
 *
 * On the web there's no such dance: the backend just redirects to /auth/callback.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { API_URL, setToken } from './api';

export const isNative = () => Capacitor.isNativePlatform();

/** Sends the player off to pick a Google account. */
export async function signIn() {
  if (isNative()) {
    await Browser.open({ url: `${API_URL}/auth/google?platform=app` });
    return;
  }
  window.location.href = `${API_URL}/auth/google?platform=web`;
}

/**
 * Listens for the deep link that carries the session back into the app.
 * Returns an unsubscribe function; no-op on the web.
 */
export function listenForNativeSignIn(onToken: (token: string) => void): () => void {
  if (!isNative()) return () => {};

  const handle = App.addListener('appUrlOpen', ({ url }) => {
    const token = new URL(url).searchParams.get('token');
    if (!token) return;

    setToken(token);
    onToken(token);
    // The system browser is still sitting on top of the game.
    void Browser.close();
  });

  return () => {
    void handle.then((h) => h.remove());
  };
}
