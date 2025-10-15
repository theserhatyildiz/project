import { useContext, useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Header from '../Header';
import Footer from "../Footer";
import { UserContext } from "../../context/UserContext";
import { useCheckinCountdown } from "../../hooks/useCheckinCountdown";
import ClipLoader from "react-spinners/ClipLoader";

export default function Dashboard() {

  const { loggedUser } = useContext(UserContext);
  const [macroGoals, setMacroGoals] = useState({});
  const [weeklyAverage, setWeeklyAverage] = useState(null);

  const [weeklyMacroAdherence, setWeeklyMacroAdherence] = useState(null);

  const [weightAverages, setWeightAverages] = useState({
    weeklyAverage: null,
    previousWeeklyAverage: null,
  });

  const [csrfToken, setCsrfToken] = useState("");
  const [macroCoachStartedAt, setMacroCoachStartedAt] = useState(null);
  const [lastCheckInAt, setLastCheckInAt] = useState(null);
  const { daysLeft, canCheckInNow } = useCheckinCountdown({ macroCoachStartedAt, lastCheckInAt, macros: null });

  const startDateParam = macroCoachStartedAt ? new Date(macroCoachStartedAt).toISOString() : "";
  const [macroCoachStartedAtReady, setMacroCoachStartedAtReady] = useState(false);

  // 🟢 Added new color + loading spinner control
  const [color] = useState("#d73750");
  const [loading, setLoading] = useState(true);

  // 🟢 Added new "dataReady" tracker to only hide spinner after all 3 requests complete
  const [dataReady, setDataReady] = useState({
    macroGoals: false,
    weeklyAverage: false,
    weightAverages: false,
  });

  // 🟢 Added unified control: when all 3 are true → hide spinner
  useEffect(() => {
    if (dataReady.macroGoals && dataReady.weeklyAverage && dataReady.weightAverages) {
      console.log("✅ All data fetched — hiding spinner");
      setLoading(false);
    }
  }, [dataReady]);

  // 🟡 Fetch CSRF token (same as before)
  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", { credentials: 'include' });
        const { csrfToken } = await response.json();
        if (csrfToken) {
          setCsrfToken(csrfToken);
          document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
        }
      } catch (error) {
        console.error('Error fetching CSRF token:', error);
      }
    }
    fetchCsrfToken();
  }, []);

  // 🟡 Fetch Macro Goals (unchanged logic, but added setDataReady)
  useEffect(() => {
    if (!loggedUser?.token || !loggedUser?.userid || !csrfToken) return;
    let cancelled = false;

    (async () => {
      try {
        const [coachRes, savedRes] = await Promise.allSettled([
          fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}`, {
            headers: { Authorization: `Bearer ${loggedUser.token}` },
            credentials: "include",
          }),
          fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-goals", {
            headers: {
              Authorization: `Bearer ${loggedUser.token}`,
              "CSRF-Token": csrfToken,
            },
            credentials: "include",
          }),
        ]);

        let nextGoals = { goalProtein: 0, goalCarbohydrate: 0, goalFat: 0, goalFiber: 0 };

        if (coachRes.status === "fulfilled" && coachRes.value.ok) {
          const coach = await coachRes.value.json();
          nextGoals = {
            goalProtein: Number(coach?.protein ?? 0),
            goalCarbohydrate: Number(coach?.carbs ?? 0),
            goalFat: Number(coach?.fat ?? 0),
            goalFiber: Number(coach?.fiber ?? 0),
          };
        } else if (savedRes.status === "fulfilled" && savedRes.value.ok) {
          const saved = await savedRes.value.json();
          nextGoals = {
            goalProtein: Number(saved?.goalProtein ?? 0),
            goalCarbohydrate: Number(saved?.goalCarbohydrate ?? 0),
            goalFat: Number(saved?.goalFat ?? 0),
            goalFiber: Number(saved?.goalFiber ?? 0),
          };
        }

        if (!cancelled) {
          setMacroGoals(nextGoals);

          // 🟢 Mark macroGoals as fetched
          setDataReady(prev => ({ ...prev, macroGoals: true }));
        }
      } catch (e) {
        console.error("Macro goals fetch error:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [loggedUser, csrfToken]);

  // 🟡 Fetch Weekly Averages
// 🟡 Fetch Weekly Averages (wait for macroCoachStartedAt to be ready)
useEffect(() => {
  async function fetchWeeklyAverage() {
    if (!loggedUser?.token || !loggedUser?.userid || !csrfToken || !macroCoachStartedAtReady) {
      console.log("⛔ Skipping weekly average fetch — waiting for prerequisites");
      return;
    }

    const startDateParam = macroCoachStartedAt
      ? new Date(macroCoachStartedAt).toISOString()
      : "";

    const url = `https://galwinapp1-c1d71c579009.herokuapp.com/macro-totals/weekly-average?userId=${loggedUser.userid}&includeToday=true&startDate=${encodeURIComponent(startDateParam)}`;

    console.log("🔄 Fetching weekly average macros from:", url);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken,
        },
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch weekly average");

      const data = await response.json();
      console.log("✅ Weekly average data received:", data);
      setWeeklyAverage(data);

      // ✅ Mark data ready
      setDataReady((prev) => ({ ...prev, weeklyAverage: true }));
    } catch (error) {
      console.error("💥 Error fetching weekly average:", error);
    }
  }

  fetchWeeklyAverage();
}, [loggedUser, csrfToken, macroCoachStartedAtReady, macroCoachStartedAt]);

  // 🟡 Fetch Weight Averages
  useEffect(() => {
    async function fetchWeightAverages() {
      try {
        const response = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/weights/averages/${loggedUser.userid}`, {
          headers: {
            Authorization: `Bearer ${loggedUser.token}`,
            "CSRF-Token": csrfToken,
          },
          credentials: "include",
        });
        const data = await response.json();
        setWeightAverages(data);

        // 🟢 Mark weightAverages as fetched
        setDataReady(prev => ({ ...prev, weightAverages: true }));
      } catch (error) {
        console.error("Error fetching weight averages:", error);
      }
    }
    if (loggedUser?.userid && csrfToken) fetchWeightAverages();
  }, [loggedUser, csrfToken]);


// 🟡 Fetch Check-in markers (fetch macroCoachStartedAt)
useEffect(() => {
  async function fetchMarkers() {
    if (!loggedUser?.userid || !loggedUser?.token) {
      console.log("⛔ Skipping fetchMarkers — user not ready");
      return;
    }

    console.log("📡 Fetching macroCoachStartedAt and lastCheckInAt...");
    try {
      const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${loggedUser.userid}`, {
        headers: { Authorization: `Bearer ${loggedUser.token}` },
        credentials: "include",
      });
      const user = await res.json();

      console.log("✅ Markers fetched:", {
        macroCoachStartedAt: user.macroCoachStartedAt,
        lastCheckInAt: user.lastCheckInAt,
      });

      setMacroCoachStartedAt(user.macroCoachStartedAt || null);
      setLastCheckInAt(user.lastCheckInAt || null);

      // ✅ Mark as ready for use
      setMacroCoachStartedAtReady(true);
    } catch (err) {
      console.error("Failed to fetch user markers:", err);
      setMacroCoachStartedAtReady(true); // even if fails, allow fallback
    }
  }

  fetchMarkers();
}, [loggedUser]);

 // ------------------- CALCULATE WEEKLY ADHERANCE -------------------
