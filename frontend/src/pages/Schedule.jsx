import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import TrainThumb from "../components/TrainThumb";

export default function Schedule() {
  const [trains, setTrains] = useState([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [stopsCache, setStopsCache] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trains").then((res) => setTrains(res.data)).finally(() => setLoading(false));
  }, []);

  async function toggleExpand(train) {
    if (expanded === train.id) {
      setExpanded(null);
      return;
    }
    setExpanded(train.id);
    if (!stopsCache[train.id]) {
      const res = await api.get(`/routes/train/${train.id}`);
      setStopsCache((prev) => ({ ...prev, [train.id]: res.data }));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trains;
    return trains.filter(
      (t) => t.train_number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [trains, query]);

  return (
    <div className="container" style={{ padding: "40px 24px 60px" }}>
      <h2>Train Schedule</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        Complete timetable across the network — departure/arrival times, running days, live fares and every intermediate stop.
      </p>

      <div style={{ position: "relative", maxWidth: 420, marginBottom: 28 }}>
        <input
          placeholder="Search by train number or name — e.g. 12430 or Rajdhani"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 14 }}
        />
      </div>

      {loading && <p>Loading schedule…</p>}
      {!loading && filtered.length === 0 && (
        <div className="empty-state"><h4>No trains match "{query}"</h4><p>Try a train number like 12430 or part of its name.</p></div>
      )}

      {filtered.map((t) => (
        <div className="train-card" key={t.id} style={{ flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <TrainThumb trainNumber={t.train_number} name={t.name} />
              <div>
                <span className="train-num">#{t.train_number}</span>{" "}
                <span className="train-name">{t.name}</span>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>Runs: {t.days_of_operation}</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => toggleExpand(t)}>
              {expanded === t.id ? "Hide stops" : "View route"}
            </button>
          </div>

          <div className="route-line" style={{ width: "100%" }}>
            <div className="route-point"><b>{t.departure_time?.slice(0,5)}</b><span>{t.source_name}</span></div>
            <div className="route-track" />
            <div className="route-point"><b>{t.arrival_time?.slice(0,5)}</b><span>{t.destination_name}</span></div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", minWidth: 70, textAlign: "right" }}>{t.duration}</div>
          </div>

          {t.classes?.length > 0 && (
            <div className="class-row" style={{ width: "100%" }}>
              {t.classes.map((c) => {
                const left = c.total_seats - c.booked_seats;
                const availClass = left <= 0 ? "avail-full" : left < c.total_seats * 0.15 ? "avail-low" : "avail-ok";
                return (
                  <div key={c.id} className="class-chip" style={{ cursor: "default" }}>
                    <b>{c.class_code}</b>
                    ₹{c.fare}
                    <div className={availClass} style={{ fontSize: 11, marginTop: 2 }}>
                      {left <= 0 ? "Full" : `${left} left`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expanded === t.id && (
            <div style={{ width: "100%", marginTop: 18, borderTop: "1px dashed var(--line)", paddingTop: 16 }}>
              {!stopsCache[t.id] ? (
                <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>Loading stops…</p>
              ) : (
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr><th>#</th><th>Station</th><th>Arrival (min)</th><th>Departure (min)</th></tr>
                  </thead>
                  <tbody>
                    {stopsCache[t.id].map((s) => (
                      <tr key={s.id}>
                        <td>{s.stop_number}</td>
                        <td>{s.station_name} ({s.station_code})</td>
                        <td>{s.arrival_offset_min === 0 ? "Origin" : `+${s.arrival_offset_min}`}</td>
                        <td>{s.departure_offset_min === 0 ? "Origin" : `+${s.departure_offset_min}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
