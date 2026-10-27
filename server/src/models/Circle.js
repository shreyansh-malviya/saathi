import mongoose from 'mongoose';
import { DEFAULT_TZ } from '../lib/time.js';

// A care circle is the group of people looking after one parent.
// The parent is not a User: they never sign up, they only pair a phone.

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    relation: { type: String, trim: true, maxlength: 30, default: '' }, // "Son", "Neighbour"
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    // Escalation order: 1 is called first when a check-in is missed.
    order: { type: Number, default: 99 },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const circleSchema = new mongoose.Schema(
  {
    parent: {
      name: { type: String, required: true, trim: true, maxlength: 60 },
      callName: { type: String, required: true, trim: true, maxlength: 20 }, // "Maa", "Papa", "Nani"
      city: { type: String, trim: true, maxlength: 40, default: '' },
      language: { type: String, enum: ['en', 'hi'], default: 'hi' },
    },
    timezone: { type: String, default: DEFAULT_TZ },
    checkIn: {
      // Minutes since local midnight.
      windowStart: { type: Number, default: 7 * 60, min: 0, max: 1439 },
      windowEnd: { type: Number, default: 10 * 60, min: 1, max: 1439 },
      // Minutes after windowEnd before the next step of the ladder.
      primaryAfter: { type: Number, default: 30, min: 5, max: 240 },
      circleAfter: { type: Number, default: 60, min: 10, max: 480 },
    },
    members: { type: [memberSchema], default: [] },
    // Holiday mode: no escalations up to and including this local date.
    pausedUntil: { type: String, default: null },
    pauseReason: { type: String, maxlength: 80, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
    // Demo circles only: minutes added to the real clock (see lib/clock.js).
    demoOffsetMin: { type: Number, default: 0 },
  },
  { timestamps: true }
);

circleSchema.index({ 'members.user': 1 });
circleSchema.index({ isDemo: 1, createdAt: 1 });

circleSchema.methods.memberOf = function memberOf(userId) {
  return this.members.find((m) => m.user.toString() === userId.toString());
};

/** Members sorted by escalation order (primary contact first). */
circleSchema.methods.orderedMembers = function orderedMembers() {
  return [...this.members].sort((a, b) => a.order - b.order || a.joinedAt - b.joinedAt);
};

export const Circle = mongoose.model('Circle', circleSchema);
