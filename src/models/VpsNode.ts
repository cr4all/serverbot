import mongoose from 'mongoose';

/**
 * Admin-managed VPS agent endpoints. Users pick one per bookmaker when creating a surebet bot.
 * Password is stored encrypted (CREDENTIALS_KEY), never returned to the browser.
 */
const VpsNodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Which bookmaker leg this agent serves. */
    role: { type: String, enum: ['BETONLINE', 'PS3838'], required: true, index: true },
    /** host or host:port for the inbound agent API. */
    address: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    /** Encrypted secret (enc:v1:...). */
    passwordSecret: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

VpsNodeSchema.index({ role: 1, enabled: 1, name: 1 });

export default mongoose.models.VpsNode || mongoose.model('VpsNode', VpsNodeSchema);
