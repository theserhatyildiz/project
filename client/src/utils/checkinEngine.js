// utils/checkinEngine.js

// ---- helpers ---------------------------------------------------------------
const clampNum = (n) => (Number.isFinite(+n) ? +n : 0);  // force numeric or 0
const round = (n) => Math.round(clampNum(n));

function kcalToMacrosSplit60_40(kcal) {
  const k = Math.max(0, clampNum(kcal)); // never negative
  const carbsG = (k * 0.60) / 4; // 4 kcal/g
  const fatG   = (k * 0.40) / 9; // 9 kcal/g
  console.log("🔢 kcalToMacrosSplit60_40 →", { kcal_input: kcal, kcal_used: k, carbsG, fatG });
  return { carbsG, fatG };
}

function kcalToMacrosSplit80_20(kcal) {
  const k = Math.max(0, clampNum(kcal));
  const carbsG = (k * 0.80) / 4; // 4 kcal/g
  const fatG   = (k * 0.20) / 9; // 9 kcal/g
  console.log("🔢 kcalToMacrosSplit80_20 →", { kcal_input: kcal, kcal_used: k, carbsG, fatG });
  return { carbsG, fatG };
}

// minimums (g/kg rules)
function enforceMinimums({ next, weightKg, messages }) {
  const w = Math.max(0, clampNum(weightKg));
  const minFat  = Math.ceil(0.5 * w);
  const minCarb = Math.ceil(1.0 * w);

  const before = { ...next };
  console.log("⚖️ enforceMinimums: BEFORE", {
    next_before: before, minFat, minCarb, weightKg_input: weightKg, weightKg_used: w
  });

  let fatCapped = false;
  let carbCapped = false;

  // ✅ If fat is below min: raise fat to min, remove equivalent kcal from carbs
  if (next.fat < minFat) {
    const shortageFatG = minFat - next.fat;           // grams of fat needed
    const kcalNeeded   = shortageFatG * 9;            // kcals to add via fat
    const carbsToCutG  = kcalNeeded / 4;              // take kcals from carbs
    const carbsBefore  = next.carbs;
    const fatBefore    = next.fat;

    console.log("🧮 enforceMinimums[FAT<MIN]:", {
      fatBefore, carbsBefore, shortageFatG, kcalNeeded, carbsToCutG,
      carbsCutApplied: Math.max(minCarb, carbsBefore - carbsToCutG)
    });

    next.fat = minFat;
    next.carbs = Math.max(minCarb, next.carbs - carbsToCutG);
    fatCapped = true;

    console.log("✅ enforceMinimums[FAT<MIN] → AFTER", {
      fatAfter: next.fat,
      carbsAfter: next.carbs,
      minFat, minCarb
    });
  }

  // ✅ If carbs are below min: raise carbs to min, remove equivalent kcal from fat
  if (next.carbs < minCarb) {
    const shortageCarbG = minCarb - next.carbs;       // grams of carbs needed
    const kcalNeeded    = shortageCarbG * 4;          // kcals to add via carbs
    const fatToCutG     = kcalNeeded / 9;             // take kcals from fat
    const carbsBefore   = next.carbs;
    const fatBefore     = next.fat;

    console.log("🧮 enforceMinimums[CARB<MIN]:", {
      carbsBefore, fatBefore, shortageCarbG, kcalNeeded, fatToCutG,
      fatCutApplied: Math.max(minFat, fatBefore - fatToCutG)
    });

    next.carbs = minCarb;
    next.fat = Math.max(minFat, next.fat - fatToCutG);
    carbCapped = true;

    console.log("✅ enforceMinimums[CARB<MIN] → AFTER", {
      fatAfter: next.fat,
      carbsAfter: next.carbs,
      minFat, minCarb
    });
  }

  if (next.fat === minFat && next.carbs === minCarb) {
    fatCapped = true;
    carbCapped = true;
  }

  next._minFatCap = !!fatCapped;
  next._minCarbCap = !!carbCapped;
  next._minFatCarbCap = !!(fatCapped && carbCapped);

  if (fatCapped && carbCapped) {
    messages.push("Alt sınırlar (yağ 0.5 g/kg, karb 1 g/kg) ulaşıldı — daha fazla düşürmek sağlıksız.");
  } else if (fatCapped) {
    messages.push("Yağ alt sınırı (0.5 g/kg) ulaşıldı — yağı daha fazla düşürmek sağlıksız.");
  } else if (carbCapped) {
    messages.push("Karb alt sınırı (1.0 g/kg) ulaşıldı — karbı daha fazla düşürmek sağlıksız.");
  }

  console.log("⚖️ enforceMinimums: AFTER", {
    next_after: { ...next },
    flags: { _minFatCap: next._minFatCap, _minCarbCap: next._minCarbCap, _minFatCarbCap: next._minFatCarbCap }
  });
  return next;
}

