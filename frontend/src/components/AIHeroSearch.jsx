import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Lightweight heuristic parser — no external LLM call, just pattern matching
 * against the known station list. Understands:
 *   "from Lucknow to Mumbai", "fastest train to Mumbai", "cheapest trains",
 *   "trains under ₹1,000", "tomorrow", "today".
 * Swap parseQuery() for a real LLM call later for true free-form understanding.
 */
function parseQuery(text, stations) {
  const q = text.toLowerCase();

  const found = [];
  for (const s of stations) {
    const names = [s.name, s.city, s.code].filter(Boolean).map((n) => n.toLowerCase());
    for (const n of names) {
      // whole-word match so short codes like "ndls" don't hit random words
      const m = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).exec(q);
      if (m) { found.push({ station: s, idx: m.index + m[1].length }); break; }
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  const uniq = [];
  for (const f of found) if (!uniq.some((u) => u.station.id === f.station.id)) uniq.push(f);

  let from, to;
  if (uniq.length >= 2) {
    // an explicit "to X" decides the destination, otherwise first mention = origin
    const toIdx = q.search(/\bto\b/);
    from = uniq[0].station; to = uniq[1].station;
    if (toIdx !== -1 && uniq[0].idx > toIdx) { from = uniq[1].station; to = uniq[0].station; }
  } else if (uniq.length === 1) {
    const st = uniq[0];
    const before = q.slice(0, st.idx);
    if (/\bfrom\s+$/.test(before) || /\bleaving\s+$/.test(before)) from = st.station;
    else to = st.station; // "train to Mumbai", "trains for Mumbai", or just "Mumbai"
  }

  let date = "";
  const today = new Date();
  if (q.includes("tomorrow")) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
  } else if (q.includes("today") || q.includes("tonight")) {
    date = today.toISOString().slice(0, 10);
  }

  let maxFare = null;
  const fm = /(?:under|below|less than|within|upto|up to|max(?:imum)?|<)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k)?/.exec(q)
    || /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:or less|max|and under)/.exec(q);
  if (fm) maxFare = Math.round(parseFloat(fm[1].replace(/,/g, "")) * (fm[2] ? 1000 : 1));

  let sort = "";
  if (/fastest|quickest|shortest/.test(q)) sort = "fastest";
  else if (/cheapest|lowest fare|least expensive|budget/.test(q)) sort = "cheapest";

  return { from, to, date, maxFare, sort };
}

const EXAMPLES = [
  "Find the fastest train to Mumbai",
  "Show trains under ₹1,000",
  "Cheapest train from Lucknow to New Delhi",
  "Trains from Mumbai to Chennai tomorrow",
];

export default function AIHeroSearch({ stations }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function run(value) {
    const q = (value ?? text).trim();
    if (!q) return;
    const { from, to, date, maxFare, sort } = parseQuery(q, stations);
    if (!from && !to && !maxFare && !sort) {
      setError("Couldn't find a station or filter in that. Try \"fastest train to Mumbai\" or \"trains under ₹1,000\".");
      return;
    }
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from.code);
    if (to) params.set("to", to.code);
    if (date) params.set("date", date);
    if (sort) params.set("sort", sort);
    if (maxFare) params.set("maxFare", String(maxFare));
    navigate(`/booking?${params.toString()}`);
  }

  return (
    <div className="ai-search">
      <form onSubmit={(e) => { e.preventDefault(); run(); }}>
        <span className="ai-search-badge">AI Search</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask: fastest train from Lucknow to Mumbai tomorrow evening"
          aria-label="Describe your trip"
        />
        <button className="btn btn-primary btn-sm" type="submit">✦ AI Search</button>
      </form>
      <div className="ai-chips" role="group" aria-label="Example searches">
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex} className="ai-chip" onClick={() => { setText(ex); run(ex); }}>{ex}</button>
        ))}
      </div>
      {error && <div className="ai-search-error">{error}</div>}
    </div>
  );
}
