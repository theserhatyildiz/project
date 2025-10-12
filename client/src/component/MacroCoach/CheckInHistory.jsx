// src/pages/CheckInHistory.jsx
import { useEffect, useState, useContext } from "react";
import { UserContext } from "../../context/UserContext";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "../Footer";
import ClipLoader from "react-spinners/ClipLoader"; // 👈 import spinner

export default function CheckInHistory() {
  const { loggedUser } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const toast = location.state?.toast || null;
  const initialGoal = location.state?.goal || null;

  const [history, setHistory] = useState([]);
  const [goal, setGoal] = useState(initialGoal);
  const [loading, setLoading] = useState(true); // 👈 new state

  useEffect(() => {
    if (!loggedUser?.userid) {
      console.warn("⚠️ No loggedUser, skip fetch");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        console.log("📡 GET history for", loggedUser.userid);
        const r = await fetch(
          `https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}/history`,
          {
            headers: { Authorization: `Bearer ${loggedUser.token}` },
            credentials: "include",
          }
        );
        console.log("📥 status:", r.status);
        const data = await r.json();
        console.log("📥 JSON:", data);

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.history)
          ? data.history
          : [];
        setHistory(list);

        if (!goal && data?.goal) setGoal(data.goal);

        console.log(
          "✅ history.length:",
          list.length,
          "goal:",
          goal || data?.goal || "(none)"
        );
      } catch (e) {
        console.error("❌ Error fetching check-in data:", e);
      } finally {
        setLoading(false); // 👈 stop spinner
      }
    })();
  }, [loggedUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtRange = (createdAt) => {
    const d = new Date(createdAt);
    const end = new Date(d);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    const fmt = (x) =>
      `${x.toLocaleString(undefined, { month: "short" })} ${x.getDate()}`;
    return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`;
  };

  const goalLabel =
    goal === "fat-loss"
      ? "Kilo verme"
      : goal === "reverse-diet"
      ? "Reverse diyet"
      : goal === "weight-gain"
      ? "Kilo alma"
      : "Goal";

  return (
    <section className="container checkinhistory-container">
      <Footer />
      <div className="fixed-history-header">
            <h1>Check-ins</h1>

            {goal && <p style={{ opacity: 0.8, marginBottom: 12 }}>Hedef: {goalLabel}</p>}

      </div>
      {loading ? (
        <div className="spinner-container">
          <ClipLoader color="#d73750" loading size={28} />
        </div>
      ) : (
        <div className="history-list">
          <div className="scrollable-history-list">
          {history.length ? (
            history.slice(0, -1).map((item, idx) => {
              const key = item._id ?? item.id ?? idx;
              const deltaCal =
                typeof item.calories === "number" &&
                typeof item.prevCalories === "number"
                  ? item.calories - item.prevCalories
                  : null;

              return (
                <button
                  key={key}
                  className="history-row"
                  onClick={() => {
                    const id = item._id ?? item.id;
                    if (!id) {
                      console.warn("⚠️ Missing id/_id on history item", item);
                      return;
                    }
                    navigate(`/checkinreport/${id}`);
                  }}
                  title="View report"
                >
                  <div className="row-left">
                    <div className="row-title">{fmtRange(item.createdAt)}</div>
                    <div className="row-sub">
                      {typeof item.weeklyAverage === "number" &&
                      typeof item.previousWeeklyAverage === "number"
                        ? (() => {
                            const diff = item.weeklyAverage - item.previousWeeklyAverage;
                            const sign = diff > 0 ? "+" : "";
                            return `Kilo değişimi: ${sign}${diff.toFixed(1)} kg `;
                          })()
                        : ""}
                      {deltaCal
                        ? `${deltaCal > 0 ? "+" : ""}${deltaCal} Cal`
                        : ""}
                    </div>
                  </div>
                  <div className="row-right">➜</div>
                </button>
              );
            })
          ) : (
            <p>Henüz geçmiş check-in verisi yok.</p>
          )}
        </div>
        </div>
      )}
    </section>
  );
}