// % change relative to previous weekly avg
function pctChangeRelativeToPrev({ currW, prevW }) {
  const currNum = clampNum(currW);
  const prevNum = clampNum(prevW);

  if (!Number.isFinite(prevNum) || prevNum <= 0) {
    console.warn("📊 pctChangeRelativeToPrev: prev invalid or <= 0 → returning 0%", {
      currW_input: currW, prevW_input: prevW, currNum, prevNum
    });
    return 0;
  }

  const pct = ((currNum - prevNum) / prevNum) * 100; // negative => loss, positive => gain
  console.log("📊 pctChangeRelativeToPrev →", { currNum, prevNum, pct });
  return pct;
}

// ---- rule blocks -----------------------------------------------------------
function applyWeightLossAdjustments({ band, lossPctAbs, currMacros }) {
  console.log("⚙️ applyWeightLossAdjustments (fat-loss)", { band, lossPctAbs, currMacros });
  let adj = 0;

  if (band === "0.2-0.5") {
    if (lossPctAbs < 0.2) adj = -5;
    else if (lossPctAbs <= 0.65) adj = 0;
    else if (lossPctAbs <= 1.0) adj = +5;
    else if (lossPctAbs <= 1.5) adj = +10;
    else if (lossPctAbs <= 2.0) adj = +20;
    else adj = +20; // >2.0 cap
  } else if (band === "0.5-1.0") {
    if (lossPctAbs < 0.4) adj = -7.5;
    else if (lossPctAbs <= 1.15) adj = 0;
    else if (lossPctAbs <= 1.5) adj = +7.5;
    else if (lossPctAbs <= 2.0) adj = +15;
    else if (lossPctAbs <= 2.5) adj = +22.5;
    else adj = +22.5; // >2.5 cap
  } else if (band === "1.0-1.5") {
    if (lossPctAbs < 0.9) adj = -10;
    else if (lossPctAbs <= 1.65) adj = 0;
    else if (lossPctAbs <= 2.0) adj = +10;
    else if (lossPctAbs <= 2.5) adj = +20;
    else if (lossPctAbs <= 3.0) adj = +30;
    else adj = +30; // >3.0 cap
  }

  const factor = 1 + adj / 100;
  return {
    nextCarbs: round(currMacros.carbs * factor),
    nextFat:   round(currMacros.fat   * factor),
    adj,
    reason:    adj === 0 ? "No change" : (adj > 0 ? `+${adj}%` : `${adj}%`)
  };
}

function applyGainReverseAdjustments({ band, gainPctAbs, currMacros }) {
  console.log("⚙️ applyGainReverseAdjustments (gain/reverse)", { band, gainPctAbs, currMacros });
  let adj = 0;

  if (band === "≤0.25") {
    if (gainPctAbs < 0.15) adj = +2;       
    else if (gainPctAbs <= 0.35) adj = 0;  
    else if (gainPctAbs <= 0.50) adj = -2.5;
    else if (gainPctAbs <= 1.0)  adj = -5;
    else if (gainPctAbs <= 1.5)  adj = -7.5;
    else adj = -7.5; // >1.5 cap
  } else if (band === "0.25-0.5") {
    if (gainPctAbs < 0.15) adj = +4.5;
    else if (gainPctAbs <= 0.60) adj = 0;
    else if (gainPctAbs <= 1.0)  adj = -4.5;
    else if (gainPctAbs <= 1.5)  adj = -9;
    else if (gainPctAbs <= 2.0)  adj = -13.5;
    else adj = -13.5; // >2.0 cap
  } else if (band === "0.5-0.8") {
    if (gainPctAbs < 0.40) adj = +7.5;
    else if (gainPctAbs <= 0.90) adj = 0;
    else if (gainPctAbs <= 1.30) adj = -7.5;
    else if (gainPctAbs <= 1.80) adj = -15;
    else if (gainPctAbs <= 2.30)  adj = -22.5;
    else adj = -22.5; // >2.30 cap
  }

  const factor = 1 + adj / 100;
  return {
    nextCarbs: round(currMacros.carbs * factor),
    nextFat:   round(currMacros.fat   * factor),
    adj,
    reason:    adj === 0 ? "No change" : (adj > 0 ? `+${adj}%` : `${adj}%`)
  };
}

