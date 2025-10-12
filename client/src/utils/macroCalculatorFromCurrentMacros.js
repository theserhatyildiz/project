export function macroCalculatorFromCurrentMacros(form, setToast) {
  console.log("🚀 macroCalculatorFromCurrentMacros is RUNNING!!!");
  console.log("📥 Form input:", form);

// -----------------------------
// 🛡️ Enforce Minimum Fat & Carb (Kullanici cok dusuk makro girisi yaparsa onu korumak adina makrolari min olabilecek seviyeye ceker.)
// -----------------------------
function enforceMinimums({ next, weightKg }) {
  const w = Math.max(0, Number(weightKg) || 0);
  const minFat = Math.ceil(0.5 * w);
  const minCarb = Math.ceil(1.0 * w);

  let fatCapped = false;
  let carbCapped = false;

  console.group("⚖️ enforceMinimums()");
  console.log("BEFORE:", {
    next_before: { ...next },
    minFat,
    minCarb,
    weightKg_input: weightKg,
  });

  // ✅ If fat below minimum
  if (next.fat < minFat) {
    const shortageFatG = minFat - next.fat;
    const kcalNeeded = shortageFatG * 9;
    const carbsToCutG = kcalNeeded / 4;

    console.log("🧮 FAT below minimum → correcting:", {
      fatBefore: next.fat,
      carbsBefore: next.carbs,
      shortageFatG,
      kcalNeeded,
      carbsToCutG,
    });

    next.fat = minFat;
    next.carbs = Math.max(minCarb, next.carbs - carbsToCutG);
    fatCapped = true;
  }

  // ✅ If carbs below minimum
  if (next.carbs < minCarb) {
    const shortageCarbG = minCarb - next.carbs;
    const kcalNeeded = shortageCarbG * 4;
    const fatToCutG = kcalNeeded / 9;

    console.log("🧮 CARB below minimum → correcting:", {
      carbBefore: next.carbs,
      fatBefore: next.fat,
      shortageCarbG,
      kcalNeeded,
      fatToCutG,
    });

    next.carbs = minCarb;
    next.fat = Math.max(minFat, next.fat - fatToCutG);
    carbCapped = true;
  }

  // 🚨 Post-adjustment re-check (important!)
  // Handles cases where one correction caused the other to hit its minimum.
  if (!carbCapped && next.carbs <= minCarb) {
    carbCapped = true;
  }
  if (!fatCapped && next.fat <= minFat) {
    fatCapped = true;
  }

  // ✅ Final flags
  next._minFatCap = fatCapped;
  next._minCarbCap = carbCapped;
  next._minFatCarbCap = fatCapped && carbCapped;

  // ⚠️ Console warnings
  if (fatCapped && carbCapped) {
    console.warn(
      "⚠️ Both fat and carbs reached their minimums (0.5 g/kg and 1 g/kg). Further reductions are unsafe."
    );
  } else if (fatCapped) {
    console.warn("⚠️ Fat minimum reached (0.5 g/kg). Further reductions are unsafe.");
  } else if (carbCapped) {
    console.warn("⚠️ Carb minimum reached (1 g/kg). Further reductions are unsafe.");
  } else {
    console.log("✅ No minimum limits reached — all within safe range.");
  }

  console.log("AFTER:", { next_after: { ...next } });
  console.groupEnd();

  return next;
}

  // -----------------------------
  // Protein Multiplier Function
  // -----------------------------
  function getProteinMultiplier(age, isDeficit) {
    if (age <= 30) return isDeficit ? 2.3 : 1.9;
    if (age <= 40) return isDeficit ? 2.6 : 2.15;
    if (age <= 50) return isDeficit ? 2.95 : 2.45;
    if (age <= 60) return isDeficit ? 3.3 : 2.75;
    return isDeficit ? 3.65 : 3.05; // age > 60
  }

  const {
    age,
    weight,
    bodyFatPercentage,
    goalSpeed,
    goal,
    current,
    weightChange,
    proteinIntake,
    carbIntake,
    fatIntake
  } = form;

  const weightKg = parseFloat(weight);
  const weightChangeKg = parseFloat(weightChange);

  if (
    weightKg == null || isNaN(weightKg) ||
    weightChangeKg == null || isNaN(weightChangeKg) ||
    !goalSpeed || !current || !goal
  ) {
    console.warn("❌ Invalid input data:", {
      weightKg,
      weightChangeKg,
      goalSpeed,
      current,
      goal
    });
    return null;
  }

  const KCAL_PER_KG = 846;

  console.log("⚖️ Weight:", weightKg, "kg", "| current state:", current,"| WeightChange:", weightChange, "kg/week");
  console.log("Goal:", goal, "| Speed:", goalSpeed);

  // -----------------------------
  // 1️⃣ Calculate weight change target
  // -----------------------------
  let weightChangeTargetGrams = 0;

  // 🔁 Custom logic for weight-gain or reverse-diet
  if (goal === "weight-gain" || goal === "reverse-diet") {
    if (goalSpeed === "slow") {
      weightChangeTargetGrams = ((weightKg * 0 + weightKg * 0.0025) * 1000) / 2;
    } else if (goalSpeed === "medium") {
      weightChangeTargetGrams = ((weightKg * 0.0025 + weightKg * 0.005) * 1000) / 2;
    } else if (goalSpeed === "fast") {
      weightChangeTargetGrams = ((weightKg * 0.005 + weightKg * 0.008) * 1000) / 2;
    }
  } else {
    // Default logic (used for fat-loss)
    if (goalSpeed === "slow") {
      weightChangeTargetGrams = ((weightKg * 0.0025 + weightKg * 0.005) * 1000) / 2;
    } else if (goalSpeed === "medium") {
      weightChangeTargetGrams = ((weightKg * 0.005 + weightKg * 0.01) * 1000) / 2;
    } else if (goalSpeed === "fast") {
      weightChangeTargetGrams = ((weightKg * 0.01 + weightKg * 0.015) * 1000) / 2;
    }
  }

  console.log("🎯 Weekly Target Change (g):", weightChangeTargetGrams);

  const actualWeightChangeKcal = weightChangeKg * KCAL_PER_KG;

  console.log("Current Weight Change:", weightChange,"kg | Weight Change in Kcal (actual):", actualWeightChangeKcal.toFixed(1));

  
  const kcalPerDayTarget = (weightChangeTargetGrams / 1000) * KCAL_PER_KG ;

  
  console.log("Weekly Target Change:",weightChangeTargetGrams, "g | Target Weight Change in Kcal (target):", kcalPerDayTarget.toFixed(1));
  

  const currentCalories = proteinIntake * 4 + carbIntake * 4 + fatIntake * 9;
  console.log("📊 Current calorie intake:", currentCalories);

  // -----------------------------
  // 2️⃣ Goal-specific logic
  // -----------------------------

  let calorieAdjustment = 0;
  let newCalories = 0;

  if (goal === "fat-loss") {

  if (current === "weight-gain") {
    calorieAdjustment = kcalPerDayTarget + actualWeightChangeKcal;
    console.log("🔁 Currently gaining, need larger deficit (target + actual):", kcalPerDayTarget, "+", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));
  
  } else if (current === "fat-loss") {
    calorieAdjustment = kcalPerDayTarget - actualWeightChangeKcal;
    console.log("📉 Currently losing, deficit (target - actual):", kcalPerDayTarget, "-", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));

  } else if (current === "no-change") {
    calorieAdjustment = kcalPerDayTarget;
    console.log(
      "➖ No change in weight, applying base target deficit:",
      "calorieAdjustment =", calorieAdjustment.toFixed(1)
    );
  
  } else {
    console.warn("⚠️ Unrecognized current state during fat-loss:", current);
    calorieAdjustment = kcalPerDayTarget;
  }

  newCalories = currentCalories - calorieAdjustment;
}

  else if (goal === "weight-gain") {
    
     if (current === "weight-gain") {
    calorieAdjustment = kcalPerDayTarget - actualWeightChangeKcal;
    console.log("📈 Currently gaining, surplus (target - actual):", kcalPerDayTarget, "-", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));
  
  } else if (current === "fat-loss") {
    calorieAdjustment = kcalPerDayTarget + actualWeightChangeKcal;
    console.log("🔁 Currently losing, need larger surplus (target + actual):", kcalPerDayTarget, "+", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));

  } else if (current === "no-change") {
    calorieAdjustment = kcalPerDayTarget;
    console.log(
      "➖ No change in weight, applying base target surplus:",
      "calorieAdjustment =", calorieAdjustment.toFixed(1)
    );
  
  } else {
    console.warn("⚠️ Unrecognized current state during fat-loss:", current);
    calorieAdjustment = kcalPerDayTarget;
  }

  newCalories = currentCalories + calorieAdjustment;
}

    else if (goal === "reverse-diet") {
    
     if (current === "weight-gain") {
    calorieAdjustment = kcalPerDayTarget - actualWeightChangeKcal;
    console.log("📈 Currently gaining, surplus (target - actual):", kcalPerDayTarget, "-", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));
  
  } else if (current === "fat-loss") {
    calorieAdjustment = kcalPerDayTarget + actualWeightChangeKcal;
    console.log("🔁 Currently losing, need larger surplus (target + actual):", kcalPerDayTarget, "+", actualWeightChangeKcal.toFixed(1), "=", calorieAdjustment.toFixed(1));

  } else if (current === "no-change") {
    calorieAdjustment = kcalPerDayTarget;
    console.log(
      "➖ No change in weight, applying base target surplus:",
      "calorieAdjustment =", calorieAdjustment.toFixed(1)
    );
  
  } else {
    console.warn("⚠️ Unrecognized current state during fat-loss:", current);
    calorieAdjustment = kcalPerDayTarget;
  }

  newCalories = currentCalories + calorieAdjustment;
}

  else {
    console.warn("⚠️ Unknown goal:", goal);
    return null;
  }

  newCalories = Math.max(newCalories, 0);
  console.log("🎯 New calorie target:", newCalories.toFixed(1));

  // -----------------------------
  // 3️⃣ Recalculate macros
  // -----------------------------
  const ageNum = Number(form.age);
  const bf = Number(form.bodyFatPercentage);
  const lbmKg = weightKg * (1 - bf / 100);
  const isDeficit = goal === 'fat-loss';
  const proteinMultiplier = getProteinMultiplier(ageNum, isDeficit);
  const proteinGrams = lbmKg * proteinMultiplier;

  console.log("🧠 Protein calculation:", {
    weightKg,
    bodyFatPercentage: bf,
    lbmKg,
    age:ageNum,
    isDeficit,
    proteinMultiplier,
    proteinGrams: proteinGrams.toFixed(1)
  });
  
  const proteinKcals = proteinGrams * 4;
  const remainingKcals = newCalories - proteinKcals;
  const carbsKcals = remainingKcals * 0.6;
  const fatKcals = remainingKcals * 0.4;

  const carbs = carbsKcals / 4;
  const fat = fatKcals / 9;
  const fiber = (newCalories / 1000) * 15;

  console.log("🥗 Macro breakdown:", {
    proteinGrams,
    remainingKcals: remainingKcals.toFixed(1),
    carbs: carbs.toFixed(1),
    fat: fat.toFixed(1),
    fiber: fiber.toFixed(1)
  });

  let result = {
  calories: Math.round(newCalories),
  protein: Math.round(proteinGrams),
  carbs: Math.round(carbs),
  fat: Math.round(fat),
  fiber: Math.round(fiber),
};

// ✅ Enforce minimum fat and carb limits
result = enforceMinimums({ next: result, weightKg });

// ✅ Toast trigger
  if (result._minFatCarbCap) {
    console.log(
      "%c🚨 Toast trigger condition met → both fat and carb minimums hit!",
      "color: red; font-weight: bold;"
    );
    const message = "⚠️ Girdiğiniz makrolar analiz edildi ve kilo vermek için çok düşük olduğu tespit edildi. Sağlığınızı korumak adına yağ ve karbonhidrat değerleri asgari miktarlara çıkarıldı. Bu seviyelerin altına inmek sağlığınız için risklidir. Bu hafta kilonuz değişmezse veya artarsa endişelenmeyin, bu normaldir. Haftaya checkinde gerekli bilgilendirme yapılıp gerekli strateji önerilecektir.";
    console.log("📢 Sending toast message:", message);
    setToast?.(message);
  } else {
    console.log("✅ No toast needed (minimum caps not hit).");
  }

console.log("✅ Final adjusted macros (after min enforcement):", result);
return result;
}