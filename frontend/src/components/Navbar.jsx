import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: "/", label: "Home" },
    { to: "/schedule", label: "Schedule" },
    { to: "/booking", label: "Book Tickets" },
    { to: "/plan-travel", label: "Plan Travel" },
    { to: "/pnr-status", label: "PNR Status" },
  ];
  if (user && user.role === "user") {
    links.push({ to: "/my-bookings", label: "My Bookings" });
    links.push({ to: "/passengers", label: "Passengers" });
  }
  if (user && user.role === "admin") {
    links.push({ to: "/admin", label: "Admin Dashboard" });
  }

  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "dusk");
  function toggleTheme() {
    const next = theme === "dusk" ? "classic" : "dusk";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rrms_theme", next); } catch (e) { /* ignore */ }
    setTheme(next);
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          <div className="brand-mark">RR</div>
          Rail<span>Reserve</span>
        </NavLink>

        <nav className={"nav-links" + (open ? " open" : "")} onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-right">
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Switch colour theme">
            {theme === "dusk" ? "◐ Classic" : "◐ Dusk"}
          </button>
          {user ? (
            <>
              <NavLink to="/profile" style={{ color: "var(--on-navy)", fontSize: 13.5, textDecoration: "none" }} title="My profile">
                👤 {user.name.split(" ")[0]} {user.role === "admin" ? "(Admin)" : ""}
              </NavLink>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/admin-login" className="btn btn-ghost btn-sm">Admin</NavLink>
              <NavLink to="/login" className="btn btn-primary btn-sm">Client</NavLink>
            </>
          )}
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)}>☰</button>
        </div>
      </div>
    </header>
  );
}
