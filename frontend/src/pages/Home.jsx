import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import RailScene from "../components/RailScene";
import ServiceCard from "../components/ServiceCard";
import AIHeroSearch from "../components/AIHeroSearch";
import DestThumb from "../components/DestThumb";

const SERVICES = [
  { icon: "🔍", title: "Train Search", desc: "Search across stations by route and date to find every train option instantly.", to: "/booking" },
  { icon: "🗓️", title: "Train Schedule", desc: "View full timetables, intermediate stops and journey duration for any train.", to: "/schedule" },
  { icon: "🎫", title: "Online Ticket Booking", desc: "Reserve seats across Sleeper, 3A, 2A and 1A classes in a few clicks.", to: "/booking" },
  { icon: "🔢", title: "PNR Generation", desc: "Every confirmed booking gets a unique, trackable PNR number automatically.", to: "/pnr-status" },
  { icon: "📋", title: "Booking Management", desc: "View, download or cancel any of your bookings from one dashboard.", to: "/my-bookings" },
  { icon: "🧑‍🤝‍🧑", title: "Passenger Management", desc: "Save passenger details once and reuse them across future bookings.", to: "/passengers" },
  { icon: "💰", title: "Fare Calculation", desc: "Transparent, class-wise fares calculated live from real seat pricing.", to: "/booking" },
  { icon: "🏢", title: "Station Management", desc: "A structured station directory covering major cities across India.", to: "/schedule" },
  { icon: "🛤️", title: "Route Management", desc: "Detailed route mapping with every intermediate halt along the line.", to: "/schedule" },
  { icon: "👥", title: "User Management", desc: "Role-based accounts for passengers and railway staff administrators.", to: "/login" },
];

const WHY = [
  { icon: "⚡", title: "Instant Booking", body: "Search, select and confirm your ticket in under a minute." },
  { icon: "🔒", title: "Secure Payments", body: "Authenticated sessions and encrypted credentials, end to end." },
  { icon: "📡", title: "Live PNR Status", body: "Check confirmation status anytime, no login required." },
  { icon: "🎧", title: "24×7 Support", body: "Manage, modify or cancel your booking whenever you need to." },
];

export default function Home() {
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({ from: "", to: "", date: "" });
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/stations").then((res) => setStations(res.data)).catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!form.from || !form.to || form.from === form.to) return;
    const params = new URLSearchParams(form).toString();
    navigate(`/booking?${params}`);
  }

  return (
    <>
      <section className="hero">
        <RailScene />
        <div className="container hero-inner">
          <AIHeroSearch stations={stations} />
          <div className="hero-eyebrow">India · Trains · Real-time seats</div>
          <h1>
            Your Journey <span>Starts Here</span>
          </h1>
          <p className="lead">
            Search trains, compare classes and fares, and book your seat in
            minutes — with instant PNR generation and live booking management.
          </p>
        </div>
      </section>

      <div className="container">
        <form className="search-card" onSubmit={handleSearch}>
          <div className="search-grid">
            <div className="swap-group">
            <div className="field">
              <label>From Station</label>
              <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to === e.target.value ? "" : form.to })} required>
                <option value="">Select origin</option>
                {stations.filter((s) => s.code !== form.to).map((s) => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <button type="button" className="swap-btn" aria-label="Swap stations" title="Swap stations"
              onClick={() => setForm({ ...form, from: form.to, to: form.from })}>⇄</button>
            <div className="field">
              <label>To Station</label>
              <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value, from: form.from === e.target.value ? "" : form.from })} required>
                <option value="">Select destination</option>
                {stations.filter((s) => s.code !== form.from).map((s) => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            </div>
            <div className="field">
              <label>Journey Date</label>
              <input type="date" min={new Date().toISOString().slice(0, 10)}
                value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Search Trains</button>
          </div>
        </form>
      </div>

      <section className="section container">
        <div className="section-head">
          <h2>Popular Destinations</h2>
          <p>Frequently travelled routes across the network.</p>
        </div>
        <div className="grid-4">
          {[
            ["lucknow-newdelhi", "Lucknow → New Delhi", "8h 30m · Rajdhani route"],
            ["mumbai-chennai", "Mumbai → Chennai", "21h 15m · Coastal route"],
            ["patna-kolkata", "Patna → Kolkata", "7h 45m · Ganga route"],
            ["chennai-bengaluru", "Chennai → Bengaluru", "5h 30m · Southern route"],
          ].map(([slug, title, sub]) => (
            <DestThumb key={slug} slug={slug} title={title} sub={sub} />
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Our Services</h2>
          <p>Everything you need to plan, book and manage rail travel, in one platform.</p>
        </div>
        <div className="grid-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.title} icon={s.icon} title={s.title} description={s.desc} to={s.to} />
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Why Choose RailReserve</h2>
          <p>Built for speed, transparency and control over your own bookings.</p>
        </div>
        <div className="why-row">
          {WHY.map((w) => (
            <div className="why-item" key={w.title}>
              <div className="icon">{w.icon}</div>
              <h4 style={{ fontSize: 15.5, marginBottom: 6 }}>{w.title}</h4>
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="cta">
          <h2>Ready to plan your next journey?</h2>
          <p>Book Your Journey. Travel With Confidence.</p>
          <button className="btn btn-primary" onClick={() => navigate("/booking")}>
            Search Trains Now
          </button>
        </div>
      </section>
    </>
  );
}
