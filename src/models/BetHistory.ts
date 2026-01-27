import mongoose from 'mongoose';

const BetHistorySchema = new mongoose.Schema(
  {
    botInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    tip_id : {
        type: String,
        required: true,
    },

    tip: {
      type: String,
      required: true,
    },

    stake: {
      type: Number,
      required: true,
    },
    
    failedCount : {
      type: Number,
      default:0,
      required: true,
    },

    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },

  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

export default mongoose.model('BetHistory', BetHistorySchema);
