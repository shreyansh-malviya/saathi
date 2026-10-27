import mongoose from 'mongoose';

// One document per circle per local calendar day. It holds the check-in and the
// state of the escalation ladder for that day. The unique (circle, date) index is
// what makes a double tap on "I'm OK" harmless and lets two cron runs race safely.

const { ObjectId } = mongoose.Schema.Types;

const escalationSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true }, // 1 nudge parent, 2 primary contact, 3 whole circle
    at: { type: Date, default: Date.now },
    notified: [{ type: ObjectId, ref: 'User' }],
    parentNudged: { type: Boolean, default: false },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD in the circle's timezone
    checkedInAt: { type: Date, default: null },
    mood: { type: String, enum: ['good', 'okay', 'unwell', null], default: null },
    source: { type: String, enum: ['parent', 'family', null], default: null },
    checkedInBy: { type: ObjectId, ref: 'User', default: null }, // set when family checks in on behalf
    level: { type: Number, default: 0 },
    escalations: { type: [escalationSchema], default: [] },
    resolution: {
      by: { type: ObjectId, ref: 'User', default: null },
      note: { type: String, maxlength: 200, default: '' },
      at: { type: Date, default: null },
    },
    helpRequests: [{ at: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true }
);

daySchema.index({ circle: 1, date: 1 }, { unique: true });

export const Day = mongoose.model('Day', daySchema);