useEffect(() => {
  if (!weeklyAverage || !macroGoals) return;

  const calculateAdherence = () => {
    // 🧭 Explicitly define property name mappings
    const macroMap = [
      { avgKey: "avgProtein", goalKey: "goalProtein", label: "Protein" },
      { avgKey: "avgCarbs", goalKey: "goalCarbohydrate", label: "Carbohydrate" },
      { avgKey: "avgFats", goalKey: "goalFat", label: "Fat" },
    ];

    let totalAdherence = 0;
    let count = 0;

    console.log("📊 Starting adherence calculation...");
    console.log("📦 weeklyAverage object:", weeklyAverage);
    console.log("📦 macroGoals object:", macroGoals);

    for (const { avgKey, goalKey, label } of macroMap) {
      const avg = Number(weeklyAverage[avgKey]);
      const goal = Number(macroGoals[goalKey]);

      console.log(`➡️ ${label} → Avg: ${avg}, Goal: ${goal}`);

      if (!isFinite(avg) || !isFinite(goal) || goal <= 0) {
        console.warn(`⚠️ Skipping ${label} due to invalid value.`);
        continue;
      }

      const ratio = avg / goal;
      const percent = Math.round(ratio * 100);

      console.log(`✅ ${label} adherence: ${percent}%`);

      totalAdherence += ratio;
      count++;
    }

    const finalAdherence =
      count > 0 ? Math.round((totalAdherence / count) * 100) : 0;

    console.log("🎯 Final weekly macro adherence:", finalAdherence + "%");
    setWeeklyMacroAdherence(finalAdherence);
  };

  calculateAdherence();
}, [weeklyAverage, macroGoals]);

