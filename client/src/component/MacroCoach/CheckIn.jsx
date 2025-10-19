// src/pages/CheckIn.jsx
import { useEffect, useState, useContext, useRef } from "react";
import { UserContext } from "../../context/UserContext";
import { useNavigate } from "react-router-dom";
import Footer from "../Footer";
import ClipLoader from "react-spinners/ClipLoader";
import { runCheckInEngine } from "../../utils/checkinEngine";

export default function CheckIn() {
  const { loggedUser } = useContext(UserContext);
  const navigate = useNavigate();

  // ==== TEST SWITCH (force enable the button even if locked) ====
  const TEST_FORCE_UNLOCK = true; // set true while testing UI
  const [isLocked, setIsLocked] = useState(true);

  const [formData, setFormData] = useState(null);          // goal, goalSpeed, weight
  const [dailyMacroTotals, setDailyMacroTotals] = useState([]);
  const [macros, setMacros] = useState(null);              // latest snapshot
  const [macroCoachStartedAt, setMacroCoachStartedAt] = useState(null);
  const [lastCheckInAt, setLastCheckInAt] = useState(null); // read from /users and POST response
  const [adherence, setAdherence] = useState(null);
  const [loading, setLoading] = useState(true);

  // Overlay spinner state
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0);
  const intervalRef = useRef(null);

  // Spinner messages & timings
  const submitMessages = [
    "Hafta analizi yapılıyor…",
    "Metabolizma analizi yapılıyor…",
    "Makro analizi yapılıyor…",
  ];
  const MESSAGE_INTERVAL_MS = 3700;
  const MIN_SPIN_MS = 11100;

  const [csrfToken, setCsrfToken] = useState(null);
  const [weightAverages, setWeightAverages] = useState(null);
  const [toast, setToast] = useState(null);

  // --- CSRF
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", { credentials: "include" });
        const { csrfToken } = await r.json();
        if (csrfToken) {
          setCsrfToken(csrfToken);
          document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
          console.log("🔐 CSRF token set");
        }
      } catch (e) {
        console.error("CSRF error:", e);
      }
    })();
  }, []);

  // --- user (macroCoachStartedAt, lastCheckInAt)
  useEffect(() => {
    if (!loggedUser?.userid) return;
    (async () => {
      try {
        const r = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const user = await r.json();
        setMacroCoachStartedAt(user.macroCoachStartedAt || null);
        setLastCheckInAt(user.lastCheckInAt || null);

        console.log("👤 user markers:", {
          macroCoachStartedAt: user.macroCoachStartedAt,
          lastCheckInAt: user.lastCheckInAt,
        });
      } catch (e) {
        console.error("User fetch error:", e);
      }
    })();
  }, [loggedUser]);

  useEffect(() => {
  const locked = !TEST_FORCE_UNLOCK && isCheckinLockedWeekly();
  setIsLocked(locked);
}, [lastCheckInAt, submitting, TEST_FORCE_UNLOCK]);

  // --- form data (goal, goalSpeed, weight)
  useEffect(() => {
    if (!loggedUser?.userid) return;
    (async () => {
      try {
        const r = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoachform/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const data = await r.json();
        setFormData(data || null);
        console.log("📝 MacroCoach form:", data);
      } catch (e) {
        console.error("Form fetch error:", e);
      }
    })();
  }, [loggedUser]);

  // --- latest macros
  async function fetchLatestMacros() {
    try {
      const r = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}/latest`, {
        headers: { Authorization: `Bearer ${loggedUser.token}` },
        credentials: "include",
      });
      if (r.ok) {
        const latest = await r.json();
        setMacros(latest);
        console.log("📦 Latest macros:", latest);
      } else {
        setMacros(null);
        console.log("📦 No latest macros (status:", r.status, ")");
      }
    } catch (e) {
      console.error("Latest macros error:", e);
    }
  }
  useEffect(() => {
    if (loggedUser?.userid) fetchLatestMacros();
  }, [loggedUser]);

  // --- daily totals + adherence
  useEffect(() => {
    const fetchDaily = async () => {
      try {
        const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/dailymacrototals/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const data = await res.json();

        // Keep only days between start and < today; we ignore zero-only days here.
        const filtered = Array.isArray(data)
          ? data.filter((e) => {
              const ed = new Date(e.eatenDate);
              const sd = macroCoachStartedAt ? new Date(macroCoachStartedAt) : null;
              const today = new Date();
              ed.setHours(0,0,0,0);
              if (sd) sd.setHours(0,0,0,0);
              today.setHours(0,0,0,0);

              // valid entry if any macro > 0
              const valid =
                (e.totalProtein ?? 0) > 0 ||
                (e.totalCarbs ?? 0) > 0 ||
                (e.totalFats ?? 0) > 0 ||
                (e.totalFiber ?? 0) > 0;

              return valid && (!sd || (ed >= sd && ed < today));
            })
          : [];

        setDailyMacroTotals(filtered);
        console.log("📅 Daily totals (filtered, >0 only):", filtered);

        if (macros) {
          // ========== NORMALIZED ADHERENCE (missing days = 0, NOT stored) ==========
          const toLocalYMD = (dLike) => {
            const d = new Date(dLike);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          };
          const keyFromEntry = (eatenDate) =>
            (typeof eatenDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(eatenDate))
              ? eatenDate
              : toLocalYMD(e.eatenDate);

          const today = new Date();
          today.setHours(0,0,0,0);

          // Index all days we actually have entries for
          const byDay = new Map();
          (Array.isArray(data) ? data : []).forEach((e) => {
            const k = (typeof e.eatenDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.eatenDate))
              ? e.eatenDate
              : toLocalYMD(e.eatenDate);
            byDay.set(k, e);
          });

          console.log("📒 Indexed days (key → entry):", byDay);

          // ---- Haftalık (based on macroCoachStartedAt week) ----
          const start = new Date(macroCoachStartedAt);
          start.setHours(0, 0, 0, 0);

          // Full days since macroCoachStartedAt (excluding today)
          const daysElapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));

          let weeklyKeys = [];

          if (daysElapsed < 7) {
            // Not a full week yet → use all elapsed days (excluding today)
            weeklyKeys = Array.from({ length: daysElapsed }, (_, i) => {
              const d = new Date(start);
              d.setDate(d.getDate() + i);
              return toLocalYMD(d);
            });
          } else {
            // New weekly range: always last 7 full days (excluding today)
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - 7); // go back 7 days

            weeklyKeys = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + i);
              return toLocalYMD(d);
            });
          }

          console.log("📆 Weekly window (based on start date):", weeklyKeys);

          const weeklySum = weeklyKeys.reduce(
            (acc, k) => {
              const e = byDay.get(k);
              const p = e?.totalProtein ?? 0;
              const c = e?.totalCarbs   ?? 0;
              const f = e?.totalFats    ?? 0;
              console.log(`   🔹 Weekly day ${k}: P=${p}, C=${c}, F=${f}`);
              acc.protein += p;
              acc.carbs   += c;
              acc.fat     += f;
              return acc;
            },
            { protein: 0, carbs: 0, fat: 0 }
          );

          const divisor = weeklyKeys.filter(k => {
            const d = new Date(k);
            return d < today; // exclude today
          }).length || 1;

          const weeklyAvgPerDay = {
            protein: weeklySum.protein / divisor,
            carbs:   weeklySum.carbs   / divisor,
            fat:     weeklySum.fat     / divisor,
          };

          console.log("📊 Haftalık sums:", weeklySum);
          console.log("📊 Haftalık averages per day:", weeklyAvgPerDay);

          const pct = (v, target) =>
            !target || target <= 0 ? 0 : (v / target) * 100;

          const weeklyPct = {
            protein: pct(weeklyAvgPerDay.protein, macros.protein),
            carbs:   pct(weeklyAvgPerDay.carbs,   macros.carbs),
            fat:     pct(weeklyAvgPerDay.fat,     macros.fat),
          };

          const weeklyOverall = Number(
            ((weeklyPct.protein + weeklyPct.carbs + weeklyPct.fat) / 3).toFixed(1)
          );

          console.log("📈 Haftalık adherence calc:");
          console.log("   • Target macros:", macros);
          console.log("   • Percent vs target:", weeklyPct);
          console.log("   • Haftalık adherence overall:", weeklyOverall);

          // ---- Genel (since start, up to yesterday), normalized by elapsed days ----
          let overallOverall = null;
          if (macroCoachStartedAt) {
            const start = new Date(macroCoachStartedAt);
            start.setHours(0,0,0,0);
            const daysElapsed = Math.max(1, Math.floor((today - start) / (24*60*60*1000))); // number of days up to yesterday

            let overallSum = { protein: 0, carbs: 0, fat: 0 };
            for (let i = daysElapsed; i >= 1; i--) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              const k = toLocalYMD(d);
              const e = byDay.get(k);
              const p = e?.totalProtein ?? 0;
              const c = e?.totalCarbs   ?? 0;
              const f = e?.totalFats    ?? 0;
              console.log(`   🔸 Overall day ${k}: P=${p}, C=${c}, F=${f}`);
              overallSum.protein += p;
              overallSum.carbs   += c;
              overallSum.fat     += f;
            }

            const overallAvgPerDay = {
              protein: overallSum.protein / daysElapsed,
              carbs:   overallSum.carbs   / daysElapsed,
              fat:     overallSum.fat     / daysElapsed,
            };

            console.log("📊 Genel sums:", overallSum);
            console.log("📊 Genel averages per day:", overallAvgPerDay);

            const overallPct = {
              protein: pct(overallAvgPerDay.protein, macros.protein),
              carbs:   pct(overallAvgPerDay.carbs,   macros.carbs),
              fat:     pct(overallAvgPerDay.fat,     macros.fat),
            };
            overallOverall = Number(
              ((overallPct.protein + overallPct.carbs + overallPct.fat) / 3).toFixed(1)
            );

            console.log("📈 Genel adherence calc:");
            console.log("   • Target macros:", macros);
            console.log("   • Percent vs target:", overallPct);
            console.log("   • Genel adherence overall:", overallOverall);
          }

          setAdherence({
            weekly: weeklyOverall,
            overall: overallOverall,
            averages: {
              protein: Math.round(weeklyAvgPerDay.protein),
              carbs: Math.round(weeklyAvgPerDay.carbs),
              fat: Math.round(weeklyAvgPerDay.fat),
            },
          });
        }
      } catch (e) {
        console.error("Daily totals error:", e);
      } finally {
        setLoading(false);
      }
    };

    if (loggedUser?.userid && macroCoachStartedAt !== null && macros) {
      fetchDaily();
    }
  }, [loggedUser, macroCoachStartedAt, macros]);

  // --- weekly weight averages
  useEffect(() => {
    if (!loggedUser?.userid || !csrfToken) return;
    (async () => {
      try {
        const r = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/weights/averages/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}`, "CSRF-Token": csrfToken },
          credentials: "include",
        });
        if (!r.ok) throw new Error("Failed to fetch weight averages");
        const data = await r.json();
        setWeightAverages(data);
        console.log("⚖️ Weight averages:", data);
      } catch (e) {
        console.error("Weight averages error:", e);
      }
    })();
  }, [loggedUser, csrfToken]);

  // --- cycle spinner messages while submitting
  useEffect(() => {
    if (!submitting && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!submitting) return;

    setSubmitStep(0);
    intervalRef.current = setInterval(() => {
      setSubmitStep((prev) => (prev + 1) % submitMessages.length);
    }, MESSAGE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  // ---- WEEKLY lock helpers (unlocks at local 00:01 after 7 calendar days) ----
  const startOfLocalDay = (dateLike) => {
    const d = new Date(dateLike);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const addDaysLocal = (dateLike, n) => {
    const d = new Date(dateLike);
    d.setDate(d.getDate() + n);
    return d;
  };
  const nextWeeklyEligibilityAt0001 = (lastCheckInAtValue) => {
    const sod = startOfLocalDay(lastCheckInAtValue);
    const target = addDaysLocal(sod, 7);
    target.setHours(0, 1, 0, 0); // 00:01
    return target;
  };

  const isCheckinLockedWeekly = () => {
    if (!lastCheckInAt) {
      console.log("🔓 No lastCheckInAt → button active (never checked in).");
      return false;
    }

    const rawLastMs = new Date(lastCheckInAt).getTime();
    const nowMs     = Date.now();

    if (!Number.isFinite(rawLastMs)) {
      console.warn("⚠️ Invalid lastCheckInAt:", lastCheckInAt, "→ treating as no last check-in.");
      return false;
    }

    // Clamp future timestamps to now for sane logs
    const lastMs = Math.min(rawLastMs, nowMs);

    const nextEligible = nextWeeklyEligibilityAt0001(lastMs);
    const locked = nowMs < nextEligible.getTime();

    // Descriptive logs
    const lastLocalStr         = new Date(lastMs).toLocaleString();
    const nextEligibleLocalStr = nextEligible.toLocaleString();
    const nowLocalStr          = new Date(nowMs).toLocaleString();
    const exact168hMs          = lastMs + 7 * 24 * 60 * 60 * 1000;
    const exact168hStr         = new Date(exact168hMs).toLocaleString();

    if (locked) {
      const msLeft  = nextEligible.getTime() - nowMs;
      const hrsLeft = (msLeft / 3600000).toFixed(1);
      console.log(
        "⛔ Weekly lock ACTIVE.\n" +
        `   • Last check-in:           ${lastLocalStr}\n` +
        `   • Now:                     ${nowLocalStr}\n` +
        `   • Exact 7×24h mark:        ${exact168hStr} (pure 168 hours)\n` +
        `   • Unlock (weekly 00:01):   ${nextEligibleLocalStr}\n` +
        `   • ~${hrsLeft} hours left until unlock (weekly rule).`
      );
    } else {
      console.log(
        "✅ Weekly lock CLEARED.\n" +
        `   • Last check-in:           ${lastLocalStr}\n` +
        `   • Now:                     ${nowLocalStr}\n` +
        `   • Exact 7×24h mark:        ${exact168hStr}\n` +
        `   • Unlock (weekly 00:01):   ${nextEligibleLocalStr}\n` +
        "   • You’re past the weekly unlock time."
      );
    }

    return locked;
  };

    const saveWeeklyMacroAverages = async () => {
       console.log("🚀 saveWeeklyMacroAverages CALLED");
    if (!adherence || !csrfToken) return;
    try {
      const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/coachmacroaverages/${loggedUser.userid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          protein: adherence.averages?.protein ?? 0,
          carbs: adherence.averages?.carbs ?? 0,
          fat: adherence.averages?.fat ?? 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to save weekly averages");
      console.log("📊 Weekly averages saved before check-in");
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  // Button state (respect test override)
  const buttonLocked = isLocked || submitting;
  useEffect(() => {
  console.log("🚦 Button render state:", isLocked ? "LOCKED (weekly 00:01 rule)" : "ACTIVE",
              "| TEST_FORCE_UNLOCK =", TEST_FORCE_UNLOCK);
  }, [isLocked, TEST_FORCE_UNLOCK]);

  // --- CHECK-IN BUTTON HANDLER (with min spinner time)
  const handleCheckin = async () => {
    try {
      if (!formData || !macros || !weightAverages) {
        console.warn("Missing data for check-in:", { formData, macros, weightAverages });
        return;
      }
      if (!TEST_FORCE_UNLOCK && isCheckinLockedWeekly()) {
        console.warn("⏱️ Weekly lock (00:01 after 7 calendar days) active; ignoring click.");
        return;
      }

      setSubmitting(true);
      setToast(null);
      const start = Date.now();

       await saveWeeklyMacroAverages();

      const weeklyAvg = weightAverages?.weeklyAverage ?? null;
      const prevWeeklyAvg = weightAverages?.previousWeeklyAverage ?? null;

      const engineInput = {
        goal: formData.goal,
        goalSpeed: formData.goalSpeed,
        adherenceWeekly: adherence?.weekly ?? 0,
        weightAverages,
        currMacros: macros,
        weightKg: Number(formData.weight),
        macroCoachStartedAt,      // <<< pass to engine
        lastCheckInAt,            // <<< pass to engine
      };
      console.log("🧠 Engine input:", engineInput);

      const { nextMacros, message, reasonCode, uiMessage } = runCheckInEngine(engineInput);
      console.log("🧠 Engine output:", { nextMacros, message, reasonCode, uiMessage });

      // Save snapshot; backend updates lastCheckInAt and returns it
      const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({
          ...nextMacros,
          reason: message,
          reasonCode,
          uiMessage,
          goal: formData.goal,
          goalSpeed: formData.goalSpeed,
          weeklyAverage: weeklyAvg,
          previousWeeklyAverage: prevWeeklyAvg,
        }),
      });

      let created;
        try {
          created = await res.json();
          console.log("📦 Created snapshot response:", created);
        } catch (e) {
          const txt = await res.text();
          console.error("❌ Failed to parse JSON from response:", e);
          console.error("🔍 Raw response text:", txt);
          throw new Error(`Failed to parse JSON: ${txt}`);
        }

        if (!created || !created.lastCheckInAt) {
          console.warn("⚠️ No lastCheckInAt returned from backend! Here's what we got:", created);
        } else {
          setLastCheckInAt(created.lastCheckInAt);
          const locked = !TEST_FORCE_UNLOCK && isCheckinLockedWeekly(created.lastCheckInAt);
          setIsLocked(locked);
          console.log("⏱️ lastCheckInAt updated (POST response):", created.lastCheckInAt);
        }

      if (created?.lastCheckInAt) {
        setLastCheckInAt(created.lastCheckInAt);

        // ✅ Immediately recalculate lock state using new date
        const locked = !TEST_FORCE_UNLOCK && isCheckinLockedWeekly(created.lastCheckInAt);
        setIsLocked(locked);

        console.log("⏱️ lastCheckInAt updated (POST response):", created.lastCheckInAt);
      }

      console.log("💾 Snapshot saved.");
      await fetchLatestMacros();
      setToast(uiMessage || message || "Check-in tamamlandı.");

      // Enforce min spinner time
      const elapsed = Date.now() - start;
      if (elapsed < MIN_SPIN_MS) {
        await new Promise((r) => setTimeout(r, MIN_SPIN_MS - elapsed));
      }
    } catch (e) {
      console.error("Check-in error:", e);
      setToast("Check-in kaydedilemedi.");
    } finally {
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // --- UI helpers ---
  const formatDate = (iso) => {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("tr-TR", { month: "short" });
    return `${day}-${month}`;
  };

  const getColorClass = (v) => {
  if (v >= 90 && v <= 100) return "adherence-green"; // ideal range
  return "adherence-red"; // anything else: under or over
};

  return (
    <section className="container macrocoach-container">
      <Footer />

      {/* Overlay spinner during submission */}
      {submitting && (
        <div className="spinner-overlay">
          <div className="spinner-box">
            <ClipLoader color="#d73750" loading size={28} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {submitMessages[submitStep]}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="spinner-container">
          <ClipLoader color="#d73750" loading size={25} />
        </div>
      ) : (
        <div className="macrocoach-checkin-macrogoals">
          <div className="fixed-macro-header">
            <div className="totals-container">
              <div className="checkinpage-macros">
                <p className="checkin-macro-header">Güncel Makro Hedefleri</p>
                <div className="checkin-calorie-history">
                  <div className="checkin-calorie">
                    <h3>Total Kalori: {macros ? macros.calories : "-"} kcal</h3>
                  </div>
                  <div className="history">
                    <button
                      className="macro-coach-btn"
                      onClick={() => navigate("/checkinhistory")}
                      title="Check-in History"
                    >
                      <span role="img" aria-label="check">🔄</span>
                    </button>
                  </div>
                </div>

                <div className="checkin">
                  {["protein", "carbs", "fat", "fiber"].map((m) => (
                    <div className="totals" key={m}>
                      <p className="n-title">
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </p>
                      <p className="n-value">{macros ? macros[m] : "-"}g</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="macro-adherance">
              <p className="macro-adherance-header">Makrolara uyum:</p>
              Haftalık:{" "}
              <span className={getColorClass(adherence?.weekly)}>
                {adherence?.weekly ? `${adherence.weekly}%` : "-"}
              </span>{" "}
              | Genel:{" "}
              <span className={getColorClass(adherence?.overall)}>
                {adherence?.overall ? `${adherence.overall}%` : "-"}
              </span>
              <p>
                  <span>Güncel ortalama:{" "}</span>
                  <span className={getColorClass(adherence?.averages?.protein && macros?.protein ? (adherence.averages.protein / macros.protein) * 100 : 0)}>
                    {adherence?.averages?.protein ?? "-"}p
                  </span>,{" "}
                  <span className={getColorClass(adherence?.averages?.carbs && macros?.carbs ? (adherence.averages.carbs / macros.carbs) * 100 : 0)}>
                    {adherence?.averages?.carbs ?? "-"}k
                  </span>,{" "}
                  <span className={getColorClass(adherence?.averages?.fat && macros?.fat ? (adherence.averages.fat / macros.fat) * 100 : 0)}>
                    {adherence?.averages?.fat ?? "-"}y
                  </span>
              </p>
            </p>

            {weightAverages && (
              <div className="weight-averages">
                <p className="weight-header">Kilo Değişimi:</p>
                <ul className="weight-avg-list">
                  <li className="weight-avg-item">
                    <span className="wa-label">Güncel Haftalık Ortalama: </span>
                    <span className="wa-value">
                      {typeof weightAverages.weeklyAverage === "number"
                        ? weightAverages.weeklyAverage.toFixed(1)
                        : "-"}{" "}
                      kg
                    </span>
                  </li>
                  <li className="weight-avg-item">
                    <span className="wa-label">Önceki Haftalık Ortalama: </span>
                    <span className="wa-value">
                      {typeof weightAverages.previousWeeklyAverage === "number"
                        ? weightAverages.previousWeeklyAverage.toFixed(1)
                        : "-"}{" "}
                      kg
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="checkin-button-container">
            <button
              className={`checkin-button ${buttonLocked ? "btn-disabled" : ""}`}
              onClick={handleCheckin}
              disabled={buttonLocked}
              aria-disabled={buttonLocked}
              title={
                isLocked
                  ? "Haftalık check-in: Son check-in tarihinden 7 gün sonra, 00:01’de yeniden mümkün."
                  : "Check-in'i tamamla"
              }
            >
              Check-in'i tamamla
            </button>
          </div>

          {toast && <div className="toast">{toast}</div>}

          {/* Daily macro totals table */}
          <div className="daily-macro-totals-container">
            <div className="macro-row macro-header fixed-header">
              <div className="macro-cell">Tarih</div>
              <div className="macro-cell">Pro</div>
              <div className="macro-cell">Karb</div>
              <div className="macro-cell">Yağ</div>
              <div className="macro-cell">Lif</div>
            </div>
            <div className="scrollable-macro-list">
              {dailyMacroTotals.length ? (
                <div className="macro-list">
                  {dailyMacroTotals.map((e) => (
                    <div key={e._id} className="macro-row">
                      <div className="macro-cell">
                        {e.eatenDate ? formatDate(e.eatenDate) : "-"}
                      </div>
                      <div className="macro-cell">{e.totalProtein ?? 0}g</div>
                      <div className="macro-cell">{e.totalCarbs ?? 0}g</div>
                      <div className="macro-cell">{e.totalFats ?? 0}g</div>
                      <div className="macro-cell">{e.totalFiber ?? 0}g</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Henüz günlük makro verisi yok.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}