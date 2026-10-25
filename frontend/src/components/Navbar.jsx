import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MENU_ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  ticket: <><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z" /><path d="M13 5v14" strokeDasharray="2 3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  switch: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  logout: <><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
};
function MenuIcon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MENU_ICONS[name]}</svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: "/", label: "Home" },
    { to: "/schedule", label: "Schedule" },
    { to: "/vacant-seats", label: "Vacant Seats" },
    { to: "/train-status", label: "Train Status" },
    { to: "/plan-travel", label: "Plan Travel" },
    { to: "/pnr-status", label: "PNR Status" },
  ];
  // My Bookings / Passengers / Admin Dashboard live in the profile menu (top-right)
  const initials = user ? user.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "";
  const menuItems = user
    ? (user.role === "admin"
        ? [{ to: "/admin", label: "Admin Dashboard", icon: "shield" }, { to: "/profile", label: "My profile", icon: "user" }]
        : [{ to: "/profile", label: "My profile", icon: "user" },
           { to: "/my-bookings", label: "My Bookings", icon: "ticket" },
           { to: "/passengers", label: "Passengers", icon: "users" }])
    : [];

  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "dusk");
  function toggleTheme() {
    const next = theme === "dusk" ? "dark" : "dusk";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rrms_theme", next); } catch (e) { /* ignore */ }
    setTheme(next);
  }

  // "Login" dropdown: Client / Admin, each with Login + Create new account
  const [loginOpen, setLoginOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    function onDown(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setLoginOpen(false); }
    function onKey(e) { if (e.key === "Escape") setLoginOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);
  const loginRows = [
    { label: "Client", login: "/login", signup: "/register" },
    { label: "Admin", login: "/admin-login", signup: "/admin-login?mode=signup" },
  ];

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
            {theme === "dusk" ? "◐ Dark" : "◐ Dusk"}
          </button>
          {user ? (
            <div className="login-menu" ref={menuRef}>
              <button type="button" className="avatar-btn" aria-haspopup="true" aria-expanded={loginOpen}
                onClick={() => setLoginOpen((o) => !o)} title="Account" aria-label="Account menu">
                {initials}
              </button>
              {loginOpen && (
                <div className="profile-pop" role="menu">
                  <div className="profile-head">
                    <div className="avatar-lg">{initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="profile-name">{user.name}{user.role === "admin" ? " (Admin)" : ""}</div>
                      <div className="profile-email">{user.email}</div>
                      <Link to="/profile" className="profile-view" onClick={() => setLoginOpen(false)}>View your profile</Link>
                    </div>
                  </div>
                  <div className="profile-sep" />
                  {menuItems.map((m) => (
                    <Link key={m.to} to={m.to} className="profile-item" role="menuitem" onClick={() => setLoginOpen(false)}>
                      <MenuIcon name={m.icon} />{m.label}
                    </Link>
                  ))}
                  <div className="profile-sep" />
                  <button type="button" className="profile-item" role="menuitem"
                    onClick={() => { setLoginOpen(false); logout(); navigate(user.role === "admin" ? "/admin-login" : "/login"); }}>
                    <MenuIcon name="switch" />Login / switch account
                  </button>
                  <button type="button" className="profile-item" role="menuitem"
                    onClick={() => { setLoginOpen(false); handleLogout(); }}>
                    <MenuIcon name="logout" />Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="login-menu" ref={menuRef}>
              <button type="button" className="btn btn-primary btn-sm" aria-haspopup="true" aria-expanded={loginOpen}
                onClick={() => setLoginOpen((o) => !o)}>
                Login ▾
              </button>
              {loginOpen && (
                <div className="login-pop">
                  {loginRows.map((r) => (
                    <div className="login-row" key={r.label}>
                      <div className="login-row-title">{r.label}</div>
                      <div className="login-row-actions">
                        <Link to={r.login} className="btn btn-primary btn-sm" onClick={() => setLoginOpen(false)}>Login</Link>
                        <Link to={r.signup} className="login-create" onClick={() => setLoginOpen(false)}>Create new account</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)}>☰</button>
        </div>
      </div>
    </header>
  );
}
