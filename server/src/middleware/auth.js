import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Circle } from '../models/Circle.js';
import { ParentDevice } from '../models/Access.js';
import { sha256 } from '../lib/tokens.js';
import { unauthorized, forbidden, notFound } from '../lib/errors.js';

// Two kinds of identity:
//   * Family members sign in with email + password -> signed JWT in an httpOnly cookie.
//   * A parent's phone is paired once -> random device token in an httpOnly cookie,
//     stored hashed in Mongo so it can be revoked from the dashboard at any time.

export const SESSION_COOKIE = 'saathi_session';
export const PARENT_COOKIE = 'saathi_parent';

const cookieBase = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
});

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
  res.cookie(SESSION_COOKIE, token, { ...cookieBase(), maxAge: config.sessionDays * 86400 * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieBase());
}

export function setParentCookie(res, token) {
  res.cookie(PARENT_COOKIE, token, { ...cookieBase(), maxAge: config.parentDeviceDays * 86400 * 1000 });
}

export function clearParentCookie(res) {
  res.clearCookie(PARENT_COOKIE, cookieBase());
}

/** Requires a signed-in family member. Sets req.user. */
export async function requireUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('This account no longer exists.');
  req.user = user;
  next();
}

/**
 * Loads :circleId and checks the signed-in user is a member.
 * Returns 404 (not 403) for circles you are not in, so ids cannot be probed.
 */
export async function loadCircle(req, _res, next) {
  const { circleId } = req.params;
  if (!mongoose.isValidObjectId(circleId)) throw notFound('Circle not found.');
  const circle = await Circle.findById(circleId);
  const membership = circle?.memberOf(req.user._id);
  if (!circle || !membership) throw notFound('Circle not found.');
  req.circle = circle;
  req.membership = membership;
  next();
}

export function requireOwner(req, _res, next) {
  if (req.membership?.role !== 'owner') throw forbidden('Only the circle owner can do this.');
  next();
}

/** Requires a paired parent phone. Sets req.device and req.circle. */
export async function requireParent(req, res, next) {
  const token = req.cookies?.[PARENT_COOKIE];
  if (!token) throw unauthorized('This phone is not paired yet.');
  const device = await ParentDevice.findOne({ tokenHash: sha256(token) });
  if (!device || device.revokedAt) {
    clearParentCookie(res);
    throw unauthorized('This phone was unpaired. Ask your family for a new code.');
  }
  const circle = await Circle.findById(device.circle);
  if (!circle) throw unauthorized('This care circle was deleted.');

  // Track "last seen" at most once every 10 minutes to avoid a write per request.
  if (Date.now() - device.lastSeenAt.getTime() > 10 * 60 * 1000) {
    device.lastSeenAt = new Date();
    await device.save();
  }
  req.device = device;
  req.circle = circle;
  next();
}
