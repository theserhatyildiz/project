import { UserContext } from "../../../../context/UserContext";
import { useContext, useState, useEffect } from "react";
import Footer from "../../../Footer";
import ClipLoader from "react-spinners/ClipLoader";

export default function MacroGoals() {
  const { loggedUser } = useContext(UserContext);
  const [macroGoals, setMacroGoals] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [csrfToken, setCsrfToken] = useState("");

  // Fetch CSRF token on mount
  useEffect(() => {
    async function fetchCsrfToken() {
      console.log('Fetching CSRF token...');
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
            "CSRF-Token": csrfToken
          },
          credentials: 'include'
        });
  
        const text = await response.text(); // get raw response text
        console.log("Raw response text:", text); // debug output
  
        if (!response.ok) throw new Error(`Failed to fetch macro goals: ${response.status}`);
  
        try {
          const data = JSON.parse(text); // attempt to parse JSON
          setMacroGoals(data);
        } catch (parseError) {
          console.error("Failed to parse response as JSON:", parseError);
        }
  
      } catch (error) {
        console.error("Error fetching macro goals:", error);
      }
    }
  
    if (loggedUser?.token) {
      fetchMacroGoals();
    }
  }, [loggedUser, csrfToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMacroGoals(prev => ({
      ...prev,
      [name]: value.replace(/\D/g, '') // allow only digits
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      localStorage.setItem('macroGoals', JSON.stringify(macroGoals));

      const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/macro-goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${loggedUser.token}`,
          "CSRF-Token": csrfToken // Include CSRF token in headers
        },
        body: JSON.stringify(macroGoals),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error("Server error while saving macro goals");
      }

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
    { label: 'Protein', name: 'goalProtein', placeholder: 'Örn: 100' },
    { label: 'Karbonhidrat', name: 'goalCarbohydrate', placeholder: 'Örn: 300' },
    { label: 'Yağ', name: 'goalFat', placeholder: 'Örn: 80' },
    { label: 'Lif', name: 'goalFiber', placeholder: 'Örn: 25' }
  ];

  return (
    <section className="container macrogoals-container">
      <div className="macrogoals-list">
        <ul className="list-settings">
          <div className="list-headings">
            <div><span>Makro Hedefleri Girin</span></div>
            <div className="macro-calories">
              <span>
              {
              macroGoals?.goalProtein && macroGoals?.goalCarbohydrate && macroGoals?.goalFat
                ? (
                    Number(macroGoals.goalProtein) * 4 +
                    Number(macroGoals.goalCarbohydrate) * 4 +
                    Number(macroGoals.goalFat) * 9
                  )
                : 0
            }
                </span>
                
                <span> kcal</span> {/* Optional: calculate dynamically */}
            </div>
          </div>

          {inputs.map(({ label, name, placeholder }) => (
            <div className="list-items" key={name}>
              <li>{label}</li>
              <div className="macro-input">
                <input
                  type="text"
                  name={name}
                  value={macroGoals[name] || ''}
                  placeholder={placeholder}
                  onChange={handleChange}
                  inputMode="numeric"
                />
                <span>g</span>
              </div>
            </div>
          ))}
        </ul>

       
      </div>

      <div className="macro-btn">
          <button onClick={handleSubmit}>Kaydet</button>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

      {/* Display the saved macro goals in the required format */}
      {/* {macroGoals && (
        <p className="macro-summary">
          Hedef Makrolar: 
          {macroGoals.goalProtein ? ` ${macroGoals.goalProtein}p,` : ""}
          {macroGoals.goalCarbohydrate ? ` ${macroGoals.goalCarbohydrate}k,` : ""}
          {macroGoals.goalFat ? ` ${macroGoals.goalFat}f,` : ""}
          {macroGoals.goalFiber ? ` ${macroGoals.goalFiber}lif` : ""}
        </p>
      )} */}

      <Footer />
    </section>
  );
}