// src/pages/MacroCoach.jsx
import { useEffect, useState, useContext, useRef } from "react";
import { UserContext } from "../../context/UserContext";
import Footer from "../Footer";
import { useNavigate } from "react-router-dom";
import { calculateMacrosFromForm } from "../../utils/macroCalculators";
import ClipLoader from "react-spinners/ClipLoader";
import { getMacroResult } from "../../utils/macroCalculators";
import { macroCalculatorFromCurrentMacros } from "../../utils/macroCalculatorFromCurrentMacros";
import { useMemo } from "react";

export default function MacroCoach() {
  const { loggedUser } = useContext(UserContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState(null);
  const [macros, setMacros] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);

  const [macroCoachStartedAt, setMacroCoachStartedAt] = useState(null);
  const [lastCheckInAt, setLastCheckInAt] = useState(null);

  const [daysLeft, setDaysLeft] = useState(null);
  const [canCheckInNow, setCanCheckInNow] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const [showChangeGoalWarning, setShowChangeGoalWarning] = useState(false);

  const [toast, setToast] = useState(null);

    useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 1000000);
    return () => clearTimeout(timeout);
  }, [toast]);

  // ✅ Calculate macro result (for actual display)
  const result = useMemo(() => {
    if (!formData) {
      console.log("⛔ No formData yet → skipping macro result calculation.");
      return null;
    }

    const calculated = getMacroResult(formData);
    console.log("📦 getMacroResult() →", calculated);
    return calculated;
  }, [formData]);

  // ✅ Show toast if minimum fat + carb cap hit
