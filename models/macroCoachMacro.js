// models/MacroCoachMacro.js
const mongoose = require('mongoose');

const macroCoachMacroSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Targets
    calories: { type: Number, required: true },
    protein:  { type: Number, required: true },
    carbs:    { type: Number, required: true },
    fat:      { type: Number, required: true },
    fiber:    { type: Number, required: true },

    // Engine / coach metadata
    reason:    { type: String }, // legacy free-text rationale
    reasonCode:{ type: String }, // e.g. 'adherence-low' | 'fatloss-band-0.5-1.0-unchanged' | ...
    uiMessage: { type: String }, // the user-facing message we show in UI

    // Context at the time of snapshot
    goal:      { type: String, enum: ['fat-loss', 'weight-gain', 'reverse-diet'], index: true },
    goalSpeed: { type: String, enum: ['slow', 'medium', 'fast'], index: true },

    weeklyAverage:         { type: Number }, // current week avg kg
    previousWeeklyAverage: { type: Number }, // previous week avg kg
  },
  { timestamps: true }
);

// Helpful compound index for fetching history quickly:
macroCoachMacroSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('MacroCoachMacro', macroCoachMacroSchema);