// console.log("Macro adherence debug:", {
//   avgProtein: weeklyAverage?.avgProtein,
//   goalProtein: macroGoals?.goalProtein,
//   avgCarbs: weeklyAverage?.avgCarbs,
//   goalCarbohydrate: macroGoals?.goalCarbohydrate,
//   avgFats: weeklyAverage?.avgFats,
//   goalFat: macroGoals?.goalFat,
// });

  // ------------------- CALCULATE AVERAGE CALORIES -------------------
  const avgCalories = weeklyAverage
    ? (
        weeklyAverage.avgProtein * 4 +
        weeklyAverage.avgCarbs * 4 +
        weeklyAverage.avgFats * 9
      ).toFixed(0)
    : 0;

  return (
  <div className="page-wrapper">
    <section className="container dashboard-container">
      <div className="average-nutrition">
        {loading ? (
          <div className="spinner-overlay">
            <ClipLoader color={color} loading={loading} size={28} />
          </div>
        ) : (
          <>
            {/* ---- MACRO TOTALS ---- */}
            <div className="totals-container dashboard-macros">
              <p className="avg-macro-header">Haftalık Ortalama</p>
              <div className="total-macros">
                <div className="totals-header">
                  <h3>Total Kalori: {avgCalories} kcal</h3>
                  <h3>Uyum: %{weeklyMacroAdherence}</h3>
                </div>
                <div className="totals-row dashboard-totals-row">
                  <div className="totals">
                    <p className="n-title">Pro</p>
                    <p className="n-value">{weeklyAverage?.avgProtein || 0}g</p>
                    <div className="macroGoals-digits dashboard-macroGoals-digits">
                      <p>{macroGoals.goalProtein || 0}g</p>
                    </div>
                  </div>
                  <div className="totals">
                    <p className="n-title">Karb</p>
                    <p className="n-value">{weeklyAverage?.avgCarbs || 0}g</p>
                    <div className="macroGoals-digits dashboard-macroGoals-digits">
                      <p>{macroGoals.goalCarbohydrate || 0}g</p>
                    </div>
                  </div>
                  <div className="totals">
                    <p className="n-title">Yağ</p>
                    <p className="n-value">{weeklyAverage?.avgFats || 0}g</p>
                    <div className="macroGoals-digits dashboard-macroGoals-digits">
                      <p>{macroGoals.goalFat || 0}g</p>
                    </div>
                  </div>
                  <div className="totals">
                    <p className="n-title">Lif</p>
                    <p className="n-value">{weeklyAverage?.avgFiber || 0}g</p>
                    <div className="macroGoals-digits dashboard-macroGoals-digits">
                      <p>{macroGoals.goalFiber || 0}g</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- WEEKLY WEIGHT ---- */}
            <div className="totals-container average-weight">
              <p className="avg-macro-header">Haftalık Ortalama Ağırlık</p>
              <div className="total-macros">
                <div className="weight-data dashboard-weight-data">
                  <div className="weight-data-info">
                    <p className="info-title-avg">Güncel</p>
                    <p className="info-value-avg">{weightAverages.weeklyAverage || 0}kg</p>
                  </div>
                  <div className="weight-data-info">
                    <p className="info-title-avg">Önceki</p>
                    <p className="info-value-avg">{weightAverages.previousWeeklyAverage || 0}kg</p>
                  </div>
                </div>
                <div className="weight-change"><p>Kilo değişimi:{weightChangeRounded > 0 ? "+" : ""}  {weightChangeRounded}kg</p></div>
              </div>
              
            
            </div>

            {/* ---- MACRO COACH ---- */}
            {macroCoachStartedAt && (
              <div className="totals-container macro-coach">
                <p className="avg-macro-header">Makro Koçu</p>
                <div className="macro-coach-top">
                  <div className="macro-coach-days-left">
                    <span className="macro-coach-number">{daysLeft ?? "-"}</span>
                    <span className="macro-coach-text">gün kaldı</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>

    {/* ✅ Always at bottom */}
    <Footer />
  </div>
);
}