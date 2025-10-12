const mongoose = require('mongoose');

const macroCoachWeeklyMacroAverageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  protein: { type: Number, default: 0 },
  carbs:   { type: Number, default: 0 },
  fat:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("macroCoachWeeklyMacroAverage", macroCoachWeeklyMacroAverageSchema);