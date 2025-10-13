import { UserContext } from "../context/UserContext";
import { useContext, useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Meal from "./Meal";
import ClipLoader from "react-spinners/ClipLoader";

export default function Diet() {
  // ------------------ Context & State ------------------
  const { loggedUser, currentDateView, setCurrentDateView } = useContext(UserContext);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFats: 0,
    totalFiber: 0,
  });

  const [loading, setLoading] = useState(true);
  const [color] = useState("#d73750");
  const [csrfToken, setCsrfToken] = useState("");
  const [macroGoals, setMacroGoals] = useState({
    goalProtein: 0,
    goalCarbohydrate: 0,
    goalFat: 0,
    goalFiber: 0,
  });

  const [dataReady, setDataReady] = useState({
  csrfToken: false,
  macroGoals: false,
  dailyItems: false,
  });

  const headerRef = useRef(null); // ✅ new ref for header
  const scrollRef = useRef(null); // ✅ new ref for scrollable area

  useEffect(() => {
  if (dataReady.csrfToken && dataReady.macroGoals && dataReady.dailyItems) {
    setLoading(false);
    console.log("✅ All Diet page data fetched — hiding spinner");
  }
  }, [dataReady]);

    useEffect(() => {
    if (headerRef.current && scrollRef.current) {
      const height = headerRef.current.offsetHeight;
      scrollRef.current.style.paddingTop = `${height}px`; // ✅ dynamically apply padding
    }
  }, [loading]);

  // ------------------ CSRF Token ------------------
  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", { credentials: "include" });
        const { csrfToken } = await response.json();
        if (csrfToken) {
          setCsrfToken(csrfToken);
          document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
          setDataReady(prev => ({ ...prev, csrfToken: true }));
        }
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
      }
    }
    fetchCsrfToken();
  }, []);

  // ------------------ Get macro goals (prefer coach) ------------------
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

        // Prefer coach if available
        if (coachRes.status === "fulfilled" && coachRes.value.ok) {
          const coach = await coachRes.value.json();
          nextGoals = {
            goalProtein: Number(coach?.protein ?? 0),
            goalCarbohydrate: Number(coach?.carbs ?? 0),
            goalFat: Number(coach?.fat ?? 0),
            goalFiber: Number(coach?.fiber ?? 0),
          };
          console.log("✅ Using MacroCoach macros:", nextGoals);
        } else if (savedRes.status === "fulfilled" && savedRes.value.ok) {
          const saved = await savedRes.value.json();
          nextGoals = {
            goalProtein: Number(saved?.goalProtein ?? 0),
            goalCarbohydrate: Number(saved?.goalCarbohydrate ?? 0),
            goalFat: Number(saved?.goalFat ?? 0),
            goalFiber: Number(saved?.goalFiber ?? 0),
          };
          console.log("ℹ️ Using saved macro goals:", nextGoals);
        } else {
          console.warn("⚠️ Neither coach nor saved macros available.");
        }

        if (!cancelled) {
          setMacroGoals(nextGoals);
          setDataReady(prev => ({ ...prev, macroGoals: true }));
        }
      } catch (e) {
        console.error("Macro goals fetch error:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [loggedUser, csrfToken]);

  // ------------------ Fetch Daily Items For Current Date ------------------
  useEffect(() => {
    if (!loggedUser?.token || !csrfToken) return;

    let cancelled = false;

    (async () => {
      try {
        const url = `https://galwinapp1-c1d71c579009.herokuapp.com/track/${loggedUser.userid}/${currentDateView.getMonth() + 1}-${currentDateView.getDate()}-${currentDateView.getFullYear()}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${loggedUser.token}`,
            "CSRF-Token": csrfToken,
          },
          credentials: "include",
        });

        const data = await response.json();
        await new Promise((res) => setTimeout(res, 200)); // gentle spinner

        if (!cancelled) {
        setItems(Array.isArray(data) ? data : []);

        // ✅ Mark dailyItems as ready only on successful fetch
        setDataReady(prev => ({ ...prev, dailyItems: true }));
      }
    } catch (err) {
      console.error(err);

      if (!cancelled) {
        setItems([]); // fallback if error
        setDataReady(prev => ({ ...prev, dailyItems: true })); // ✅ Also mark as ready on failure
      }
    }
    // ❌ Removed redundant: setLoading(false)
    })();

      return () => { cancelled = true; };
    }, [loggedUser, currentDateView, csrfToken]);

  // ------------------ Recalc Totals When Items Change ------------------
  useEffect(() => {
    if (Array.isArray(items)) {
      calculateTotal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ------------------ Helpers ------------------
  function calculateTotal() {
    const tot = items.reduce(
      (acc, item) => {
        acc.totalCalories += item.details.Calorie;
        acc.totalProtein += item.details.Protein;
        acc.totalCarbs += item.details.Carbohydrate;
        acc.totalFats += item.details.Fat;
        acc.totalFiber += item.details.Fiber;
        return acc;
      },
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0, totalFiber: 0 }
    );

    const normalized = {
      totalCalories: parseFloat(tot.totalCalories.toFixed(1)),
      totalProtein: parseFloat(tot.totalProtein.toFixed(1)),
      totalCarbs: parseFloat(tot.totalCarbs.toFixed(1)),
      totalFats: parseFloat(tot.totalFats.toFixed(1)),
      totalFiber: parseFloat(tot.totalFiber.toFixed(1)),
    };

    setTotal(normalized);
    saveDailyMacros(normalized);
  }

  async function saveDailyMacros(macroData) {
    if (!csrfToken) return;

    const formattedDate = currentDateView.toISOString().slice(0, 10);

    try {
      const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-totals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          userId: loggedUser.userid,
          eatenDate: formattedDate,
          totalProtein: macroData.totalProtein,
          totalCarbs: macroData.totalCarbs,
          totalFats: macroData.totalFats,
          totalFiber: macroData.totalFiber,
        }),
      });

      const result = await response.json();
      console.log("📬 Backend response:", result);
      if (!response.ok) throw new Error("Failed to save macro totals");
    } catch (error) {
      console.error("Error saving macro totals:", error);
    }
  }

  const handleDeleteFood = (foodId) => {
    deleteFood(foodId)
      .then(() => {
        setItems((prev) => prev.filter((item) => item._id !== foodId));
        calculateTotal();
      })
      .catch((error) => {
        console.error("Error deleting food:", error);
      });
  };

  function deleteFood(itemId) {
    return fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/track/${itemId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${loggedUser.token}`,
        "CSRF-Token": csrfToken,
      },
      credentials: "include",
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error deleting food: ${response.statusText}`);
      }
    });
  }

  const meals = [
    { number: 1, title: "1.Öğün" },
    { number: 2, title: "2.Öğün" },
    { number: 3, title: "3.Öğün" },
    { number: 4, title: "4.Öğün" },
    { number: 5, title: "5.Öğün" },
    { number: 6, title: "6.Öğün" },
  ];

  const mealItems = [];
  meals.forEach((meal) => {
    const mealItemsArray = Array.isArray(items) ? items.filter((item) => item.mealNumber === meal.number) : [];
    mealItemsArray.forEach((item) => { item.mealNumber = meal.number; });
    mealItems.push(...mealItemsArray);
  });

  const getRelativeDay = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    const tomorrow = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "bugün";
    if (date.toDateString() === yesterday.toDateString()) return "dün";
    if (date.toDateString() === tomorrow.toDateString()) return "yarın";
    const weekdays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    return weekdays[date.getDay()];
  };

  const relativeDay = getRelativeDay(currentDateView);

  const changeDate = (offset) => {
    const newDate = new Date(currentDateView);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDateView(newDate);
  };

  // ------------------ Render ------------------
 return (
  <>
    <Header />

    <section className="diet-page-wrapper">
      {loading ? (
        <div className="spinner-container">
          <ClipLoader color={color} loading={loading} size={25} />
        </div>
      ) : (
        <>
          {/* Fixed Header */}
          <div className="fixed-header" ref={headerRef}>
            <div className="day-date">
              <button onClick={() => changeDate(-1)}>{"<"}</button>
              {relativeDay && <p>{relativeDay}: </p>}
              <input
                className="date-box"
                type="date"
                value={currentDateView.toISOString().slice(0, 10)}
                onChange={(event) => setCurrentDateView(new Date(event.target.value))}
              />
              <button onClick={() => changeDate(1)}>{">"}</button>
            </div>

            <div className="totals-container">
              <div className="total-macros">
                <div>
                  <h3>Total Kalori: {total.totalCalories} kcal</h3>
                </div>

                <div className="totals-row">
                  <div className="totals">
                    <p className="n-title">Pro</p>
                    <p className="n-value">{total.totalProtein}g</p>
                    <div className="macroGoals-digits">
                      <p>{macroGoals.goalProtein ?? 0}g</p>
                    </div>
                  </div>

                  <div className="totals">
                    <p className="n-title">Karb</p>
                    <p className="n-value">{total.totalCarbs}g</p>
                    <div className="macroGoals-digits">
                      <p>{macroGoals.goalCarbohydrate ?? 0}g</p>
                    </div>
                  </div>

                  <div className="totals">
                    <p className="n-title">Yağ</p>
                    <p className="n-value">{total.totalFats}g</p>
                    <div className="macroGoals-digits">
                      <p>{macroGoals.goalFat ?? 0}g</p>
                    </div>
                  </div>

                  <div className="totals">
                    <p className="n-title">Lif</p>
                    <p className="n-value">{total.totalFiber}g</p>
                    <div className="macroGoals-digits">
                      <p>{macroGoals.goalFiber ?? 0}g</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable meals area */}
          <div className="scrollable-content" ref={scrollRef}>
            {meals.map((meal) => {
              const eatenDate = `${currentDateView.getMonth() + 1}/${currentDateView.getDate()}/${currentDateView.getFullYear()}`;
              return (
                <Meal
                  key={meal.number}
                  items={mealItems.filter((item) => item.mealNumber === meal.number)}
                  mealNumber={meal.number}
                  deleteFood={handleDeleteFood}
                  eatenDate={eatenDate}
                />
              );
            })}
          </div>
        </>
      )}
    </section>

    <Footer />
  </>
);
}