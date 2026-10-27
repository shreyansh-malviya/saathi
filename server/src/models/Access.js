import mongoose from 'mongoose';

// Everything that grants access to a circle without a password lives here:
// sibling invite links, parent pairing codes and the paired parent phones.

const { ObjectId } = mongoose.Schema.Types;

const inviteSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    relation: { type: String, trim: true, maxlength: 30, default: '' },
    expiresAt: { type: Date, required: true },
    usedBy: { type: ObjectId, ref: 'User', default: null },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const pairingCodeSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true, index: true },
    codeHash: { type: String, required: true, index: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// Mongo removes expired codes on its own a little after expiry.
pairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: String,
    keys: { p256dh: String, auth: String },
  },
  { _id: false }
);

const parentDeviceSchema = new mongoose.Schema(
  {
    circle: { type: ObjectId, ref: 'Circle', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    label: { type: String, maxlength: 80, default: 'Phone' },
    pairedBy: { type: ObjectId, ref: 'User' },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    pushSubscription: { type: pushSubscriptionSchema, default: null },
  },
  { timestamps: true }
);

export const Invite = mongoose.model('Invite', inviteSchema);
export const PairingCode = mongoose.model('PairingCode', pairingCodeSchema);
export const ParentDevice = mongoose.model('ParentDevice', parentDeviceSchema);
