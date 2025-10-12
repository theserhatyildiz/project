import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { useContext, useEffect, useState } from "react";

export default function Footer() {
  const { loggedUser, setLoggedUser } = useContext(UserContext);
  const [coachLink, setCoachLink] = useState("/macrocoachform"); // default

  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("app-user");
    setLoggedUser(null);
    navigate("/login");
  }

  useEffect(() => {
    async function fetchSubmissionStatus() {
      if (!loggedUser?.userid) return;

      try {
        const res = await fetch(`https://galwinapp1-c1d71c579009.herokuapp.com/user/${loggedUser.userid}`, {
          headers: {
            Authorization: `Bearer ${loggedUser.token}`,
          },
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("User fetch failed:", res.status);
          return;
        }

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.warn("Response is not JSON");
          return;
        }

        if (data?.hasSubmittedCoachForm) {
          setCoachLink("/macrocoach");
        } else {
          setCoachLink("/macrocoachform");
        }
      } catch (err) {
        console.error("Error checking form submission status", err);
      }
    }

    fetchSubmissionStatus();
  }, [loggedUser]);

  return (
    <div>
      <ul className="footer">
        <Link to="/diet"><li>Diyet</li></Link>
        <Link to="/search"><li>Arama</li></Link>
        <Link to="/dashboard"><li>Özet</li></Link>
        <Link to="/weight"><li>Kilo</li></Link>
        <Link to={coachLink}><li>Koç</li></Link> {/* dynamic route here */}
        <Link to="/more"><li>Diğer</li></Link>
      </ul>
    </div>
  );
}