import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Notification } from '../models/Care.js';
import { validate } from '../middleware/http.js';
import { AppError } from '../lib/errors.js';
import { pushPublicKey } from '../services/notify.js';

// Per-user things: notification inbox and web push subscriptions.
const router = Router();

router.get('/notifications', async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40);
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({
    unread,
    items: items.map((n) => ({
      id: n._id.toString(),
      circle: n.circle?.toString() || null,
      kind: n.kind,
      severity: n.severity,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      at: n.createdAt,
    })),
  });
});

router.post('/notifications/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

router.post('/notifications/:id/read', async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } });
  }
  res.json({ ok: true });
});

router.get('/push/public-key', (_req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }),
});

router.post('/push/subscribe', validate(subSchema), async (req, res) => {
  if (!pushPublicKey()) throw new AppError(503, 'PUSH_DISABLED', 'Notifications are not set up on this server.');
  // Replace any old copy of the same endpoint, keep at most 5 devices per person.
  await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint: req.body.endpoint } } });
  await User.updateOne(
    { _id: req.user._id },
    { $push: { pushSubscriptions: { $each: [{ ...req.body, createdAt: new Date() }], $slice: -5 } } }
  );
  res.json({ ok: true });
});

router.post('/push/unsubscribe', validate(subSchema.pick({ endpoint: true })), async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint: req.body.endpoint } } });
  res.json({ ok: true });
});

export default router;
