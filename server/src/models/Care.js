import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// --- Medicines -------------------------------------------------------------

const medicineSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    dose: { type: String, trim: true, maxlength: 40, default: '1 tablet' },
    times: { type: [String], required: true }, // ["08:00", "21:00"] local time
    instructions: { type: String, enum: ['before_food', 'after_food', 'any'], default: 'after_food' },
    startDate: { type: String, required: true }, // YYYY-MM-DD, used for adherence
    active: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const doseLogSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true },
    medicine: { type: ObjectId, ref: 'Medicine', required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    takenAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['parent', 'family'], default: 'parent' },
  },
  { timestamps: true }
);
// A dose slot can be marked only once. Second tap -> duplicate key -> treated as success.
doseLogSchema.index({ medicine: 1, date: 1, time: 1 }, { unique: true });
doseLogSchema.index({ circle: 1, date: 1 });

// --- Sibling task board ------------------------------------------------------

const taskSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    category: {
      type: String,
      enum: ['doctor', 'medicines', 'bills', 'groceries', 'repairs', 'other'],
      default: 'other',
    },
    dueDate: { type: String, default: null }, // YYYY-MM-DD
    status: { type: String, enum: ['open', 'claimed', 'done'], default: 'open' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    claimedBy: { type: ObjectId, ref: 'User', default: null },
    claimedAt: { type: Date, default: null },
    doneBy: { type: ObjectId, ref: 'User', default: null },
    doneAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// --- Notifications & activity -----------------------------------------------

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    circle: { type: ObjectId, ref: 'Circle' },
    kind: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warn', 'urgent'], default: 'info' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const activitySchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true },
    actorType: { type: String, enum: ['user', 'parent', 'system'], required: true },
    actor: { type: ObjectId, ref: 'User', default: null },
    kind: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);
activitySchema.index({ circle: 1, createdAt: -1 });

export const Medicine = mongoose.model('Medicine', medicineSchema);
export const DoseLog = mongoose.model('DoseLog', doseLogSchema);
export const Task = mongoose.model('Task', taskSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Activity = mongoose.model('Activity', activitySchema);
