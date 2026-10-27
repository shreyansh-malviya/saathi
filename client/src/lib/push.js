import { get, post } from './api.js';

// Web Push helpers. The service worker (public/sw.js) shows the notification;
// here we only register it and send the subscription to the server.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Ask permission, subscribe this browser and register it with the server.
 * @param {'user'|'parent'} who  which endpoint to register with
 * @param {string} [publicKey]  VAPID key if the caller already has it
 */
export async function enablePush(who = 'user', publicKey) {
  if (!pushSupported()) throw new Error('This browser cannot show notifications. On iPhone, add Saathi to the home screen first.');
  if (import.meta.env.DEV) await navigator.serviceWorker.register('/sw.js');
  const key = publicKey || (await get('/me/push/public-key')).publicKey;
  if (!key) throw new Error('Notifications are not set up on this server.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were blocked. You can allow them from the browser settings.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  const json = sub.toJSON();
  await post(who === 'parent' ? '/parent/push/subscribe' : '/me/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return true;
}
