import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Lightweight heuristic parser — no external LLM call, just pattern
 * matching against the known station list. Good enough to turn
 * "fastest train from Lucknow to Mumbai tomorrow evening" into a real
 * search, without wiring in a paid AI API. Swap parseQuery() for a real
 * LLM call later if you want true free-form understanding.
 */
function parseQuery(text, stations) {
  const q = text.toLowerCase();

  const matches = [];
  for (const s of stations) {
    const names = [s.name.toLowerCase(), s.city.toLowerCase(), s.code.toLowerCase()];
    for (const n of names) {
      const idx = q.indexOf(n);
      if (idx !== -1) { matches.push({ station: s, idx }); break; }
    }
  }
  matches.sort((a, b) => a.idx - b.idx);
  const unique = [];
  for (const m of matches) {
    if (!unique.some((u) => u.station.id === m.station.id)) unique.push(m);
  }

  const from = unique[0]?.station;
  const to = unique[1]?.station;

  let date = "";
  const today = new Date();
  if (q.includes("tomorrow")) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
  } else if (q.includes("today") || q.includes("tonight")) {
    date = today.toISOString().slice(0, 10);
  }

  const fastest = /fastest|quickest|shortest/.test(q);

  return { from, to, date, fastest };
}

export default function AIHeroSearch({ stations }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const { from, to, date, fastest } = parseQuery(text, stations);
    if (!from || !to) {
      setError("Couldn't spot two station names in that — try mentioning both, e.g. \"Lucknow to Mumbai\".");
      return;
    }
    setError("");
    const params = new URLSearchParams({ from: from.code, to: to.code });
    if (date) params.set("date", date);
    if (fastest) params.set("sort", "fastest");
    navigate(`/booking?${params.toString()}`);
  }

  return (
    <div className="ai-search">
      <form onSubmit={handleSubmit}>
        <span className="ai-search-badge">AI Search</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask: fastest train from Lucknow to Mumbai tomorrow evening"
        />
        <button className="btn btn-primary btn-sm" type="submit">✦ AI Search</button>
      </form>
      {error && <div className="ai-search-error">{error}</div>}
    </div>
  );
}
