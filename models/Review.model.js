import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    tuitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tuition',
      // Optional: link to a specific tuition experience
    }
  },
  {
    timestamps: true,
  }
);

// Prevent multiple reviews from the same student for the same tutor (optional but good practice)
// reviewSchema.index({ studentId: 1, tutorId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
