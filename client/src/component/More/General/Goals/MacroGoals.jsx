import { UserContext } from "../../../../context/UserContext";
import { useContext, useState, useEffect } from "react";
import Footer from "../../../Footer";
import ClipLoader from "react-spinners/ClipLoader";

// ... imports stay the same

export default function MacroGoals() {
  const { loggedUser } = useContext(UserContext);
  const [macroGoals, setMacroGoals] = useState({});
  const [loading, setLoading] = useState(true);
  const [color] = useState("#d73750");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [csrfToken, setCsrfToken] = useState("");
  const [importedFromCoach, setImportedFromCoach] = useState(false);

  // Fetch CSRF token
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

  // Fetch saved macro goals
  useEffect(() => {
    async function fetchMacroGoals() {
      try {
        const [response] = await Promise.all([
          fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-goals", {
            headers: {
              Authorization: `Bearer ${loggedUser.token}`,
              "CSRF-Token": csrfToken,
            },
            credentials: "include",
          }),
          new Promise((res) => setTimeout(res, 300)),
        ]);

        if (!response.ok) throw new Error("Failed to fetch macro goals");
        const data = await response.json();
        setMacroGoals(data || {});
      } catch (error) {
        console.error("Error fetching macro goals:", error);
      } finally {
        setLoading(false);
      }
    }

    if (loggedUser?.token && csrfToken) {
      fetchMacroGoals();
    }
  }, [loggedUser, csrfToken]);

  // Always override with MacroCoach macros if available
  useEffect(() => {
    async function fetchTargetMacros() {
      try {
        const res = await fetch(
          `https://galwinapp1-c1d71c579009.herokuapp.com/macrocoach/macros/${loggedUser.userid}`,
          {
            headers: { Authorization: `Bearer ${loggedUser.token}` },
            credentials: "include",
          }
        );

        if (!res.ok) return; // skip if not found or error

        const coach = await res.json();
        setMacroGoals({
          goalProtein: String(coach?.protein ?? ""),
          goalCarbohydrate: String(coach?.carbs ?? ""),
          goalFat: String(coach?.fat ?? ""),
          goalFiber: String(coach?.fiber ?? ""),
        });
        setImportedFromCoach(true);
        console.log("🧩 MacroGoals overridden with MacroCoach macros:", coach);
      } catch (err) {
        console.error("❌ Error fetching MacroCoach macros:", err);
      }
    }

    if (loggedUser?.userid && loggedUser?.token && !loading) {
      fetchTargetMacros();
    }
  }, [loggedUser, loading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMacroGoals((prev) => ({
      ...prev,
      [name]: value.replace(/\D/g, ""),
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      localStorage.setItem("macroGoals", JSON.stringify(macroGoals));

      const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken,
        },
        body: JSON.stringify(macroGoals),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Server error while saving macro goals");
      setMessage({ type: "success-copy", text: "Başarıyla kaydedildi!" });
    } catch (error) {
      console.error("Error submitting macro goals:", error);
      setMessage({ type: "error", text: "Hata oluştu. Lütfen tekrar deneyin." });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const inputs = [
    { label: "Protein", name: "goalProtein", placeholder: "Örn: 100" },
    { label: "Karbonhidrat", name: "goalCarbohydrate", placeholder: "Örn: 300" },
    { label: "Yağ", name: "goalFat", placeholder: "Örn: 80" },
    { label: "Lif", name: "goalFiber", placeholder: "Örn: 25" },
  ];

  const totalKcal =
    (Number(macroGoals.goalProtein) || 0) * 4 +
    (Number(macroGoals.goalCarbohydrate) || 0) * 4 +
    (Number(macroGoals.goalFat) || 0) * 9;

return (
    <section className="container macrogoals-container">
      {loading ? (
        <div className="spinner-container-macrogoals">
          <ClipLoader color={color} loading={loading} size={25} />
        </div>
      ) : (
        <>
          <div className="macrogoals-list">
            <ul className="list-settings">
              {/* Header row */}
              <div className="list-headings" >
                <div>
                  <span>Makro Hedefleri</span>
                  {importedFromCoach && (
                    <div className="coach-note">
                      <small>*Makro koçu önerileri yüklendi !</small>
                    </div>
                  )}
                </div>
                <div className="macro-calories">
                  <span>{totalKcal}</span>
                  <span> kcal</span>
                </div>
              </div>

              {/* Inputs */}
              {inputs.map(({ label, name, placeholder }) => (
                <div className="list-items" key={name}>
                  <li>{label}</li>
                  <div className="macro-input">
                    <input
                      type="text"
                      name={name}
                      value={macroGoals[name] || ""}
                      placeholder={placeholder}
                      onChange={handleChange}
                      inputMode="numeric"
                      disabled={importedFromCoach}
                      style={{
                        backgroundColor: "white",
                        color: importedFromCoach ? "#999" : "inherit",
                        cursor: importedFromCoach ? "not-allowed" : "text",
                      }}
                    />
                    <span>g</span>
                  </div>
                </div>
              ))}
            </ul>
          </div>

          {/* Save button */}
          <div className="macro-btn">
            <button
              onClick={handleSubmit}
              disabled={importedFromCoach}
              style={{
                opacity: importedFromCoach ? 0.6 : 1,
                cursor: importedFromCoach ? "not-allowed" : "pointer",
              }}
            >
              Kaydet
            </button>
          </div>

          {/* Flash message */}
          {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

          
        </>
      )}
      <Footer />
    </section>
  );
}