useEffect(() => {
  console.group("🧪 Toast Effect Debug");
  console.log("formData:", formData);
  console.log("macroCoachStartedAt:", macroCoachStartedAt);
  const lastToast = localStorage.getItem("toastShownAt");
  console.log("🧠 localStorage.toastShownAt:", lastToast);
  console.groupEnd();

  if (!formData || !macroCoachStartedAt) {
    console.log("⛔ Missing formData or macroCoachStartedAt → skipping toast check.");
    return;
  }

  if (lastToast === macroCoachStartedAt) {
    console.log("🔕 Toast already shown for this coaching start. Skipping.");
    return;
  }

  console.log("🔔 Running macroCalculatorFromCurrentMacros just for toast check...");

  const result = macroCalculatorFromCurrentMacros(formData, (msg) => {
    if (msg) {
      console.log("🧨 Toast triggered with message:", msg);
      setToast(msg);
      localStorage.setItem("toastShownAt", macroCoachStartedAt); // ✅ Save marker
    } else {
      console.log("✅ No toast needed — safe macros.");
    }
  });

  console.log("📊 macroCalculatorFromCurrentMacros result:", result);
}, [formData, macroCoachStartedAt]);

  const [loading, setLoading] = useState(true);
  const postingRef = useRef(false);

  const toLocalMidnight = (dLike) => {
    const d = new Date(dLike);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  const msUntilNextLocal_0001 = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0);
    return next - now;
  };

  const computeEligibility = (markerLike) => {
    if (!markerLike) {
      console.warn("⏳ Countdown: No marker found.");
      return { eligibleAt: null, daysLeft: null, canCheck: false };
    }

    const base = toLocalMidnight(markerLike);
    const eligibleAt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7, 0, 1, 0, 0);
    const now = new Date();
    const msDay = 24 * 60 * 60 * 1000;
    const raw = Math.ceil((eligibleAt - now) / msDay);
    const daysLeft = Math.max(0, raw);
    const canCheck = now >= eligibleAt;

    return { eligibleAt, daysLeft, canCheck };
  };

  const refreshCountdown = () => {
    const isInitialSnapshot =
      !!macros &&
      (macros.reason === "initial" || macros.reasonCode === "initial" || macros.isInitial === true);

    if (isInitialSnapshot && !macroCoachStartedAt && !lastCheckInAt) {
      setDaysLeft(7);
      setCanCheckInNow(false);
      console.log("✅ Initial snapshot detected (reason=initial). Countdown starts at 7 days.");
      return;
    }

    const marker = lastCheckInAt || macroCoachStartedAt;
    const { eligibleAt, daysLeft, canCheck } = computeEligibility(marker);
    setDaysLeft(daysLeft);
    setCanCheckInNow(canCheck);

    console.log(
      `⏳ Countdown: daysLeft=${daysLeft}, canCheckInNow=${canCheck}, eligibleAt=${eligibleAt?.toString()} | ` +
      `marker=${marker ? new Date(marker).toString() : "none"}`
    );
  };

  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", { credentials: "include" });
        const { csrfToken } = await response.json();
        if (csrfToken) {
          setCsrfToken(csrfToken);
          document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
        }
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
      }
    }
    fetchCsrfToken();
  }, []);

  async function refreshUserMarkers() {
    try {
      const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${loggedUser.userid}`, {
        headers: { Authorization: `Bearer ${loggedUser.token}` },
        credentials: "include",
      });
      const user = await res.json();
      setMacroCoachStartedAt(user.macroCoachStartedAt || null);
      setLastCheckInAt(user.lastCheckInAt || null);
      console.log("👤 User markers", {
        macroCoachStartedAt: user.macroCoachStartedAt,
        lastCheckInAt: user.lastCheckInAt,
      });
    } catch (err) {
      console.error("❌ Error fetching user:", err);
    }
  }

  useEffect(() => {
    if (loggedUser?.userid) refreshUserMarkers();
  }, [loggedUser]);

  useEffect(() => {
    if (macroCoachStartedAt || lastCheckInAt) {
      refreshCountdown();
    }

    const firstTimeout = setTimeout(() => {
      refreshCountdown();
      const intervalId = setInterval(() => {
        refreshCountdown();
      }, 24 * 60 * 60 * 1000);
      firstTimeout.__intervalId = intervalId;
    }, msUntilNextLocal_0001());

    return () => {
      clearTimeout(firstTimeout);
      if (firstTimeout.__intervalId) clearInterval(firstTimeout.__intervalId);
    };
  }, [lastCheckInAt, macroCoachStartedAt, macros]);

  useEffect(() => {
    async function fetchFormData() {
      try {
        const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoachform/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const data = await res.json();
        setFormData(data);
        console.log("📝 MacroCoach form:", data);
      } catch (err) {
        console.error("Error fetching form data:", err);
      }
    }
    if (loggedUser?.userid) fetchFormData();
  }, [loggedUser]);

  useEffect(() => {
    if (!loggedUser?.userid || !formData) return;

    async function initMacros() {
      try {
        const latestRes = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}/latest`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });

        if (latestRes.ok) {
          const latest = await latestRes.json();
          setMacros(latest);
          console.log("📦 Latest macros:", latest);
          return;
        }

        if (latestRes.status === 404 && !postingRef.current) {
          postingRef.current = true;
          const calculated = getMacroResult(formData);
          if (calculated) {
            const created = await postSnapshot(calculated, "initial");
            setMacros(created);
            console.log("🆕 Initial macros snapshot created:", created);
            await refreshUserMarkers();
          }
          postingRef.current = false;
          return;
        }

        console.warn("⚠️ Unexpected latest status:", latestRes.status);
      } catch (e) {
        console.error("❌ Error initializing macros:", e);
        postingRef.current = false;
      }
    }

    initMacros();
  }, [formData, loggedUser]);

  useEffect(() => {
    const ready =
      csrfToken &&
      formData &&
      macros &&
      (macroCoachStartedAt || lastCheckInAt);

    if (ready) {
      const minSpinner = new Promise((res) => setTimeout(res, 300));
      minSpinner.then(() => setLoading(false));
    }
  }, [csrfToken, formData, macros, macroCoachStartedAt, lastCheckInAt]);

  async function postSnapshot(next, reason = "auto") {
    const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loggedUser.token}`,
        "CSRF-Token": csrfToken || "",
      },
      credentials: "include",
      body: JSON.stringify({ ...next, reason }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`POST failed (${res.status}): ${txt}`);
    }
    return await res.json();
  }

  const handleCheckInClick = () => {
    if (canCheckInNow) navigate("/checkin");
    else setShowWarning(true);
  };

  return (
    <section className="container macrocoach-container">
      {loading ? (
        <div className="spinner-container">
          <ClipLoader color="#d73750" loading={true} size={25} />
        </div>
      ) : (
        <div className="macrocoach-countdown-macrogoals">
          <div className="countdown-container macro-coach">
            <p className="avg-macro-header">Makro Koçu</p>
            <div className="macro-coach-top">
              <div className="macro-coach-days-left">
                <span className="macro-coach-number">{daysLeft ?? "-"}</span>
                <span className="macro-coach-text">gün kaldı</span>
              </div>
            </div>

            {!canCheckInNow && showWarning && (
              <div className="checkin-warning" role="alert">
                <strong>Check-in Aktif Değil</strong>
                <p>Check-in için 7 günün dolmasını bekleyin.</p>
                <button className="warning-dismiss" onClick={() => setShowWarning(false)}>
                  Kapat
                </button>
              </div>
            )}

            <div className="macro-coach-actions">
              <button
                className="macro-coach-btn"
                onClick={() => setShowChangeGoalWarning(true)}
              >
                <span role="img" aria-label="edit">📝</span> Hedef Değiştir
              </button>
              <div className="divider" />
              <button
                className={`macro-coach-btn ${canCheckInNow ? "" : "btn-disabled"}`}
                onClick={handleCheckInClick}
                aria-disabled={!canCheckInNow}
                title={
                  canCheckInNow
                    ? "Go to Check-in"
                    : "Check-in, 7 gün sonunda yerel 00:01'de aktif olur"
                }
              >
                <span role="img" aria-label="check">☑️</span> Check-in
              </button>
            </div>
          </div>

          <div className="totals-container">
            <p className="current-macro-header">Güncel Makro Hedefleri</p>
            {macros ? (
              <div className="total-macros">
                <div>
                  <h3>Total Kalori: {macros.calories} kcal</h3>
                </div>
                <div className="totals-row">
                  <div className="totals">
                    <p className="n-title">Pro</p>
                    <p className="n-value">{macros.protein}g</p>
                  </div>
                  <div className="totals">
                    <p className="n-title">Karb</p>
                    <p className="n-value">{macros.carbs}g</p>
                  </div>
                  <div className="totals">
                    <p className="n-title">Yağ</p>
                    <p className="n-value">{macros.fat}g</p>
                  </div>
                  <div className="totals">
                    <p className="n-title">Lif</p>
                    <p className="n-value">{macros.fiber}g</p>
                  </div>
                </div>
              </div>
            ) : (
              <p>Makrolar hesaplanıyor...</p>
            )}
          </div>
          {toast && <div className="toast-macrocoach">{toast}</div>}
        </div>
      )}

      {/* ✅ Modal for goal change confirmation */}
    {showChangeGoalWarning && (
      <div className="modal-overlay">
        <div className="modal-content">
          <p className="modal-title">Hedefini değiştirmek istediğine emin misin?</p>
          <p className="modal-subtitle">
            Bu, makro koçunun önerilerini yeniden düzenleyecek ve sana yeni bir makro planı oluşturacaktır.
          </p>
          <div className="modal-buttons">
            <button
              className="modal-btn cancel"
              onClick={() => setShowChangeGoalWarning(false)}
            >
              İptal
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => navigate("/macrocoachform?edit=true")}
            >
              Evet
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Always render Footer */}
      <Footer />
    </section>
  );
}