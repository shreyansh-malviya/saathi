import { Router } from 'express';
import { Invite } from '../models/Access.js';
import { Circle } from '../models/Circle.js';
import { User } from '../models/User.js';
import { requireUser } from '../middleware/auth.js';
import { sha256 } from '../lib/tokens.js';
import { notFound, gone, conflict, badRequest } from '../lib/errors.js';
import { logActivity, notifyUsers } from '../services/notify.js';

const router = Router();

async function findValidInvite(token) {
  const invite = await Invite.findOne({ tokenHash: sha256(token) });
  if (!invite || invite.revokedAt) throw notFound('This invite link is not valid.');
  if (invite.usedAt) throw gone('This invite link has already been used. Ask for a new one.');
  if (invite.expiresAt < new Date()) throw gone('This invite link has expired. Ask for a new one.');
  const circle = await Circle.findById(invite.circle);
  if (!circle) throw notFound('This circle no longer exists.');
  return { invite, circle };
}

/** Public preview so the join page can say who invited you, before sign-up. */
router.get('/:token', async (req, res) => {
  const { invite, circle } = await findValidInvite(req.params.token);
  const inviter = await User.findById(invite.createdBy).select('name');
  res.json({
    callName: circle.parent.callName,
    parentName: circle.parent.name,
    city: circle.parent.city,
    invitedBy: inviter?.name || 'Someone',
    relation: invite.relation,
    members: circle.members.length,
    expiresAt: invite.expiresAt,
  });
});

router.post('/:token/accept', requireUser, async (req, res) => {
  const { invite, circle } = await findValidInvite(req.params.token);
  if (circle.memberOf(req.user._id)) throw conflict('You are already in this circle.', { circleId: circle._id });
  if (circle.members.length >= 8) throw badRequest('This circle is full (8 people).');

  // Mark used atomically so one link cannot add two people.
  const claimed = await Invite.findOneAndUpdate(
    { _id: invite._id, usedAt: null },
    { $set: { usedAt: new Date(), usedBy: req.user._id } },
    { new: true }
  );
  if (!claimed) throw gone('This invite link has already been used. Ask for a new one.');

  const nextOrder = Math.max(0, ...circle.members.map((m) => m.order)) + 1;
  // $addToSet-like guard: push only if not already a member (protects against double submit).
  const updated = await Circle.findOneAndUpdate(
    { _id: circle._id, 'members.user': { $ne: req.user._id } },
    { $push: { members: { user: req.user._id, role: 'member', relation: invite.relation, order: nextOrder } } },
    { new: true }
  );
  if (!updated) throw conflict('You are already in this circle.', { circleId: circle._id });

  const others = circle.members.map((m) => m.user);
  await Promise.all([
    logActivity(circle._id, { actorType: 'user', actor: req.user._id, kind: 'member_joined', message: `${req.user.name} joined the circle.` }),
    notifyUsers(others, { circle: circle._id, kind: 'member_joined', title: `${req.user.name} joined ${circle.parent.callName}'s circle`, body: 'They will now get alerts in their turn.' }),
  ]);
  res.json({ circleId: circle._id.toString() });
});

export default router;
