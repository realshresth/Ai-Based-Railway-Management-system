import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function WhereIsMyTrain() {
  const [params, setParams] = useSearchParams();
  const [trains, setTrains] = useState([]);
  const [no, setNo] = useState(params.get("train") || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => { api.get("/trains").then((r) => setTrains(r.data)).catch(() => {}); }, []);

  async function load(n) {
    const t = String(n || "").trim();
    if (!t) return;
    setLoading(true); setError("");
    try {
      const r = await api.get(`/live/train/${encodeURIComponent(t)}`);
      setData(r.data);
      setParams({ train: t });
    } catch (e) {
      setData(null);
      setError(e.response?.data?.error || "Could not get the train status.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (params.get("train")) load(params.get("train"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh every minute while a train is shown
  useEffect(() => {
    clearInterval(timer.current);
    if (data) timer.current = setInterval(() => load(data.train_number), 300000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.train_number]);

  const late = data?.delay_min > 0;
  const headline = !data ? "" : data.source === "live"
    ? (data.headline || (late ? `Running ${data.delay_min} min late` : "Running on time"))
    : data.state === "not_started" ? "Not started yet" : data.state === "arrived" ? "Journey completed" : "Running (per timetable)";
  const tone = !data ? "" : data.source !== "live" ? "est" : late ? "late" : "ontime";

  return (
    <div className="container" style={{ padding: "40px 24px 70px", maxWidth: 820 }}>
      <h2>Train Status</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 18 }}>Where is my train? Live position, delay and upcoming stations for any train.</p>

      <form className="wimt-form" onSubmit={(e) => { e.preventDefault(); load(no); }}>
        <input list="train-list" value={no} onChange={(e) => setNo(e.target.value)} placeholder="Train number, e.g. 15031" inputMode="numeric" aria-label="Train number" />
        <datalist id="train-list">
          {trains.map((t) => <option key={t.id} value={t.train_number}>{t.name}</option>)}
        </datalist>
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Checking…" : "Track train"}</button>
      </form>

      {error && <div className="msg-error">{error}</div>}

      {data && (
        <div className="wimt-card">
          <div className="wimt-head">
            <div>
              <span className="train-num">#{data.train_number}</span> <b className="train-name">{data.train_name}</b>
              {data.origin && <div className="wimt-sub">{data.origin} → {data.destination}</div>}
            </div>
            <span className={"wimt-badge " + tone}>{headline}</span>
          </div>
          <div className="wimt-now">
            <div><small>Last / current station</small><b>{data.current_station || "Yet to depart"}{data.current_status ? ` (${data.current_status})` : ""}</b></div>
            <div><small>Next station</small><b>{data.next_station || "-"}</b></div>
            {data.speed_kmh != null && <div><small>Speed</small><b>{Math.round(data.speed_kmh)} km/h</b></div>}
            <div><small>Delay</small><b>{data.source === "live" ? (late ? `${data.delay_min} min` : "On time") : "n/a"}</b></div>
          </div>
          {data.note && <div className="wimt-note">{data.note}</div>}
          {(data.alerts || []).map((a, i) => <div key={i} className="wimt-note">⚠ {a}</div>)}

          <ol className="wimt-line">
            {data.stops.map((s, i) => (
              <li key={i} className={s.status}>
                <i />
                <div>
                  <b>{s.name}</b>
                  <span>{s.scheduled_arr ? `Arr ${s.scheduled_arr}` : ""}{s.scheduled_dep ? ` · Dep ${s.scheduled_dep}` : ""}{s.delay_min > 0 ? ` · +${s.delay_min} min` : ""}{s.platform ? ` · PF ${s.platform}` : ""}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="wimt-foot">{data.source === "live" ? "Live data · RailRadar" : "Estimated from timetable"} · updated {new Date(data.updated_at).toLocaleTimeString()} · refreshes every 5 minutes</div>
        </div>
      )}
    </div>
  );
}
