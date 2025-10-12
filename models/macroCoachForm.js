const mongoose = require('mongoose');

const macroCoachFormSchema = mongoose.Schema({
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  heightFeet: {
    type: Number
  },
  heightInches: {
    type: Number
  },
  unit: {
    type: String,
    enum: ['metric', 'imperial'],
    required: true
  },
  bodyFatPercentage: {
    type: Number, // e.g. 18 (exact slider value)
    required: true
  },
  lifeStyleFactor: {
    type: String,
    required: true
  },
  exerciseFactor: {
    type: String,
    required: true
  },
  goal: {
    type: String,
    enum: ['fat-loss', 'weight-gain', 'reverse-diet', 'maintenance'],
    required: true
  },
  goalSpeed: {
    type: String,
    enum: ['no-change','very slow', 'slow', 'medium', 'fast', 'aggressive'],
    required: true
  },
  carbIntake: Number,
  proteinIntake: Number,
  fatIntake: Number,
  weightChange: Number,
  current: {
    type: String,
    enum: ['fat-loss', 'weight-gain', 'no-change'],
  },
//   carbPreference: {
//     type: String,
//     enum: ['none', 'carbs', 'fat']
//   },
//   proteinPreference: {
//     type: String,
//     enum: ['low', 'low-moderate', 'moderate', 'moderate-high', 'high']
//   },
  acceptedTerms: {
    type: Boolean,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true 
  }
}, { timestamps: true });

const macroCoachForm = mongoose.model('macroCoachForm', macroCoachFormSchema);

module.exports = macroCoachForm;