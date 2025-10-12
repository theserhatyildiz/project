import { macroCalculatorFromCurrentMacros } from "./macroCalculatorFromCurrentMacros";

// ---------- Small helpers ----------
const lifestyleMap = {
  sedentary: 0.6,     
  light: 0.7,
  moderate: 0.8,
  high: 0.9,
  "very high": 1
};

const exerciseMap = {
  noexercise: 0.55,
  light: 0.65,
  moderate: 0.75,
  heavy: 0.85,
  "very-heavy": 0.95
};

export function calcBMR({ gender, weightKg, heightCm, age }) {
  const bmr = gender === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  console.log("🧮 BMR calculation:", { gender, weightKg, heightCm, age, bmr });
  return bmr;
}

export function calcTDEE({ bmr, lifeStyleFactor, exerciseFactor }) {
  const lf = lifestyleMap[lifeStyleFactor] ?? 0.7;
  const ef = exerciseMap[exerciseFactor] ?? 0.65;
  const tdee = bmr * (lf + ef);

  console.log("🔥 TDEE calculation:", { bmr, lifeStyleFactor, lf, exerciseFactor, ef, tdee });
  return tdee;
}

function clamp(n) {
  return Number.isFinite(n) ? n : 0;
}

function roundMacros({ calories, protein, carbs, fat, fiber }) {
  return {
    calories: Math.round(clamp(calories)),
    protein: Math.round(clamp(protein)),
    carbs: Math.round(clamp(carbs)),
    fat: Math.round(clamp(fat)),
    fiber: Math.round(clamp(fiber)),
  };
}

function macroSplit({ targetCalories, proteinGrams, carbRatio = 0.6 }) {
  const proteinKcals = proteinGrams * 4;
  const remaining = Math.max(0, targetCalories - proteinKcals);
  const carbsKcals = remaining * carbRatio;
  const fatKcals = remaining - carbsKcals;
  const carbs = carbsKcals / 4;
  const fat = fatKcals / 9;
  const fiber = (targetCalories / 1000) * 15;

  console.log("🥗 Macro split:", { targetCalories, proteinGrams, carbRatio, carbs, fat, fiber });
  return { carbs, fat, fiber };
}

function getProteinMultiplier(age, isDeficit) {
  if (age <= 30) return isDeficit ? 2.3 : 1.9;
  if (age <= 40) return isDeficit ? 2.6 : 2.15;
  if (age <= 50) return isDeficit ? 2.95 : 2.45;
  if (age <= 60) return isDeficit ? 3.3 : 2.75;
  return isDeficit ? 3.65 : 3.05; // age > 60
}

// ---------- Goal calculators ----------

// 1) Fat loss
function calcFatLoss({ age, gender, weightKg, heightCm, lifeStyleFactor, exerciseFactor, goalSpeed, bodyFatPercentage }) {
  console.log("🎯 Goal: Fat Loss", { goalSpeed });

  const bmr = calcBMR({ gender, weightKg, heightCm, age });
  const tdee = calcTDEE({ bmr, lifeStyleFactor, exerciseFactor });

  let weightLossTarget = 0;
  if (goalSpeed === "slow")
    weightLossTarget = ((weightKg * 0.0025 + weightKg * 0.005) * 1000) / 2;
  else if (goalSpeed === "medium")
    weightLossTarget = ((weightKg * 0.005 + weightKg * 0.01) * 1000) / 2;
  else if (goalSpeed === "fast")
    weightLossTarget = ((weightKg * 0.01 + weightKg * 0.015) * 1000) / 2;
  else if (goalSpeed === "aggressive")
    weightLossTarget = ((weightKg * 0.015 + weightKg * 0.023) * 1000) / 2;

  const kcalFromFat = (weightLossTarget * 0.713 * 0.87) * 9;
  const kcalFromLBM = (weightLossTarget * 0.287 * 0.3) * 4;
  const weeklyDeficit = kcalFromFat + kcalFromLBM;
  const dailyDeficit = weeklyDeficit / 7;

  console.log("📉 Fat loss deficit:", { weightLossTarget, kcalFromFat, kcalFromLBM, dailyDeficit });

  const targetCalories = tdee - dailyDeficit;

  const bf = Number(bodyFatPercentage);
  console.log("📥 bodyFatPercentage (from form):", bf);

  const lbmKg = weightKg * (1 - bf / 100);
  console.log("💪 Calculated LBM (kg):", {
    weightKg,
    bodyFatPercentage,
    lbmKg
  });

  const multiplier = getProteinMultiplier(age, true);
  console.log("⚙️ Protein multiplier based on age and deficit:", {
    age,
    isDeficit: true,
    multiplier
  });

  const proteinGrams = lbmKg * multiplier;
  console.log("🥩 Final proteinGrams (g):", {
    lbmKg,
    multiplier,
    proteinGrams
  });

  const { carbs, fat, fiber } = macroSplit({ targetCalories, proteinGrams, carbRatio: 0.6 });

  const result = roundMacros({
    calories: targetCalories,
    protein: proteinGrams,
    carbs,
    fat,
    fiber,
  });

  console.log("✅ Fat Loss Result:", result);
  return result;
}

