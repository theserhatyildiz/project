import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserContext } from "../../context/UserContext";
import Footer from "../Footer";
import ClipLoader from "react-spinners/ClipLoader";

export default function CheckInReport() {
  const { id } = useParams();
  const { loggedUser } = useContext(UserContext);
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [prev, setPrev] = useState(null);
  const [weeklyMacroCoachAverage, setWeeklyMacroCoachAverage] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !loggedUser?.userid) return;
    (async () => {
      try {
        const r = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/item/${id}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const data = await r.json();
        setItem(data);

        const histRes = await fetch(
          `https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}/history`,
          { headers: { Authorization: `Bearer ${loggedUser.token}` }, credentials: "include" }
        );
        const hist = await histRes.json();
        if (Array.isArray(hist)) {
          const idx = hist.findIndex((x) => x._id === id);
          if (idx >= 0 && idx + 1 < hist.length) setPrev(hist[idx + 1]);
        }

        const avgRes = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/coachmacroaverages/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });
        const avgData = await avgRes.json();
        setWeeklyMacroCoachAverage(avgData);
        console.log("📊 Weekly macro coach average:", avgData);
      } catch (e) {
        console.error("❌ Error fetching report:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loggedUser]);

  // 🌀 Show spinner while loading
  if (loading) {
    return (
      <section className="container checkinreport-container">
        <div className="spinner-container">
          <ClipLoader color="#d73750" loading size={28} />
        </div>
      </section>
    );
  }

  // ❗ If no item found
  if (!item) {
    return (
      <section className="container checkinreport-container">
        <p>Rapor bulunamadı.</p>
        <Footer />
      </section>
    );
  }

  const kcalDelta =
    prev && typeof item.calories === "number" && typeof prev.calories === "number"
      ? item.calories - prev.calories
      : null;

  const kgChange =
    typeof item.weeklyAverage === "number" && typeof item.previousWeeklyAverage === "number"
      ? (item.weeklyAverage - item.previousWeeklyAverage).toFixed(1)
      : null;

  const rangeText = (() => {
    const end = new Date(item.createdAt);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    const fmt = (x) =>
      `${x.toLocaleString("en-US", { month: "short" })} ${x.getDate()}`;
    return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`;
  })();

  const handleBackClick = () => navigate("/checkin");

  return (
    <section className="container checkinreport-container">
      <h1>Check-in Raporu</h1>
      <h2 className="report-date">{rangeText}</h2>

      <div className="coach-message card">
        <h3 className="coach-message-text">Koç yorumu:</h3>
        <p className="toast toast-report">
          {item.uiMessage || item.reason || "Koç notu mevcut değil."}
        </p>
      </div>

      <h3>Yeni Makro Hedefleri</h3>
      <div className="total-macros report-total-macros ">
        <div>
          <h3>Kalori: {item.calories} kcal</h3>
        </div>
        <div className="totals-container">
          <div className="totals-row">
            <div className="totals">
              <div className="label">Pro</div>
              <div className="val">{item.protein}g</div>
            </div>
            <div className="totals">
              <div className="label">Karb</div>
              <div className="val">{item.carbs}g</div>
            </div>
            <div className="totals">
              <div className="label">Yağ</div>
              <div className="val">{item.fat}g</div>
            </div>
            <div className="totals">
              <div className="label">Lif</div>
              <div className="val">{item.fiber}g</div>
            </div>
          </div>
        </div>
      </div>

      <p className="previous-average">
        Önceki ortalama:{" "}
        {weeklyMacroCoachAverage[0]?.protein ?? "-"}p,{" "}
        {weeklyMacroCoachAverage[0]?.carbs ?? "-"}c,{" "}
        {weeklyMacroCoachAverage[0]?.fat ?? "-"}f
      </p>

      <h3 className="checkin-progress-title">Güncel Gelişim</h3>

      <div className="checkin-progress-block">
        <div className="progress-row">
          <div className="progress-cell">
            <div className="label">Başlangıç</div>
            <div className="val">
              {typeof item.previousWeeklyAverage === "number"
                ? `${item.previousWeeklyAverage.toFixed(1)} kg`
                : "-"}
            </div>
          </div>
          <div className="progress-cell">
            <div className="label">Bitiş</div>
            <div className="val">
              {typeof item.weeklyAverage === "number"
                ? `${item.weeklyAverage.toFixed(1)} kg`
                : "-"}
            </div>
          </div>
          <div className="progress-cell">
            <div className="label">Değişim</div>
            <div className="val">{kgChange ? `${kgChange} kg` : "-"}</div>
          </div>
        </div>
      </div>

      <div className="meal-function-footer-wrapper">
        <footer className="meal-function-footer">
          <div>
            <button
              className="meal-function-footer-button"
              onClick={handleBackClick}
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}