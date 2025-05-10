const mongoose = require('mongoose');

const macroGoalsSchema = mongoose.Schema({
  goalProtein: {
    type: Number,
    required: true
  },
  goalCarbohydrate: {
    type: Number,
    required: true
  },
  goalFat: {
    type: Number,
    required: true
  },
  goalFiber: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const macroGoal = mongoose.model('macroGoal', macroGoalsSchema);

module.exports = macroGoal;