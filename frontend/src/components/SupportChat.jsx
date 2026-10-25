import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Put your real support contact here. It is shown when someone asks for a human.
const SUPPORT_EMAIL = "support@yourdomain.com";

// Simple built-in helper: matches keywords and replies with steps/links for this site.
const TOPICS = [
  {
    keys: ["pnr", "status", "waiting", "confirm"],
    text: "You can check any PNR without logging in. Enter the 10-digit number on the PNR Status page.",
    link: { to: "/pnr-status", label: "Open PNR Status" },
  },
  {
    keys: ["book", "ticket", "reserve", "seat"],
    text: "To book: open Book Tickets, pick source, destination and date, choose a train and class, add passengers, then confirm. You need to be logged in as a client.",
    link: { to: "/booking", label: "Go to Book Tickets" },
  },
  {
    keys: ["cancel", "refund"],
    text: "Open My Bookings from your profile menu (top right) and click \"Cancel booking\" on the ticket. Seats go back to the pool right away. This is a demo system, so no real money is involved.",
    link: { to: "/my-bookings", label: "Open My Bookings" },
  },
  {
    keys: ["password", "forgot", "reset", "login", "sign in", "signin"],
    text: "Forgot your password? Use the reset page. For logging in, use the Login button at the top right and choose Client or Admin.",
    link: { to: "/forgot-password", label: "Reset password" },
  },
  {
    keys: ["passenger", "traveller", "traveler"],
    text: "Save people you travel with under Passengers (profile menu, top right) so you can add them to bookings in one click.",
    link: { to: "/passengers", label: "Open Passengers" },
  },
  {
    keys: ["schedule", "train", "timing", "time"],
    text: "Search all trains, timings and stops on the Schedule page.",
    link: { to: "/schedule", label: "Open Schedule" },
  },
  {
    keys: ["account", "register", "sign up", "signup", "create"],
    text: "Click Login at the top right, then \"Create new account\" next to Client (or Admin for staff).",
    link: { to: "/register", label: "Create a client account" },
  },
  {
    keys: ["human", "agent", "person", "contact", "call", "email", "support"],
    text: `Our team can help directly. Email us at ${SUPPORT_EMAIL} with your PNR number and a short description of the problem.`,
  },
];

const CHIPS = ["Check PNR status", "How do I book?", "Cancel a ticket", "Forgot password", "Talk to a human"];

function reply(input) {
  const q = input.toLowerCase();
  const hit = TOPICS.find((t) => t.keys.some((k) => q.includes(k)));
  if (hit) return { from: "bot", text: hit.text, link: hit.link };
  return {
    from: "bot",
    text: `I'm not sure about that one. Try one of the quick options below, or email ${SUPPORT_EMAIL} and our team will reply.`,
  };
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([
    { from: "bot", text: "Hi! I'm RailReserve support. Ask me about bookings, PNR status, cancellations or your account." },
  ]);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function send(value) {
    const q = (value ?? text).trim();
    if (!q) return;
    setMsgs((m) => [...m, { from: "me", text: q }, reply(q)]);
    setText("");
  }

  return (
    <>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Support chat">
          <div className="chat-head">
            <div><b>Support chat</b><span>Usually replies instantly</span></div>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>
          <div className="chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"chat-msg " + m.from}>
                {m.text}
                {m.link && <Link to={m.link.to} onClick={() => setOpen(false)}>{m.link.label} →</Link>}
              </div>
            ))}
          </div>
          <div className="chat-chips">
            {CHIPS.map((c) => (
              <button type="button" key={c} className="chat-chip" onClick={() => send(c)}>{c}</button>
            ))}
          </div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" aria-label="Type your question" />
            <button type="submit" className="btn btn-primary btn-sm">Send</button>
          </form>
        </div>
      )}
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"} aria-expanded={open}>
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11h7M8.5 14h4" /></svg>
        )}
      </button>
    </>
  );
}
