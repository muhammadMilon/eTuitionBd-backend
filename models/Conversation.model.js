import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    tuitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tuition',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a conversation between the same participants for the same tuition is unique (optional)
// conversationSchema.index({ participants: 1, tuitionId: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
