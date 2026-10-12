import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("rrms_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rrms_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("rrms_user", JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem("rrms_token");
        localStorage.removeItem("rrms_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function persist(token, userData) {
    localStorage.setItem("rrms_token", token);
    localStorage.setItem("rrms_user", JSON.stringify(userData));
    setUser(userData);
  }

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    persist(res.data.token, res.data.user);
    return res.data.user;
  }

  async function adminLogin(email, password) {
    const res = await api.post("/auth/admin/login", { email, password });
    persist(res.data.token, res.data.user);
    return res.data.user;
  }

  async function adminRegister(payload) {
    const res = await api.post("/auth/admin/register", payload);
    persist(res.data.token, res.data.user);
    return res.data.user;
  }

  async function register(payload) {
    const res = await api.post("/auth/register", payload);
    persist(res.data.token, res.data.user);
    return res.data.user;
  }

  function updateUser(userData, token) {
    if (token) localStorage.setItem("rrms_token", token);
    localStorage.setItem("rrms_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("rrms_token");
    localStorage.removeItem("rrms_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, adminRegister, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
