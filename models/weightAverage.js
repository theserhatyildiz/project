
const mongoose = require('mongoose');

const weightAverageSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true,
  },
  weeklyAverage: {
    type: Number,
    default: 0
  },
  previousWeeklyAverage: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const weightAverage = mongoose.model("weightAverages", weightAverageSchema);

module.exports = weightAverage;