// 2 & 3) Shared gain calculator
function calcGainShared({ age, gender, weightKg, heightCm, lifeStyleFactor, exerciseFactor, goalSpeed, bodyFatPercentage }) {
  console.log("🎯 Goal: Gain (Weight or Reverse)", { goalSpeed });

  const bmr = calcBMR({ gender, weightKg, heightCm, age });
  const tdee = calcTDEE({ bmr, lifeStyleFactor, exerciseFactor });

  const pct =
    goalSpeed === "very slow" ? 0.025 :
    goalSpeed === "slow"      ? 0.05  :
    goalSpeed === "medium"    ? 0.10  :
    goalSpeed === "fast"      ? 0.15  : 0.10;

  console.log("📈 Surplus %:", { goalSpeed, pct });

  const targetCalories = tdee * (1 + pct);
  console.log("TDEE:", tdee , "x (1+", pct,")=", targetCalories);

  const bf = Number(bodyFatPercentage);
  console.log("📥 bodyFatPercentage (from form):", bf);

  const lbmKg = weightKg * (1 - bf / 100);
  console.log("💪 Calculated LBM (kg):", {
    weightKg,
    bodyFatPercentage,
    lbmKg
  });

  const multiplier = getProteinMultiplier(age, false);
  console.log("⚙️ Protein multiplier based on age and deficit:", {
    age,
    isDeficit: false,
    multiplier
  });

  const proteinGrams = lbmKg * multiplier;
  console.log("🥩 Final proteinGrams (g):", {
    lbmKg,
    multiplier,
    proteinGrams
  });

  const { carbs, fat, fiber } = macroSplit({ targetCalories, proteinGrams, carbRatio: 0.6 });

  const result = roundMacros({
    calories: targetCalories,
    protein: proteinGrams,
    carbs,
    fat,
    fiber,
  });

  console.log("✅ Gain Result:", result);
  return result;
}

// 2) Weight gain
function calcWeightGain(inputs) {
  return calcGainShared(inputs);
}

// 3) Reverse diet (muscle gain)
function calcReverseDiet(inputs) {
  return calcGainShared(inputs);
}

// 4) Maintenance
function calcMaintenance({ age, gender, weightKg, heightCm, lifeStyleFactor, exerciseFactor }) {
  console.log("🎯 Goal: Maintenance");

  const bmr = calcBMR({ gender, weightKg, heightCm, age });
  const tdee = calcTDEE({ bmr, lifeStyleFactor, exerciseFactor });

  const targetCalories = tdee;

  const bf = Number(bodyFatPercentage);
  console.log("📥 bodyFatPercentage (from form):", bf);

  const lbmKg = weightKg * (1 - bf / 100);
  console.log("💪 Calculated LBM (kg):", {
    weightKg,
    bodyFatPercentage,
    lbmKg
  });

  const multiplier = getProteinMultiplier(age, false);
  console.log("⚙️ Protein multiplier based on age and deficit:", {
    age,
    isDeficit: false,
    multiplier
  });

  const proteinGrams = lbmKg * multiplier;
  console.log("🥩 Final proteinGrams (g):", {
    lbmKg,
    multiplier,
    proteinGrams
  });

  const { carbs, fat, fiber } = macroSplit({ targetCalories, proteinGrams, carbRatio: 0.6 });

  const result = roundMacros({
    calories: targetCalories,
    protein: proteinGrams,
    carbs,
    fat,
    fiber,
  });

  console.log("✅ Maintenance Result:", result);
  return result;
}

// ---------- Dispatcher ----------
const calculators = {
  "fat-loss": calcFatLoss,
  "weight-gain": calcWeightGain,
  "reverse-diet": calcReverseDiet,
  "maintenance": calcMaintenance,
};

export function calculateMacrosFromForm(form) {
  if (!form) {
    console.warn("⚠️ No form provided!");
    return null;
  }
  console.log("🚀🚀macroCalculator is RUNNING!!!");
  console.log("📥 Raw form input:", form);

  const {
    age,
    gender,
    weight,
    height,
    lifeStyleFactor,
    exerciseFactor,
    goal,
    goalSpeed,
  } = form;

  const weightKg = Number(weight);
  const heightCm = Number(height);

  const payload = {
    age: Number(age),
    gender,
    weightKg,
    heightCm,
    lifeStyleFactor,
    exerciseFactor,
    goalSpeed,
    bodyFatPercentage: Number(form.bodyFatPercentage),
  };

  console.log("📦 Normalized payload:", payload);

  const calc = calculators[goal] ?? calculators["maintenance"];
  const result = calc(payload);

  console.log("🎉 Final macros:", result);
  return result;
}

export function getMacroResult(form) {
  if (
    form?.current &&
    form.weightChange != null // allow 0
  ) {
    return macroCalculatorFromCurrentMacros(form);
  }

  return calculateMacrosFromForm(form);
}