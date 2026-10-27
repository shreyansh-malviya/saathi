import webpush from 'web-push';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { ParentDevice } from '../models/Access.js';
import { Notification, Activity } from '../models/Care.js';

// Two delivery channels:
//   1. In-app notifications (always) - stored in Mongo, shown in the bell.
//   2. Web Push (best effort) - if the person allowed notifications on a device.
// A failed push must never fail the action that triggered it.

const pushEnabled = Boolean(config.vapid.publicKey && config.vapid.privateKey);
if (pushEnabled) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
}

async function sendPush(subscription, payload) {
  if (!pushEnabled || !subscription?.endpoint) return 'skipped';
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
    return 'sent';
  } catch (err) {
    // 404/410 mean the browser threw the subscription away; caller removes it.
    if (err.statusCode === 404 || err.statusCode === 410) return 'expired';
    console.warn('[push] failed:', err.statusCode || err.message);
    return 'failed';
  }
}

/**
 * Notify a list of users. Creates in-app notifications and pushes to their devices.
 * @param {string[]} userIds
 * @param {{circle, kind, severity?, title, body?, url?}} message
 */
export async function notifyUsers(userIds, message) {
  const ids = [...new Set(userIds.map(String))];
  if (ids.length === 0) return;

  await Notification.insertMany(
    ids.map((user) => ({
      user,
      circle: message.circle,
      kind: message.kind,
      severity: message.severity || 'info',
      title: message.title,
      body: message.body || '',
    }))
  );

  if (!pushEnabled) return;
  const users = await User.find({ _id: { $in: ids } }).select('+pushSubscriptions');
  const payload = {
    title: message.title,
    body: message.body || '',
    url: message.url || '/app',
    tag: `${message.kind}-${message.circle}`,
    urgent: message.severity === 'urgent',
  };
  await Promise.all(
    users.map(async (u) => {
      const results = await Promise.all(u.pushSubscriptions.map((s) => sendPush(s, payload)));
      const dead = u.pushSubscriptions.filter((_, i) => results[i] === 'expired').map((s) => s.endpoint);
      if (dead.length) {
        await User.updateOne({ _id: u._id }, { $pull: { pushSubscriptions: { endpoint: { $in: dead } } } });
      }
    })
  );
}

/** Push a message to every paired, non-revoked phone of the parent. */
export async function notifyParent(circleId, message) {
  if (!pushEnabled) return;
  const devices = await ParentDevice.find({ circle: circleId, revokedAt: null, 'pushSubscription.endpoint': { $exists: true } });
  await Promise.all(
    devices.map(async (d) => {
      const r = await sendPush(d.pushSubscription, { ...message, url: '/p' });
      if (r === 'expired') await ParentDevice.updateOne({ _id: d._id }, { $set: { pushSubscription: null } });
    })
  );
}

/** Append to the circle's timeline. */
export function logActivity(circleId, { actorType, actor = null, kind, message }) {
  return Activity.create({ circle: circleId, actorType, actor, kind, message });
}

export const pushPublicKey = () => (pushEnabled ? config.vapid.publicKey : null);
