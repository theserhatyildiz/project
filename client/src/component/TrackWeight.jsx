import { UserContext } from "../context/UserContext";
import { useContext, useState, useEffect } from "react";
import '@fortawesome/fontawesome-free/css/all.css';
import Header from "./Header";
import Footer from "./Footer";
import ClipLoader from "react-spinners/ClipLoader";
// ✅ NEW: Import the calculation function
import { calculateWeightMetrics } from "../utils/weightCalculations";

export default function TrackWeight() {
    const loggedData = useContext(UserContext);
    const [weightDetails, setWeightDetails] = useState({ weight: "", date: new Date().toISOString().slice(0, 10) });
    const [message, setMessage] = useState({ type: "", text: "" });
    const [weightEntries, setWeightEntries] = useState([]);
    const [shouldFetchData, setShouldFetchData] = useState(true);
    const [wcDetails, setWcDetails] = useState({ choice: "yes" });

    // ✅ RENAMED: startDate → weightTrackingStartDate
    const [weightTrackingStartDate, setWeightTrackingStartDate] = useState("");
    const [startDateEntry, setStartDateEntry] = useState("");

    const [loading, setLoading] = useState(true);
    const [color] = useState("#d73750");
    const [csrfToken, setCsrfToken] = useState("");

    // Keep these state variables for display
    const [weeklyAverage, setWeeklyAverage] = useState(0);
    const [previousWeeklyAverage, setPreviousWeeklyAverage] = useState(0);
    const [weeklyAverageDifference, setWeeklyAverageDifference] = useState(0);
    const [totalDifference, setTotalDifference] = useState(0);

    useEffect(() => {
        fetchStartDateFromServer();
        setLoading(true);

      if (shouldFetchData) {
        fetchWeightEntries();
        console.log("Fetching weight entries...");
      }
      setShouldFetchData(false);
    }, [shouldFetchData]);

    // ✅ NEW: Single useEffect for all calculations using the utility function
    useEffect(() => {
        // Only calculate if we have entries
        if (weightEntries.length === 0) {
            setWeeklyAverage(0);
            setPreviousWeeklyAverage(0);
            setWeeklyAverageDifference(0);
            setTotalDifference(0);
            setLoading(false);
            return;
        }

        // Calculate all metrics at once using the new utility function
        const metrics = calculateWeightMetrics(weightEntries, weightTrackingStartDate);

        // Update state with results
        setWeeklyAverage(metrics.weeklyAverage);
        setPreviousWeeklyAverage(metrics.previousWeeklyAverage);
        setWeeklyAverageDifference(metrics.weeklyAverageDifference);
        setTotalDifference(metrics.totalDifference);

        console.log('📊 Calculated metrics:', metrics);
        
        // Optional: Send to server if you want to store these
        if (csrfToken && loggedData?.loggedUser?.userid && metrics.weeklyAverage !== 0) {
            sendWeightAverages(metrics);
        }

        setLoading(false);
    }, [weightEntries, weightTrackingStartDate]); // Recalculate when entries or start date change

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
    
    const fetchWeightEntries = () => {
        const year = new Date().getFullYear();
        const userId = loggedData.loggedUser.userid;
        const token = loggedData.loggedUser.token;
        const choice = wcDetails.choice;
    
        let allWeightEntries = [];
    
        const fetchEntriesForMonth = async (month, choice) => {
            try {
                const response = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/weights/${userId}/${year}/${month}?choice=${choice}`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                        "CSRF-Token": csrfToken
                    },
                    credentials: 'include'
                });
    
                if (!response.ok) {
                    throw new Error("Failed to fetch weight entries");
                }
    
                const data = await response.json();
                return data;
            } catch (error) {
                console.error("Error fetching weight entries:", error);
                return [];
            }
        };
    
        const promises = [];
    
        for (let month = 1; month <= 12; month++) {
            promises.push(fetchEntriesForMonth(month, choice));
        }
    
        Promise.all(promises)
            .then((results) => {
                allWeightEntries = results.reduce((acc, curr) => acc.concat(curr), []);
                console.log("All Weight Entries Data:", allWeightEntries);
                setWeightEntries(allWeightEntries);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching weight entries:", error);
                setLoading(false);
            });
    };
    

    const handleInput = (event) => {
        const { name, value } = event.target;
        setWeightDetails((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    }

    const handleWcInput = (event) => {
        const { name, value } = event.target;
        console.log("Choice Value:", value);
        setWcDetails((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };


    const handleSubmit = (event) => {
        event.preventDefault();

        const formData = {
            weight: weightDetails.weight,
            date: weightDetails.date,
            choice: wcDetails.choice
        };

        console.log("handle submit Choice Value:", formData.choice);
        console.log("handle submit formData Value:", formData);


        const existingEntry = weightEntries.find(entry => entry.date === weightDetails.date);

        if (existingEntry) {
            updateWeightEntry(existingEntry._id);
        } else {
            createWeightEntry(formData);
        }
    }

    const createWeightEntry = (formData) => {
        fetch("https://galwinapp1-c1d71c579009.herokuapp.com/weights", {
            method: "POST",
            body: JSON.stringify(formData),
            headers: {
                "Authorization": `Bearer ${loggedData.loggedUser.token}`,
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            console.log("Response object:", response);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("Response data:", data);
            setMessage({ type: "success", text: "Başarılı ✅" });
            fetchWeightEntries();
        })
        .catch(error => {
            console.error("Fetch error:", error);
            setMessage({ type: "error", text: "Bir hata oluştu!" });
        })
        .finally(() => {
            setTimeout(() => {
                setMessage({ type: "", text: "" });
            }, 2000);
        });
    }

    const updateWeightEntry = (entryId) => {
        const formData = {
            weight: weightDetails.weight,
            date: weightDetails.date,
            choice: wcDetails.choice
        };

        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/weights/${entryId}`, {
            method: "PUT",
            body: JSON.stringify(formData),
            headers: {
                "Authorization": `Bearer ${loggedData.loggedUser.token}`,
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.ok) {
                setMessage({ type: "success", text: "Güncellendi ✅" });
                fetchWeightEntries();
            } else {
                setMessage({ type: "error", text: "Bir hata oluştu!" });
            }
        })
        .catch(error => {
            console.error("Update error:", error);
            setMessage({ type: "error", text: "Bir hata oluştu!" });
        })
        .finally(() => {
            setTimeout(() => {
                setMessage({ type: "", text: "" });
            }, 2000);
        });
    }


    const handleDateChange = (event) => {
        setWeightDetails((prevState) => ({
            ...prevState,
            date: event.target.value
        }));
    }


    const handleDelete = (entryId) => {
        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/weights/${entryId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${loggedData.loggedUser.token}`,
                "CSRF-Token": csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.status === 200) {
                fetchWeightEntries();
            } else {
                setMessage({ type: "error", text: "Bir hata oluştu!" });
                setTimeout(() => {
                    setMessage({ type: "", text: "" });
                }, 2000);
            }
        })
        .catch(err => {
            console.log(err);
        });
    }
    
    // Group weight entries by month
    const groupWeightEntriesByMonth = () => {
        const groupedEntries = {};

        weightEntries.forEach((entry) => {
            const monthYear = new Date(entry.date).toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
            if (!groupedEntries[monthYear]) {
                groupedEntries[monthYear] = [];
            }
            groupedEntries[monthYear].push(entry);
        });

        // Sort entries within each month
        Object.values(groupedEntries).forEach((entries) => {
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        });

        // Reverse the order of months
        return Object.entries(groupedEntries).reverse();
    };

    // ✅ REMOVED: All old calculation functions (calculateWeeklyAverage, calculatePreviousWeeklyAverage, etc.)
    // These are now handled by the imported calculateWeightMetrics function

    const [showEntryField, setShowEntryField] = useState(true);

    const handleEntryClick = () => {
        setShowEntryField(!showEntryField);
        localStorage.setItem('showEntryField', JSON.stringify(!showEntryField));
    };

    useEffect(() => {
        const storedShowEntryField = JSON.parse(localStorage.getItem('showEntryField'));
        if (storedShowEntryField !== null) {
            setShowEntryField(storedShowEntryField);
        }
    }, []);

    // ✅ UPDATED: handleMakeStartDate with new variable name
    const handleMakeStartDate = (event) => {
        event.preventDefault();
        const newStartDate = weightDetails.date.slice(0, 10);
        console.log("New Start Date:", newStartDate);
    
        const filteredWeightEntries = weightEntries.filter((entry) => new Date(entry.date) >= new Date(newStartDate));
        console.log("Filtered Weight Entries:", filteredWeightEntries);
    
        // ✅ UPDATED: setStartDate → setWeightTrackingStartDate
        setWeightTrackingStartDate(newStartDate);
        
        const userId = loggedData.loggedUser.userid;
        const token = loggedData.loggedUser.token;

        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${userId}/${newStartDate}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
            },
            // ✅ UPDATED: Field name in body
            body: JSON.stringify({ weightTrackingStartDate: newStartDate }),
            credentials: 'include'
        })
        .then(response => {
            console.log("PUT Response:", response);
            if (!response.ok) {
                throw new Error("Failed to update start date");
            }
            console.log("Start date updated successfully");
        })
        .catch(error => {
            console.error("Error updating start date:", error);
        });
    };
    
    // ✅ UPDATED: fetchStartDateFromServer with new variable name
    const fetchStartDateFromServer = () => {
        const userId = loggedData.loggedUser.userid;
        const token = loggedData.loggedUser.token;
        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${userId}/startdate`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch start date from server");
            }
            return response.json();
        })
        .then(data => {
            // ✅ UPDATED: Set the weightTrackingStartDate from server response
            setWeightTrackingStartDate(data.weightTrackingStartDate);
        })
        .catch(error => {
            console.error("Error fetching start date from server:", error);
        });
    };

    // ✅ UPDATED: handleDeleteStartDate with new variable name
    const handleDeleteStartDate = () => {
        const userId = loggedData.loggedUser.userid;
        const token = loggedData.loggedUser.token;
        fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/users/${userId}/startdate`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.ok) {
                // ✅ UPDATED: setStartDate → setWeightTrackingStartDate
                if (weightTrackingStartDate !== "") {
                    setWeightTrackingStartDate("");
                }
                console.log("Start date deleted successfully");
            } else {
                throw new Error("Failed to delete start date");
            }
        })
        .catch(error => {
            console.error("Error deleting start date:", error);
        });
    };

    // ✅ UPDATED: sendWeightAverages to accept metrics parameter
    const sendWeightAverages = async (metrics) => {
      try {
        const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/weights/averages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${loggedData.loggedUser.token}`,
            "Content-Type": "application/json",
            "CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({
            userId: loggedData.loggedUser.userid,
            weeklyAverage: metrics.weeklyAverage,
            previousWeeklyAverage: metrics.previousWeeklyAverage,
          }),
        });

        const result = await response.json();
        console.log("✅ Weight averages saved:", result);
      } catch (error) {
        console.error("💥 Error saving weight averages:", error);
      }
    };

