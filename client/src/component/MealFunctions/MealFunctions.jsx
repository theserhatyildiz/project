import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import { UserContext } from "../../context/UserContext";
import DeleteCopyFunction from "./DeleteCopyFunction";
import ClipLoader from "react-spinners/ClipLoader";

export default function MealFunctions() {
    const loggedData = useContext(UserContext);
    const [date, setDate] = useState(new Date());
    const [displayMealNumber, setDisplayMealNumber] = useState(1);
    const [copyMealNumber, setCopyMealNumber] = useState(1);
    const [foodsByMeal, setFoodsByMeal] = useState({});
    const [selectedFoods, setSelectedFoods] = useState([]);
    const [copyDate, setCopyDate] = useState(formatDate(new Date()));
    const [message, setMessage] = useState({ type: "", text: "" });
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [color] = useState("#d73750");
    const [csrfToken, setCsrfToken] = useState('');
    const [selectAll, setSelectAll] = useState(false);

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getRelativeDayLabel(dateStr) {
        const inputDate = new Date(dateStr);
        const today = new Date();
    
        // Clear time for comparison
        today.setHours(0, 0, 0, 0);
        inputDate.setHours(0, 0, 0, 0);
    
        const diffInMs = inputDate - today;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
        if (diffInDays === 0) return " Bugün:";
        if (diffInDays === 1) return " Yarın:";
        if (diffInDays === -1) return " Dün:";
        return "";
    }

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const mealNumberParam = queryParams.get("mealNumber");
        const eatenDateParam = queryParams.get("eatenDate");
        const initialDate = eatenDateParam ? new Date(eatenDateParam) : new Date();
        const initialMealNumber = mealNumberParam ? parseInt(mealNumberParam) : 1;
        setDisplayMealNumber(initialMealNumber);
        setCopyMealNumber(initialMealNumber);
        setCopyDate(formatDate(initialDate));
    }, [location]);

    useEffect(() => {
        if (displayMealNumber) {
            fetchFoodItems(displayMealNumber);
        }
    }, [displayMealNumber]);

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

    // ✅ New useEffect to update selectAll based on selection
    useEffect(() => {
        const allFoods = foodsByMeal[displayMealNumber] || [];
        const allSelected = allFoods.length > 0 && allFoods.every(food =>
            selectedFoods.some(selected => selected._id === food._id)
        );
        setSelectAll(allSelected);
    }, [selectedFoods, foodsByMeal, displayMealNumber]);

    const fetchFoodItems = (mealNumber) => {
        setLoading(true);
        const queryParams = new URLSearchParams(location.search);
        const eatenDateParam = queryParams.get("eatenDate");

        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/track/${loggedData.loggedUser.userid}/${mealNumber}/${eatenDateParam}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${loggedData.loggedUser.token}`,
                "csrf-token": csrfToken,
            },
            credentials: 'include'
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            setFoodsByMeal(prevState => ({
                ...prevState,
                [mealNumber]: data
            }));
            setSelectedFoods([]); // Clear selections when new meal is loaded
            setSelectAll(false); // Reset Select All
            setLoading(false);
        })
        .catch((error) => {
            console.error("Error fetching food items:", error);
            setLoading(false);
        });
    };

    const refreshFoods = () => {
        fetchFoodItems(displayMealNumber);
    };

    const handleCopyMealNumberChange = (event) => {
        setCopyMealNumber(parseInt(event.target.value));
    };

    const handleCheckboxChange = (event, foodId) => {
        const isChecked = event.target.checked;
        const foodToAdd = foodsByMeal[displayMealNumber].find(food => food._id === foodId);

        setSelectedFoods(prevSelected => {
            const updatedSelected = isChecked
                ? [...prevSelected, foodToAdd]
                : prevSelected.filter(food => food._id !== foodId);
            return updatedSelected;
        });
    };

    const handleSelectAllChange = (event) => {
        const isChecked = event.target.checked;
        setSelectAll(isChecked);

        if (isChecked) {
            setSelectedFoods([...foodsByMeal[displayMealNumber]]);
        } else {
            setSelectedFoods([]);
        }
    };

    function formatNumber(number) {
        if (number % 1 === 0) {
            return number.toString();
        } else {
            return parseFloat(number.toFixed(1)).toString();
        }
    }

    return (
        <section className="container createfood-container">
            <h1>Yiyecekler</h1>
            <div className="meal-function-container">
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
                    foodsByMeal[displayMealNumber] && (
                        <>
                            <div className="select-all">
                                <div className="check-box">
                                    <input 
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={handleSelectAllChange}
                                    />
                                </div>
                                <div>
                                    <h4>Tümünü Seç</h4>
                                </div>
                            </div>

                            {foodsByMeal[displayMealNumber].map((food, index) => (
                                <ul key={index}>
                                    <li>
                                        <div className="check-box-container">
                                            <div className="check-box">
                                                <input 
                                                    type="checkbox" 
                                                    value={food._id} 
                                                    checked={selectedFoods.some(selected => selected._id === food._id)}
                                                    onChange={(event) => handleCheckboxChange(event, food._id)}
                                                />
                                            </div>
                                            <div>
                                                <h4>{food.details.Name}</h4>
                                            </div>
                                        </div>
                                        <div className="food-info">
                                            <h4>{food.quantity}g -</h4>
                                            <p>{formatNumber(food.details.Calorie)} cal: {formatNumber(food.details.Protein)}p, {formatNumber(food.details.Carbohydrate)}k, {formatNumber(food.details.Fat)}y, {formatNumber(food.details.Fiber)}lif</p>
                                        </div>
                                    </li>
                                </ul>
                            ))}
                        </>
                    )
                )}
            </div>
            <div className="date-meal-section">
            <p>{getRelativeDayLabel(copyDate)}</p>
                <input
                    className="meal-function-date-box"
                    type="date"
                    value={copyDate}
                    onChange={(event) => setCopyDate(formatDate(new Date(event.target.value)))}
                />
                
                <select className="meal-selection" onChange={handleCopyMealNumberChange} value={copyMealNumber.toString()}>
                    {[1, 2, 3, 4, 5, 6].map((number) => (
                        <option key={number} value={number}>
                            {number}.Öğün
                        </option>
                    ))}
                </select>
            </div>
            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}
            <DeleteCopyFunction
                selectedFoods={selectedFoods}
                foodsByMeal={foodsByMeal} 
                setFoodsByMeal={setFoodsByMeal}
                mealNumber={copyMealNumber}
                copyDate={copyDate}
                refreshFoods={refreshFoods}
                setMessage={setMessage}
            />
        </section>
    );
}