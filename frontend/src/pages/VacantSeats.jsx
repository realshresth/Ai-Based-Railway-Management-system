import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

function SeatMap({ trainId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [cls, setCls] = useState(null);
  const [pick, setPick] = useState(null);

  useEffect(() => {
    api.get("/seats/map", { params: { train_id: trainId } })
      .then((r) => { setData(r.data); setCls(r.data.classes[0]?.class_code || null); })
      .catch(() => setErr("Could not load the seat map."));
  }, [trainId]);

  if (err) return <div className="msg-error">{err}</div>;
  if (!data) return <p>Loading seat map…</p>;
  const c = data.classes.find((x) => x.class_code === cls);

  return (
    <div className="seatmap">
      {data.stops.length > 0 && (
        <div className="route-strip">
          {data.stops.map((st, i) => (
            <span key={st.stop_number}>
              {i > 0 && <i>→</i>}
              <b className={i === 0 ? "start" : i === data.stops.length - 1 ? "end" : ""}>{st.station_name}</b>
            </span>
          ))}
        </div>
      )}
      <div className="seat-tabs">
        {data.classes.map((x) => (
          <button type="button" key={x.class_code} className={x.class_code === cls ? "on" : ""} onClick={() => { setCls(x.class_code); setPick(null); }}>
            {x.class_code} · {x.vacant} vacant
          </button>
        ))}
      </div>
      {c && (
        <>
          <div className="seat-legend"><span><i className="free" /> Vacant</span><span><i className="booked" /> Booked</span><span><i className="sel" /> Selected</span></div>
          {c.coaches.map((k) => (
            <div className="coach-block" key={k.coach_number}>
              <div className="coach-title"><b>Coach {k.coach_number}</b><span>{k.vacant} of {k.seats} vacant</span></div>
              <div className="seat-grid">
                {c.seats.filter((st) => st.coach === k.coach_number).map((st) => (
                  <button type="button" key={st.no} title={`${k.coach_number}/${st.pos} · ${st.berth}`}
                    className={"seat " + st.status + (pick?.no === st.no ? " sel" : "")} onClick={() => setPick(st)}>
                    <b>{st.pos}</b><small>{st.berth.replace("Side ", "S-").slice(0, 3)}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="seat-detail">
            {!pick ? "Tap a seat to see its berth and where the passenger boards." : pick.status === "free" ? (
              <><b>Coach {pick.coach} · seat {pick.pos}</b> ({pick.label}) · {pick.berth} berth · <span className="ok">Vacant</span>. Book it now to board at {data.train.source_name}.</>
            ) : (
              <><b>Coach {pick.coach} · seat {pick.pos}</b> ({pick.label}) · {pick.berth} berth · <span className="bad">Booked</span><br />
                Passenger boards at <b>{pick.boards_at}</b> and gets off at <b>{pick.gets_off_at}</b>
                {pick.journey_date ? <> · journey date {String(pick.journey_date).slice(0, 10)}</> : null}.</>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function VacantSeats() {
  const [openId, setOpenId] = useState(null);
  const [trains, setTrains] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/seats/vacant").then((r) => setTrains(r.data)).catch(() => setError("Could not load seat availability."));
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!trains) return [];
    if (!t) return trains;
    return trains.filter((x) => `${x.train_number} ${x.name} ${x.source_name} ${x.destination_name}`.toLowerCase().includes(t));
  }, [trains, q]);

  return (
    <div className="container" style={{ padding: "40px 24px 70px" }}>
      <h2>Rail Vacant Seats</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 18 }}>
        Live seat availability for every train, with a berth-type breakdown (Lower, Middle, Upper, Side Lower, Side Upper).
      </p>
      <div className="field" style={{ maxWidth: 380, marginBottom: 22 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by train number, name or station"
          style={{ padding: 11, border: "1.5px solid var(--line)", borderRadius: 8, width: "100%" }} aria-label="Search trains" />
      </div>
      {error && <div className="msg-error">{error}</div>}
      {!trains && !error && <p>Loading…</p>}
      {trains && shown.length === 0 && <div className="empty-state"><h4>No trains found</h4></div>}

      {shown.map((t) => (
        <div className="train-card vacant-card" key={t.id} style={{ flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, width: "100%" }}>
            <div>
              <span className="train-num">#{t.train_number}</span> <span className="train-name">{t.name}</span>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                {t.source_name} {t.departure_time?.slice(0, 5)} → {t.destination_name} {t.arrival_time?.slice(0, 5)} · {t.duration}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
                {openId === t.id ? "Hide seat map" : "View seat map"}
              </button>
              <Link className="btn btn-primary btn-sm" to={`/booking?from=${t.source_code}&to=${t.destination_code}`}>Book</Link>
            </div>
          </div>
          <div className="vac-grid">
            {t.classes.map((c) => {
              const pct = c.total ? Math.round(((c.total - c.vacant) / c.total) * 100) : 100;
              const tone = c.vacant === 0 ? "full" : c.vacant < c.total * 0.15 ? "low" : "ok";
              return (
                <div className="vac-class" key={c.class_code}>
                  <div className="vac-top">
                    <b>{c.class_code}</b><span>{c.class_name}</span>
                    <em className={"vac-num " + tone}>{c.vacant === 0 ? "Full" : `${c.vacant} vacant`}</em>
                  </div>
                  <div className="vac-bar"><i className={tone} style={{ width: pct + "%" }} /></div>
                  <div className="vac-meta">{c.vacant} of {c.total} free · ₹{c.fare.toLocaleString("en-IN")}</div>
                  <div className="vac-berths">
                    {Object.entries(c.berths).map(([b, n]) => (
                      <span key={b} className={n === 0 ? "none" : ""}>{b}: <b>{n}</b></span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {openId === t.id && <SeatMap trainId={t.id} />}
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 14 }}>Counts show current availability for the train and are not specific to a journey date.</p>
    </div>
  );
}
