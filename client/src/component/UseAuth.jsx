import { useEffect, useState, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';

export function useAuth() {
  const [loggedUser, setLoggedUser] = useState(() => {
    const storedUser = localStorage.getItem("app-user");
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (error) {
        console.error("Invalid user data in localStorage:", error);
        return null;
      }
    }
    return null;
  });

  const [csrfToken, setCsrfToken] = useState("");
  const isRefreshingRef = useRef(false);

  // 🔒 Logout user and clear session
  async function logoutUser() {
    console.log('Logout route hit!');
  
    const storedUser = JSON.parse(localStorage.getItem("app-user"));
    const accessToken = storedUser?.token || loggedUser?.token;
  
    try {
      await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "csrf-token": csrfToken,
        },
        credentials: "include",
      });
  
      console.log("User logged out from server.");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("app-user");
      setLoggedUser(null);
      window.location.href = "/login";
    }
  }

  // 🔁 Refresh access token
  async function refreshAccessToken() {
    if (isRefreshingRef.current) {
      console.log('Refresh already in progress — skipping.');
      return;
    }

    isRefreshingRef.current = true;

    try {
      const response = await fetch('https://galwinapp1-c1d71c579009.herokuapp.com/refresh-token', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "csrf-token": csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          const storedUser = localStorage.getItem("app-user");
          const parsedUser = storedUser ? JSON.parse(storedUser) : null;

          if (parsedUser) {
            const updatedUser = { ...parsedUser, token: data.token };
            localStorage.setItem("app-user", JSON.stringify(updatedUser));
            setLoggedUser(updatedUser);
            console.log('Access token refreshed and stored in localStorage.');
          }
        }
      } else if ([400, 401, 403].includes(response.status)) {
        console.warn('Refresh token invalid, missing, or expired. Logging out...');

        // 🔁 Call logout on backend explicitly
        try {
          const logoutRes = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "csrf-token": csrfToken,
              "Authorization": `Bearer ${accessToken}`
            },
            credentials: "include"
          });

          if (logoutRes.ok) {
            console.log("Backend refresh token cleanup successful.");
          } else {
            console.warn("Logout request failed:", logoutRes.status);
          }
        } catch (err) {
          console.error("Error calling logout endpoint:", err);
        }

        logoutUser();
      } else {
        console.error('Failed to refresh access token:', response.statusText);
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      logoutUser();
    } finally {
      isRefreshingRef.current = false;
    }
  }

  // 📛 Fetch CSRF token
  async function fetchCsrfToken() {
    console.log('Fetching CSRF token...');
    try {
      const response = await fetch("https://galwinapp1-c1d71c579009.herokuapp.com/csrf-token", {
        credentials: 'include'
      });

      const data = await response.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        console.log('CSRF Token received:', data.csrfToken);
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
    }
  }

  // 🌱 Restore session if token is still valid or refresh if needed
  async function restoreSession() {
    if (!csrfToken) return;

    const storedUser = localStorage.getItem("app-user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const accessToken = parsedUser?.token;

      if (accessToken) {
        const now = Math.floor(Date.now() / 1000);
        const decodedToken = jwtDecode(accessToken);

        const { exp: accessTokenExp } = decodedToken;
        const accessTokenMinutesLeft = (accessTokenExp - now) / 60;

        if (accessTokenMinutesLeft > 1) {
          setLoggedUser(parsedUser);
          console.log('Session restored');
        } else {
          console.log('Access token expired. Refreshing...');
          await refreshAccessToken();
        }
      }
    }
  }

  // 📦 Effects
  useEffect(() => {
    fetchCsrfToken();
  }, []);

  useEffect(() => {
    if (csrfToken) {
      restoreSession();
    }
  }, [csrfToken]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const storedUser = localStorage.getItem("app-user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const accessToken = parsedUser?.token;

        if (accessToken) {
          const now = Math.floor(Date.now() / 1000);
          const { exp: accessTokenExp } = jwtDecode(accessToken);
          const accessTokenMinutesLeft = (accessTokenExp - now) / 60;

          if (accessTokenMinutesLeft <= 1) {
            console.log('Access token is about to expire. Refreshing...');
            await refreshAccessToken();
          }
        }
      }
    }, 60 * 1000); // every 1 min

    return () => clearInterval(interval);
  }, [csrfToken]);

  return { loggedUser, setLoggedUser, csrfToken, logoutUser };
}