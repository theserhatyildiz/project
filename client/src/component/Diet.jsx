import { UserContext } from "../context/UserContext"; 
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from './Header';
import Footer from "./Footer";
import Meal from "./Meal";
import ObjectId from 'bson-objectid';
import ClipLoader from "react-spinners/ClipLoader";

export default function Diet() {
    // ------------------Variables------------------

    const { loggedUser, currentDateView, setCurrentDateView } = useContext(UserContext);
    const [items, setItems] = useState([]); // Ensure initial state is an array
    const [total, setTotal] = useState({
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0
    });
    const [loading, setLoading] = useState(true); // Initial loading state set to true
    const [color] = useState("#d73750"); // Color state for ClipLoader
    const [csrfToken, setCsrfToken] = useState(""); // State to store CSRF token
    const [macroGoals, setMacroGoals] = useState({});

    // console.log("Diet items:", { items });
    

    useEffect(() => {
        async function fetchCsrfToken() {
            try {
                const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", { credentials: 'include' });
                const { csrfToken } = await response.json();
                console.log('CSRF Token fetched:', csrfToken);
                if (csrfToken) {
                    setCsrfToken(csrfToken);
                    document.cookie = `XSRF-TOKEN=${csrfToken}; Secure; SameSite=Strict; path=/`;
                    console.log('CSRF Token stored in cookie:', csrfToken);
                }
            } catch (error) {
                console.error('Error fetching CSRF token:', error);
            }
        }

        fetchCsrfToken();
    }, []);

     // Fetch saved macro goals on mount
  useEffect(() => {
        async function fetchMacroGoals() {
        try {
            const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-goals", {
            headers: {
                "Authorization": `Bearer ${loggedUser.token}`,
                "CSRF-Token": csrfToken // Include CSRF token in headers
            },
            credentials: 'include'
            });
            if (!response.ok) throw new Error("Failed to fetch macro goals");

            const data = await response.json();
            setMacroGoals(data);
        } catch (error) {
            console.error("Error fetching macro goals:", error);
        }
        }

        if (loggedUser?.token) {
        fetchMacroGoals();
        }
    }, [loggedUser]);

        // ------------------Functions------------------

        useEffect(() => {
        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/track/${loggedUser.userid}/${currentDateView.getMonth() + 1}-${currentDateView.getDate()}-${currentDateView.getFullYear()}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${loggedUser.token}`,
            "CSRF-Token": csrfToken
        },
        credentials: 'include'
    })
    .then((response) => response.json())
    .then((data) => {
        const delay = new Promise(res => setTimeout(res, 500));
        return Promise.all([data, delay]); // Combine data with 500ms delay
    })
    .then(([data]) => {
        console.log("from diet.jsx:", data);
        if (Array.isArray(data)) {
            setItems(data);
        } else {
            setItems([]);
        }
        setLoading(false); // Only after both fetch and delay complete
    })
    .catch((err) => {
        console.log(err);
        setItems([]);
        setLoading(false);
    });
}, [loggedUser, currentDateView, csrfToken]);

    useEffect(() => {
        if (Array.isArray(items)) {
            calculateTotal();
        }
    }, [items]);

    const handleDeleteFood = (foodId) => {
        deleteFood(foodId)
        .then(() => {
            setItems(prevItems => prevItems.filter(item => item._id !== foodId));
            calculateTotal();
        })
        .catch(error => {
            console.error("Error deleting food:", error);
        });
    };

    function deleteFood(itemId) {
        return fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/track/${itemId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${loggedUser.token}`,
                "CSRF-Token": csrfToken // Include CSRF token in headers
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.ok) {
                console.log("Food deleted successfully");
            } else {
                throw new Error(`Error deleting food: ${response.statusText}`);
            }
        })
        .catch(error => {
            console.error("Error deleting food:", error);
            throw error;
        });
    }

    function calculateTotal() {
        let totalCopy = {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFats: 0,
            totalFiber: 0
        };

        items.forEach((item) => {
            totalCopy.totalCalories += item.details.Calorie;
            totalCopy.totalProtein += item.details.Protein;
            totalCopy.totalCarbs += item.details.Carbohydrate;
            totalCopy.totalFats += item.details.Fat;
            totalCopy.totalFiber += item.details.Fiber;
        });

        totalCopy.totalCalories = parseFloat(totalCopy.totalCalories.toFixed(1));
        totalCopy.totalProtein = parseFloat(totalCopy.totalProtein.toFixed(1));
        totalCopy.totalCarbs = parseFloat(totalCopy.totalCarbs.toFixed(1));
        totalCopy.totalFats = parseFloat(totalCopy.totalFats.toFixed(1));
        totalCopy.totalFiber = parseFloat(totalCopy.totalFiber.toFixed(1));

        setTotal(totalCopy);
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
        mealItemsArray.forEach((item) => {
            item.mealNumber = meal.number;
        });
        mealItems.push(...mealItemsArray);
    });

    // Check if the current date is today, yesterday, or tomorrow
    const getRelativeDay = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
    
        if (date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()) {
            return "bugün";
        } else if (date.getDate() === yesterday.getDate() &&
                   date.getMonth() === yesterday.getMonth() &&
                   date.getFullYear() === yesterday.getFullYear()) {
            return "dün";
        } else if (date.getDate() === tomorrow.getDate() &&
                   date.getMonth() === tomorrow.getMonth() &&
                   date.getFullYear() === tomorrow.getFullYear()) {
            return "yarın";
        } else {
            const weekdays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
            return weekdays[date.getDay()];
        }
    };

    const relativeDay = getRelativeDay(currentDateView);

    const changeDate = (offset) => {
        console.log('Current Date View before change:', currentDateView.toISOString());

        const newDate = new Date(currentDateView);
        newDate.setDate(newDate.getDate() + offset);
        setCurrentDateView(newDate);
    };

    useEffect(() => {
        console.log('Current Date View updated:', currentDateView.toISOString());
    }, [currentDateView]);

    return (
        <>
            <section className="container diet-container">
                {loading ? (
                    <div className="spinner-container">
                        <ClipLoader
                            color={color}
                            loading={loading}
                            size={25}
                            aria-label="Loading Spinner"
                            data-testid="loader"
                        />
                    </div>
                ) : (
                    <>
                        <Header />
                        <div className="fixed-header">
                            <div className="day-date">
                                <button onClick={() => changeDate(-1)}>{"<"}</button>
                                {relativeDay && <p>{relativeDay}: </p>}
                                <input 
                                    className="date-box" 
                                    type="date" 
                                    value={currentDateView.toISOString().slice(0, 10)} 
                                    onChange={(event) => {
                                        setCurrentDateView(new Date(event.target.value));
                                    }}
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
                                            <div className="macroGoals-digits"><p> {macroGoals.goalProtein || 0}g</p></div>
                                        </div>
                                        <div className="totals">
                                            <p className="n-title">Karb</p>
                                            <p className="n-value">{total.totalCarbs}g</p>
                                            <div className="macroGoals-digits"><p> {macroGoals.goalCarbohydrate || 0}g</p></div>
                                        </div>
                                        <div className="totals">
                                            <p className="n-title">Yağ</p>
                                            <p className="n-value">{total.totalFats}g</p>
                                            <div className="macroGoals-digits"><p> {macroGoals.goalFat || 0}g</p></div>
                                        </div>
                                        <div className="totals">
                                            <p className="n-title">Lif</p>
                                            <p className="n-value">{total.totalFiber}g</p>
                                            <div className="macroGoals-digits"><p> {macroGoals.goalFiber || 0}g</p></div>
                                        </div>
                                    </div>

                                    {/* <div className="totals-row">
                                        <div className="macroGoals-digits"><p> {macroGoals.goalProtein || 0}g</p></div>
                                        <div className="macroGoals-digits"><p> {macroGoals.goalCarbohydrate || 0}g</p></div>
                                        <div className="macroGoals-digits"><p> {macroGoals.goalFat || 0}g</p></div>
                                        <div className="macroGoals-digits"><p> {macroGoals.goalFiber || 0}g</p></div>
                                     </div> */}

                                </div>
                            </div>
                        </div>
                        <div className="scrollable-content">
                        {meals.map((meal) => {
                            // Format the date as MM/DD/YYYY
                            const eatenDate = `${currentDateView.getMonth() + 1}/${currentDateView.getDate()}/${currentDateView.getFullYear()}`;
                            console.log(`Diet Eaten Date: ${eatenDate}`);
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