// ---- Weight loss stall helpers ---------------------------------------
function noChangeAdjForFatLoss(goalSpeed) {
  const map = { slow: -5, medium: -7.5, fast: -10 };
  return map[goalSpeed] ?? -7.5;
}

function noChangeAdjForGainReverse(goalSpeed) {
  const map = { slow: +2, medium: +4.5, fast: +7.5 };
  return map[goalSpeed] ?? +7.5;
}

// ---- UI message composer ---------------------------------------------------
function composeUiMessage({ goal, reasonCode }) {
  if (reasonCode === "adherence-low") {
    return `Devamlılık başarının anahtarıdır!
    Geçen hafta devamlılıkta beklediğimiz düzeyi tam olarak yakalayamadık. İlerlemeyi net bir şekilde takip edebilmek ve doğru değişiklikleri yapabilmek için devamlılık çok önemlidir. Bu hafta makrolarında bir değişiklik yapmıyoruz. Şimdi, plana sadık kalma ve yeniden ritme girme zamanı!`;
  }

  // ---------------- FAT LOSS ----------------
  if (goal === "fat-loss") {
    if (reasonCode === "fatloss-over") {
      return `Harika haber! Metabolizman tam gaz çalışıyor!
      Bu hafta kilo verdiğini görmek çok güzel. 
      Fakat kilo vermen beklediğimizden biraz daha hızlı.  Bu, vücudunun sürece olumlu yanıt verdiğini gösteriyor. Fakat, bu momentumu koruyarak biraz daha kontrollü ilerlememiz gerekiyor. Bu yüzden makrolarını biraz artırıyoruz. Bu artışa bakalım vücudun nasıl tepki verecek...`;
    }
    if (reasonCode === "fatloss-on") {
      return `Süper gidiyorsun!
      Bu haftaki kilo kaybın tam olarak istediğimiz düzeyde. Bu ilerleme, planının işe yaradığını gösteriyor. Makro değerlerinde şu an için bir değişiklik yapmıyoruz. Bu olumlu momentumla ilerlemeye devam etmeye çalışacağız. İstikrarlı olmaya devam et, bu şekilde ilerlemeye devam edelim!`;
    }
    if (reasonCode === "fatloss-under") {
      return `Kilo kaybın bu hafta hedefin altında kalmış.
    Bu yüzden makrolarında bir azalışa gidiyoruz. Plana sadık kalmaya devam et ve sürece güven.`;
    }
    if (reasonCode === "fatloss-gained-firstweek") {
      return `İlk hafta kilonda bir artış oldu.
      Fakat endişelenecek bir durum yok. Her şey kontrol altında. Metabolizma hızını tespit etmem 1-2 hafta alabiliyor. Hedef kilo kaybına ulaşmak adına makrolarını tekrar düzenledim. Bakalım vücudun bu makrolara nasıl tepki verecek…`;
    }
    if (reasonCode === "fatloss-gained-nonfirstweek") {
      return `Bu hafta kilonda bir artış var. Hedefte ilerlemek adına makrolarında bir azalışa gidiyoruz. Plana sadık kalmaya devam et...`;
    }
    if (reasonCode === "fatloss-noweightchange-firstweek") {
      return `İlk hafta kilonda bir değişiklik yok. 
      Fakat endişelenecek bir durum yok. Her şey kontrol altında. Metabolizma hızını tespit etmem 1-2 hafta alabiliyor. Hedef kilo kaybına ulaşmak adına makrolarını tekrar düzenledim. Bakalım vücudun bu makrolara nasıl tepki verecek…`;
    }
    if (reasonCode === "fatloss-noweightchange-nonfirstweek") {
      return `Bu hafta kilonda bir değişiklik yok. Hedefte ilerlemek için makrolarında bir azalışa gidiyoruz. Mücadeleye devam et...`;
    }
    if (reasonCode === "min-fat-carb-cap") {
      return `Makroları azaltabileceğimiz alt sınıra ulaştık. Sağlığını korumak adına makrolarında daha fazla azalışa gidemiyoruz. En yakın zamanda reverse diyete başlanıp metabolizma hızının normal seviyelere çekilmesi gerekiyor.`;
    }
    if (reasonCode === "min-fat-cap") {
      return `Mevcut veriler doğrultusunda makrolarda azalışa gittim. Fakat yağ alt sınırına ulaştık. Sağlığını korumak adına bundan sonra yağda daha fazla azalış olmayacak.`;
    }
    if (reasonCode === "min-carb-cap") {
      return `Mevcut veriler doğrultusunda makrolarda azalışa gittim. Fakat karbonhidrat alt sınırına ulaştık. Sağlığını korumak adına bundan sonra karbonhidratta daha fazla azalış olmayacak.`;
    }
  }

  // ---------------- WEIGHT GAIN ----------------
  if (goal === "weight-gain") {
    if (reasonCode === "gain-over") {
      return `İlerlemen çok iyi! Fakat bu hafta kilo alımın beklediğimizden fazla oldu. Yağ alımını sınırlandırmak adına makrolarda bir düşüşe gidiyoruz. Sürece güvenmeye devam et...`;
    }
    if (reasonCode === "gain-on") {
      return `Harika! Bu hafta kilo artışın tam hedeflediğimiz aralıkta. Makroların aynı kalıyor. Aynı disiplinle devam!`;
    }
    if (reasonCode === "gain-under") {
      return `Kilo alımın hedefin biraz altında. Bu yüzden makrolarında artış yapıyoruz. Mücadeleye devam!`;
    }
    if (reasonCode === "gain-lost-firstweek") {
      return `İlk hafta kilonda bir azalış var. 
      Fakat endişelenecek bir durum yok. Her şey kontrol altında. Metabolizma hızını tespit etmem 1-2 hafta alabiliyor. Hedef kilo alımına ulaşmak adına makrolarını tekrar düzenledim. Bakalım vücudun bu makrolara nasıl tepki verecek…`;
    }
    if (reasonCode === "gain-lost-nonfirstweek") {
      return `Bu hafta kilonda bir düşüş var. Hedef kilo artışını yakalamak adına makrolarında artışa gidiyoruz. Plana sadık kalmaya devam et...`;
    }
    if (reasonCode === "gain-noweightchange-firstweek") {
      return `İlk hafta kilonda bir değişiklik yok. 
      Fakat endişelenecek bir durum yok. Her şey kontrol altında. Metabolizma hızını tespit etmem 1-2 hafta alabiliyor. Hedef kilo alımına ulaşmak adına makrolarını tekrar düzenledim. Bakalım vücudun bu makrolara nasıl tepki verecek…`;
    }
    if (reasonCode === "gain-noweightchange-nonfirstweek") {
      return `Kilonda bir değişim yok. Hedefte ilerlemek adına makrolarında bir artışa gidiyoruz. Plana sadık kalmaya devam et...`;
    }
  }

  // ---------------- REVERSE DIET ----------------
  if (goal === "reverse-diet") {
    if (reasonCode === "gain-over") {
      return `İlerlemen çok iyi!
       Fakat bu hafta kilo artışı beklediğimizden fazla oldu. Yağ alımını sınırlandırmak adına makrolarda bir düşüşe gidiyoruz. Sürece güvenmeye devam et...`;
    }
    if (reasonCode === "gain-on") {
      return `Harika gidiyorsun! 
      Bu haftaki kilo değişimin tam istediğimiz düzeyde. Makroları sabit tutuyoruz. Aynı disiplinle devam...`;
    }
    if (reasonCode === "gain-under") {
      return `Vücudun reverse diyete iyi tepki veriyor. Metabolizma hızını kademeli yükseltmek için makrolarında bir artışa gittim. Aynı disiplinle devam...`;
    }
    if (reasonCode === "gain-lost-firstweek") {
      return `İlk hafta makroların artmasına rağmen kilonda bir azalış var. Bu güzel haber.
      Metabolizman sürece iyi tepki veriyor. Bu yüzden makrolarında bir artışa gidiyoruz. Aynen bu şekilde aynı disiplinle devam...`;
    }
    if (reasonCode === "gain-lost-nonfirstweek") {
      return `Bu hafta kilonda bir azalış var. Makroların artarken kilonun düşmesi mükemmel! Bu hafta makrolarında artışa gidiyoruz. Aynen bu şekilde devam...`;
    }
    if (reasonCode === "gain-noweightchange-firstweek") {
      return `İlk hafta kilonda bir değişiklik yok. Bu süper! Metabolizman sürece iyi tepki veriyor.
      Metabolizma hızını adım adım yükseltmek için makrolarını artırdım. Aynı disiplinle devam...`;
    }
    if (reasonCode === "gain-noweightchange-nonfirstweek") {
      return `Bu hafta kilonda bir değişiklik yok. Tekrar makrolarını artırma zamanı. 
      Çok iyi gidiyorsun. Aynı sabır ve disiplinle ilerlemeye devam...`;
    }
  }

  return "Koç notu mevcut değil.";
}