return (
    <section className="container weight-container">
        <Header />
        <Footer />

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
            <div>
                <span className="section-title">Kilo Girişi</span>
        
                <div className="weight-entry">
                    {showEntryField && (
                        <div className="weight-entry-start">
                            <input
                                className="date-box"
                                type="date"
                                value={weightDetails.date}
                                onChange={handleDateChange}
                            />

                            <form className="form" onSubmit={handleSubmit}>
                                <div className="weight-entry-box">
                                    <input
                                        type="number"
                                        step="0.01"
                                        onChange={handleInput}
                                        className="inp-weight"
                                        placeholder="Kilo"
                                        name="weight"
                                        value={weightDetails.weight}
                                        required
                                    />

                                    <p className="weight-entry-box-paraf">Kilonuzu sabah hiçbir şey yemeden içmeden, tuvaleti kullandıktan sonra aynı saatte tartmanız önerilmektedir.</p>
                                    <div className="weight-entry-box-wc">
                                        <p className="weight-entry-box-wc-question">Tuvalete çıktınız mı?</p>
                                        <div>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="choice"
                                                    value="✅"
                                                    onChange={handleWcInput}
                                                    checked={wcDetails.choice === "✅"}
                                                    required
                                                />
                                                Evet
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="choice"
                                                    value="❌"
                                                    onChange={handleWcInput}
                                                    checked={wcDetails.choice === "❌"}
                                                    required
                                                />
                                                Hayır
                                            </label>
                                        </div>
                                    </div>

                                    <div className="weight-track-btn">
                                        <button className="btn-add">+</button>
                                    </div>

                                    <div className="start-date-box">
                                        <div className="trash-can-button-group">
                                        <button type="button" onClick={handleDeleteStartDate}>
                                             <i className="fa-regular fa-trash-can"></i>
                                        </button> 
                                        <button onClick={handleMakeStartDate}>Bu tarihi başlangıç yap</button>
                                        </div>
                                        {/* ✅ UPDATED: startDate → weightTrackingStartDate */}
                                        {weightTrackingStartDate && <p className="start-date-display">Başlangıç: {new Date(weightTrackingStartDate).toLocaleDateString('tr-TR')}</p>}                                         
                                    </div>
                                    <div className="weight-msg">
                                        <p className={message.type}>{message.text}</p>
                                    </div>
                                </div>
                                
                            </form>
                        </div>
                    )}

                </div>

                <div className="weight-data">
                    <div className="weight-data-info">
                        <p className="info-title-avg">Güncel</p>
                        <p className="info-subtitle-avg">Ortalama</p>
                        <p className="info-value-avg">{weeklyAverage}kg</p>
                    </div>

                    <div className="weight-data-info">
                        <p className="info-title-avg">Önceki</p>
                        <p className="info-subtitle-avg">Ortalama</p>
                        <p className="info-value-avg">{previousWeeklyAverage}kg</p>
                    </div>

                    <div className="weight-data-info">
                        <p className="info-title">Haftalık</p>
                        <p className="info-title">Değişim</p>
                        <p className="info-value">{weeklyAverageDifference}kg</p>
                    </div>

                    <div className="weight-data-info">
                        <p className="info-title">Toplam</p>
                        <p className="info-title">Değişim</p>
                        <p className="info-value">
                        {totalDifference > 0 ? `+${totalDifference}` : totalDifference < 0 ? `${totalDifference}` : '0'}kg</p>          
                    </div>
                </div>

                {/* Display weight entries */}
                <div className="weight-entries-container">
                    {groupWeightEntriesByMonth().map(([monthYear, entries]) => (
                        <div className="weight-log-container" key={monthYear}>
                            <h2>{monthYear}</h2>
                            {entries.map((entry, index) => (
                                // ✅ UPDATED: startDate → weightTrackingStartDate
                                <div key={index} className={`weight-log ${weightTrackingStartDate && entry.date && entry.date.substring(0, 10) === weightTrackingStartDate.substring(0, 10) ? 'start-date' : ''}`}>
                                    <div className="weight-log-items">
                                        <div className="items-info">
                                            <p className="l-value">{new Date(entry.date).toLocaleDateString('tr-TR')} | </p>
                                            <p className="l-value">{entry.weight}kg</p>
                                            <p className="l-value">WC: {entry.choice}</p>
                                            <button onClick={() => handleDelete(entry._id)}>
                                                <i className="fa-regular fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="start-date-buttons">
                                        {/* ✅ UPDATED: startDate → weightTrackingStartDate */}
                                        {weightTrackingStartDate && weightTrackingStartDate.substring(0, 10) && entry.date && entry.date.substring(0, 10) === weightTrackingStartDate.substring(0, 10) && (
                                            <p className="start-date-text">Başlangıç!</p>
                                        )}

                                        {/* ✅ UPDATED: startDate → weightTrackingStartDate */}
                                        {weightTrackingStartDate && entry.date && entry.date.substring(0, 10) === weightTrackingStartDate.substring(0, 10) && (
                                            <button onClick={handleDeleteStartDate}>
                                                <i className="fa-regular fa-trash-can"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        )}
    </section>
)}