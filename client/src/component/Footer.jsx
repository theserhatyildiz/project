import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { useContext, useEffect, useState } from "react";

export default function Footer() {
  // Get user context
  const { loggedUser, setLoggedUser } = useContext(UserContext);

  // Default MacroCoach route
  const [coachLink, setCoachLink] = useState("/macrocoachform");

  // Control visibility of install banner
  const [showBanner, setShowBanner] = useState(false);

  // Platform detection: 'ios', 'android', or null
  const [platform, setPlatform] = useState(null);

  const navigate = useNavigate();

  // 🚪 Logout logic
  function logout() {
    localStorage.removeItem("app-user");
    setLoggedUser(null);
    navigate("/login");
  }

  // 🧠 Fetch MacroCoach form submission status to determine correct navigation link
  useEffect(() => {
    async function fetchSubmissionStatus() {
      if (!loggedUser?.userid) return;

      try {
        const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/user/${loggedUser.userid}`, {
          headers: { Authorization: `Bearer ${loggedUser.token}` },
          credentials: "include",
        });

        if (!res.ok) return console.warn("User fetch failed:", res.status);

        const text = await res.text();
        const data = JSON.parse(text || "{}");

        // Set route based on submission
        setCoachLink(data?.hasSubmittedCoachForm ? "/macrocoach" : "/macrocoachform");
      } catch (err) {
        console.error("Error checking form submission status", err);
      }
    }

    fetchSubmissionStatus();
  }, [loggedUser]);

  // 📲 Detect whether user is on iOS or Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios");
    } else if (/android/.test(userAgent)) {
      setPlatform("android");
    } else {
      setPlatform(null); // not mobile or unsupported platform
    }
  }, []);

  // 📆 Show the banner once per day if app is not installed and platform is known
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    // Don't show if already installed or not iOS/Android
    if (isStandalone || !platform) return;

    const lastDismissed = localStorage.getItem("installBannerDismissed");
    const lastDate = lastDismissed ? new Date(lastDismissed).toDateString() : null;
    const today = new Date().toDateString();

    // Only show if it hasn't been dismissed today
    if (lastDate !== today) {
      setShowBanner(true);
    }
  }, [platform]);

  // ❌ Close and dismiss banner for today
  const handleBannerClose = () => {
    localStorage.setItem("installBannerDismissed", new Date().toISOString());
    setShowBanner(false);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* 📲 Show Install Banner (only for iOS and Android) */}
      {showBanner && (
        <div className="install-banner">
          {/* 🍎 iOS version (your custom message preserved) */}
          {platform === "ios" && (
            <>
              <div>
                📲 <strong>App'i yükle!</strong>
                <br />
                <span style={{ fontSize: "0.90rem" }}>
                  (...) →
                  <img
                    src="images/share-icon.png"
                    style={{
                      width: "30px",
                      height: "30px",
                      verticalAlign: "bottom",
                      marginLeft: "4px",
                    }}
                  />{" "}
                  → Aşağı Kaydır → Ana Ekrana Ekle
                </span>
                <br />
              </div>
              <button
                onClick={handleBannerClose}
                style={{
                  fontSize: "1rem",
                  color: "white",
                  fontWeight: "bold",
                  marginLeft: "1rem",
                }}
              >
                ✕
              </button>
            </>
          )}

          {/* 🤖 Android version */}
          {platform === "android" && (
            <>
              <div>
                📲 <strong>App'i yükle!</strong>
                <br />
                <span style={{ fontSize: "0.90rem" }}>
                  Tarayıcı menüsünden <em>“Ana ekrana ekle”</em> seçeneğine dokun.
                </span>
                <br />
              </div>
              <button
                onClick={handleBannerClose}
                style={{
                  fontSize: "1rem",
                  color: "white",
                  fontWeight: "bold",
                  marginLeft: "1rem",
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}

      {/* 🚀 Footer Navigation Menu */}
      <ul className="footer">
        <Link to="/diet"><li>Diyet</li></Link>
        <Link to="/search"><li>Arama</li></Link>
        <Link to="/dashboard"><li>Özet</li></Link>
        <Link to="/weight"><li>Kilo</li></Link>
        <Link to={coachLink}><li>Koç</li></Link>
        <Link to="/more"><li>Diğer</li></Link>
      </ul>
    </div>
  );
}