// ---- main engine -----------------------------------------------------------
export function runCheckInEngine({
  goal,
  goalSpeed,
  adherenceWeekly,
  weightAverages,
  currMacros,
  weightKg,
  macroCoachStartedAt,
  lastCheckInAt
}) {
  // Prefer weekly-average weight for g/kg rules; fallback to form weight
  const weeklyWeightForRules = clampNum(weightAverages?.weeklyAverage);
  const weightForRules = weeklyWeightForRules > 0 ? weeklyWeightForRules : clampNum(weightKg);

  const adh = clampNum(adherenceWeekly);
  const wNowRaw  = weightAverages?.weeklyAverage;
  const wPrevRaw = weightAverages?.previousWeeklyAverage;
  const wNowNum  = clampNum(wNowRaw);
  const wPrevNum = clampNum(wPrevRaw);

  // FIRST CHECK-IN detection
  const isFirstCheckin = Boolean(macroCoachStartedAt && !lastCheckInAt);

  console.log("🚀 runCheckInEngine START", {
    goal,
    goalSpeed,
    adherenceWeekly_input: adherenceWeekly,
    adherenceWeekly_type: typeof adherenceWeekly,
    adherenceWeekly_coerced: adh,
    weightAverages_input: weightAverages,
    weeklyAverage_type: typeof wNowRaw,
    previousWeeklyAverage_type: typeof wPrevRaw,
    weeklyAverage_num: wNowNum,
    previousWeeklyAverage_num: wPrevNum,
    currMacros,
    weightKg_input: weightKg,
    weeklyWeightForRules,
    weightForRules_used: weightForRules,
    macroCoachStartedAt,
    lastCheckInAt,
    isFirstCheckin
  });

  const messages = [];

  console.log("🎯 Adherance:", adh);

  // 1) Adherence gate
  if (!Number.isFinite(adh) || adh < 90 || adh > 105) {
    console.log("⛔ Adherence gate: BLOCKED", { adh });
    const uiMessage = composeUiMessage({ goal, reasonCode: "adherence-low" });
    return {
      nextMacros: { ...currMacros },
      message: "Haftalık uyum %90’ın altında ya da %105’in üzerinde — makrolarda değişiklik yok.",
      reason: "adherence<90||>105",
      reasonCode: "adherence-low",
      uiMessage
    };
  }
  console.log("✅ Adherence gate: PASSED", { adh });

  // 2) Weight trend
  const pct = pctChangeRelativeToPrev({ currW: wNowNum, prevW: wPrevNum });
  const absPct = Math.abs(pct);

  if (!Number.isFinite(wNowNum) || !Number.isFinite(wPrevNum) || wPrevNum <= 0) {
    const msg = "Kilo trendi için yeterli veri yok (haftalık ortalamalar eksik). Bu hafta hedefleri koruyalım.";
    console.log("ℹ️ Weight gate: HOLD due to missing/invalid weekly averages", { wNowNum, wPrevNum });
    return {
      nextMacros: { ...currMacros },
      message: msg,
      reason: "weight_data_insufficient_hold",
      reasonCode: "weight_data_insufficient_hold",
      uiMessage: "Kilo trendi verisi sınırlı, makroları koruyoruz."
    };
  }

  console.log("📈 Weight trend computed", {
    weeklyAverage: wNowNum,
    previousWeeklyAverage: wPrevNum,
    pctChange_sign: pct < 0 ? "LOSS" : pct > 0 ? "GAIN" : "NO CHANGE",
    pctChange_value: pct,
    absPct
  });

  // Start from current
  let next = { ...currMacros };
  let reason = "";
  let reasonCode = "unknown";

  // 3) Goal-specific logic
  if (goal === "fat-loss") {
    if (pct < 0) {
      // LOSS
      const band =
        goalSpeed === "slow"   ? "0.2-0.5" :
        goalSpeed === "medium" ? "0.5-1.0" :
        goalSpeed === "fast"   ? "1.0-1.5" : "0.5-1.0";

      const { nextCarbs, nextFat, reason: r, adj } = applyWeightLossAdjustments({
        band, lossPctAbs: absPct, currMacros
      });

      next.carbs = nextCarbs;
      next.fat   = nextFat;
      reason = `Fat loss band ${band} → ${r}`;
      reasonCode = adj > 0 ? "fatloss-over" : adj < 0 ? "fatloss-under" : "fatloss-on";

    } else if (pct > 0) {
      // GAIN
      const gainedKg = clampNum(wNowNum - wPrevNum);

      console.log("🏋️‍♀️ Weight gain calculated:", { wNowNum, wPrevNum, gainedKg });

      if (isFirstCheckin) {
        const w = Math.max(0, clampNum(weightForRules));
        let weightLossTarget = 0; // grams per week

        if (goalSpeed === "slow") {
          weightLossTarget = ((w * 0.0025 + w * 0.005) * 1000) / 2;
        } else if (goalSpeed === "medium") {
          weightLossTarget = ((w * 0.005 + w * 0.01) * 1000) / 2;
        } else if (goalSpeed === "fast") {
          weightLossTarget = ((w * 0.01 + w * 0.015) * 1000) / 2;
        }

        const kcalFromFat = (weightLossTarget * 0.713 * 0.87) * 9;
        const kcalFromLBM = (weightLossTarget * 0.287 * 0.3) * 4;
        const weeklyDeficit = kcalFromFat + kcalFromLBM;
        const dailyDeficit = weeklyDeficit / 7;

        const { carbsG, fatG } = kcalToMacrosSplit60_40(dailyDeficit);
        next.carbs = round(currMacros.carbs - carbsG);
        next.fat   = round(currMacros.fat   - fatG);

        reason = `İlk check-in — kilo artışı. Hedef hız '${goalSpeed}' için ≈${round(dailyDeficit)} kcal/gün kesinti (−${round(carbsG)}g carb, −${round(fatG)}g fat).`;
        reasonCode = "fatloss-gained-firstweek";

        console.log("📦 Adjusted macros for first check-in gain:", { nextCarbs: next.carbs, nextFat: next.fat, dailyDeficit, carbsG, fatG });

      } else {
        const adj = noChangeAdjForFatLoss(goalSpeed);
        const factor = 1 + adj / 100;
        const nextCarbs = round(currMacros.carbs * factor);
        const nextFat   = round(currMacros.fat   * factor);

        next.carbs = nextCarbs;
        next.fat   = nextFat;
        reason = `Ağırlık arttı — ilk check-in değil, ${adj}% düşüş uygulandı.`;
        reasonCode = "fatloss-gained-nonfirstweek";
      }

    } else {
      // NO CHANGE
      if (isFirstCheckin) {
        const w = Math.max(0, clampNum(weightForRules));
        let weightLossTarget = 0; // grams per week

        if (goalSpeed === "slow") {
          weightLossTarget = ((w * 0.0025 + w * 0.005) * 1000) / 2;
        } else if (goalSpeed === "medium") {
          weightLossTarget = ((w * 0.005 + w * 0.01) * 1000) / 2;
        } else if (goalSpeed === "fast") {
          weightLossTarget = ((w * 0.01 + w * 0.015) * 1000) / 2;
        }

        const kcalFromFat = (weightLossTarget * 0.713 * 0.87) * 9;
        const kcalFromLBM = (weightLossTarget * 0.287 * 0.3) * 4;
        const weeklyDeficit = kcalFromFat + kcalFromLBM;
        const dailyDeficit = weeklyDeficit / 7;

        const { carbsG, fatG } = kcalToMacrosSplit60_40(dailyDeficit);
        next.carbs = round(currMacros.carbs - carbsG);
        next.fat   = round(currMacros.fat   - fatG);

        reason = `İlk check-in — kilo değişimi yok: hedef hız '${goalSpeed}' için ≈${round(dailyDeficit)} kcal/gün kesinti (−${round(carbsG)}g carb, −${round(fatG)}g fat).`;
        reasonCode = "fatloss-noweightchange-firstweek";
      } else {
        const adj = noChangeAdjForFatLoss(goalSpeed);
        const factor = 1 + adj / 100;
        const nextCarbs = round(currMacros.carbs * factor);
        const nextFat   = round(currMacros.fat   * factor);

        next.carbs = nextCarbs;
        next.fat   = nextFat;
        reason = `Ağırlık değişmedi — hedefe yaklaşmak için ${adj}% düşüş uygulandı.`;
        reasonCode = "fatloss-noweightchange-nonfirstweek";
      }
    }

    // enforce mins and, if hit, show ONLY the cap message
    next = enforceMinimums({ next, weightKg: weightForRules, messages });
    if (next._minFatCarbCap || next._minFatCap || next._minCarbCap) {
      if (next._minFatCarbCap) {
        reasonCode = "min-fat-carb-cap";
        reason = "Alt sınırlar (yağ 0.5 g/kg, karb 1 g/kg) ulaşıldı — daha fazla düşürmek sağlıksız.";
      } else if (next._minFatCap) {
        reasonCode = "min-fat-cap";
        reason = "Yağ alt sınırı (0.5 g/kg) ulaşıldı — yağı daha fazla düşürmek sağlıksız.";
      } else if (next._minCarbCap) {
        reasonCode = "min-carb-cap";
        reason = "Karb alt sınırı (1.0 g/kg) ulaşıldı — karbı daha fazla düşürmek sağlıksız.";
      }
      messages.length = 0; // only the cap text
    }

} else if (goal === "weight-gain" || goal === "reverse-diet") {
  console.log("🎯 Goal: weight-gain or reverse-diet");

  if (pct > 0) {
    console.log("📈 Weight increased — adjusting based on gain band");
    const band =
      goalSpeed === "slow"   ? "≤0.25"    :
      goalSpeed === "medium" ? "0.25-0.5" :
      goalSpeed === "fast"   ? "0.5-0.8"  : "0.25-0.5";

    console.log("📊 Gain band selected:", band);

    const { nextCarbs, nextFat, reason: r, adj } = applyGainReverseAdjustments({
      band, gainPctAbs: absPct, currMacros
    });

    console.log("📦 Adjusted macros:", { nextCarbs, nextFat, adj, reason: r });

    next.carbs = nextCarbs;
    next.fat   = nextFat;
    reason = `Gain band ${band} → ${r}`;
    reasonCode = adj < 0 ? "gain-over" : adj > 0 ? "gain-under" : "gain-on";

  } else if (pct < 0) {
    console.log("📉 Weight decreased");

    const lostKg = clampNum(wPrevNum - wNowNum);
    console.log("⚖️ Lost weight:", lostKg, "kg");

    if (isFirstCheckin) {
    console.log("🆕 First check-in + weight decreased → adding lost kcal + surplus %");

    const lostKg = clampNum(wPrevNum - wNowNum);
    const lostKcal = lostKg * 1000;

    const surplusPct =
      goalSpeed === "slow"   ? 0.05 :
      goalSpeed === "medium" ? 0.10 :
      goalSpeed === "fast"   ? 0.15 : 0.10;

    const currCalories = currMacros.protein * 4 + currMacros.carbs * 4 + currMacros.fat * 9;
    const targetCalories = (currCalories + lostKcal) * (1 + surplusPct);
    const deltaKcal = targetCalories - currCalories;

    console.log("📊 First check-in correction:", {
      lostKg,
      lostKcal,
      currCalories,
      surplusPct,
      targetCalories,
      deltaKcal
    });

    const { carbsG, fatG } = kcalToMacrosSplit60_40(deltaKcal);

    next.carbs = round(currMacros.carbs + carbsG);
    next.fat   = round(currMacros.fat   + fatG);

    reason = `İlk check-in — kilo kaybı: kaybedilen ≈${round(lostKcal)} kcal telafi + '${goalSpeed}' hedefi için %${surplusPct * 100} artış → ≈${round(deltaKcal)} kcal artış (+${round(carbsG)}g carb, +${round(fatG)}g fat).`;
    reasonCode = "gain-lost-firstweek";
  }  else {
      console.log("📆 Not first check-in, applying no-change adjustment");
      const adj = noChangeAdjForGainReverse(goalSpeed);
      const factor = 1 + adj / 100;
      const nextCarbs = round(currMacros.carbs * factor);
      const nextFat   = round(currMacros.fat   * factor);

      console.log("📦 Adjustment:", { adj, factor, nextCarbs, nextFat });

      next.carbs = nextCarbs;
      next.fat   = nextFat;
      reason = `Ağırlık azaldı — ilk check-in değil, ${adj}% artış uygulandı.`;
      reasonCode = "gain-lost-nonfirstweek";
    }

    } else {
      if (isFirstCheckin) {
        // 🚦 Branch: gain/reverse → NO CHANGE (first week)
        const surplusPct =
          goalSpeed === "slow"   ? 0.05 :
          goalSpeed === "medium" ? 0.10 :
          goalSpeed === "fast"   ? 0.15 : 0.10;

        const currCalories = currMacros.protein * 4 + currMacros.carbs * 4 + currMacros.fat * 9;
        const newCalories  = currCalories * (1 + surplusPct);
        const deltaKcal    = newCalories - currCalories;

        const { carbsG, fatG } = kcalToMacrosSplit60_40(deltaKcal);

        next.carbs = round(currMacros.carbs + carbsG);
        next.fat   = round(currMacros.fat   + fatG);

        reason = `İlk check-in — kilo değişimi yok: hedef hız '${goalSpeed}' için ≈${round(deltaKcal)} kcal/gün artış (+${round(carbsG)}g carb, +${round(fatG)}g fat).`;
        reasonCode = "gain-noweightchange-firstweek";
      } else {
        // 🚦 Branch: gain/reverse → NO CHANGE (non-first week)
        const adj = noChangeAdjForGainReverse(goalSpeed); 
        const factor = 1 + adj / 100;
        const nextCarbs = round(currMacros.carbs * factor);
        const nextFat   = round(currMacros.fat   * factor);

        next.carbs = nextCarbs;
        next.fat   = nextFat;

        reason = `Ağırlık değişmedi — ilk check-in değil, ${adj}% artış uygulandı.`;
        reasonCode = "gain-noweightchange-nonfirstweek";
      }
    }
  } else {
    const uiMessage = "Bilinmeyen hedef — değişiklik yok.";
    return {
      nextMacros: { ...currMacros },
      message: uiMessage,
      reason: "unknown-goal",
      reasonCode: "unknown",
      uiMessage
    };
  }

  // --- Recompute calories & dynamic fiber -----------------------------------
  const calories = next.protein * 4 + next.carbs * 4 + next.fat * 9;
  const fiber    = round((calories / 1000) * 15);

  const final = {
    calories: round(calories),
    protein:  round(currMacros.protein),
    carbs:    round(next.carbs),
    fat:      round(next.fat),
    fiber,
  };

  const message = messages.length ? `${reason}. ${messages.join(" ")}` : reason;
  const uiMessage = composeUiMessage({ goal, reasonCode });

  console.log("✅ runCheckInEngine RESULT", {
    final,
    message,
    reason,
    reasonCode,
    uiMessage
  });

  return { nextMacros: final, message, reason, reasonCode, uiMessage };
}