// Dependency-free PDF e-ticket / invoice. Uses the built-in Helvetica + Courier fonts,
// so it needs no library and works offline. (Standard PDF fonts have no rupee sign, so "Rs." is used.)

const W = 595.28, H = 841.89, M = 40;

// Helvetica glyph widths for ASCII 32..126 (units of 1/1000 em)
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];

function clean(t) {
  return String(t ?? "")
    .replace(/₹/g, "Rs. ").replace(/→/g, "->").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "?");
}
const esc = (t) => clean(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function width(text, size, font = "F1") {
  const k = font === "F2" ? 1.06 : 1;
  if (font === "F3" || font === "F4") return clean(text).length * 0.6 * size;
  return clean(text).split("").reduce((w, c) => w + (HW[c.charCodeAt(0) - 32] || 556), 0) * size / 1000 * k;
}
const col = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");

class Page {
  constructor() { this.ops = []; }
  rect(x, y, w, h, fill) { this.ops.push(`${col(fill)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  line(x1, y1, x2, y2, stroke = "#D5DAE5", lw = 0.6) { this.ops.push(`${col(stroke)} RG ${lw} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`); }
  text(x, y, str, { size = 10, font = "F1", color = "#1C2230", align = "left" } = {}) {
    const w = width(str, size, font);
    const px = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.ops.push(`BT ${col(color)} rg /${font} ${size} Tf ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc(str)}) Tj ET`);
  }
}

function assemble(page) {
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> >>`);
  const stream = page.ops.join("\n");
  add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  for (const f of ["Helvetica", "Helvetica-Bold", "Courier", "Courier-Bold"]) {
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
  }
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { out += `${String(o).padStart(10, "0")} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GENDER = { M: "Male", F: "Female", O: "Other" };

/**
 * booking: { pnr, train_number, train_name, source_name, destination_name, journey_date, class_code,
 *            upgraded_from, total_fare, status, created_at, payment_method, payment_status, transaction_id,
 *            passengers: [{ name, age, gender, seat_number, berth_type, coach, coach_seat }] }
 * opts: { upiId, brand }
 */
export function buildTicketPdf(b, opts = {}) {
  const brand = opts.brand || "RailReserve";
  const p = new Page();
  const NAVY = "#0D1C42", ACCENT = "#2F5BC2", INK = "#1C2230", SOFT = "#5F6577", LIGHT = "#EEF2FB", LINE = "#D5DAE5";
  const pax = b.passengers || [];
  const n = pax.length || 1;
  const fare = Number(b.total_fare || 0);
  const online = b.payment_method === "online";
  const status = b.status || "-";

  // ---- header band
  p.rect(0, H - 96, W, 96, NAVY);
  p.rect(0, H - 100, W, 4, ACCENT);
  p.text(M, H - 46, brand, { size: 24, font: "F2", color: "#FFFFFF" });
  p.text(M, H - 66, "E-TICKET  &  PAYMENT RECEIPT", { size: 9.5, color: "#AFC0EA" });
  p.text(W - M, H - 38, "PNR NUMBER", { size: 8.5, color: "#AFC0EA", align: "right" });
  p.text(W - M, H - 62, b.pnr || "-", { size: 22, font: "F4", color: "#FFFFFF", align: "right" });
  p.text(W - M, H - 82, `Booking status: ${status}`, { size: 9.5, font: "F2", color: "#FFFFFF", align: "right" });

  let y = H - 130;
  const section = (title) => {
    p.text(M, y, title.toUpperCase(), { size: 9, font: "F2", color: ACCENT });
    p.line(M, y - 6, W - M, y - 6, LINE, 0.8);
    y -= 24;
  };
  const kv = (x, label, value, wmax = 230) => {
    p.text(x, y, label.toUpperCase(), { size: 7.5, color: SOFT });
    let v = clean(value || "-");
    while (width(v, 10.5, "F2") > wmax && v.length > 4) v = v.slice(0, -2);
    p.text(x, y - 13, v === clean(value || "-") ? v : v + "...", { size: 10.5, font: "F2", color: INK });
  };

  // ---- journey
  section("Journey details");
  kv(M, "Train", `#${b.train_number || ""} ${b.train_name || ""}`);
  kv(M + 270, "Route", `${b.source_name || "-"} -> ${b.destination_name || "-"}`, 245);
  y -= 38;
  kv(M, "Journey date", b.journey_date);
  kv(M + 270, "Class", b.upgraded_from ? `${b.class_code} (upgraded from ${b.upgraded_from})` : b.class_code);
  y -= 38;
  kv(M, "Booked on", (b.created_at ? String(b.created_at).replace("T", " ").slice(0, 16) : "-"));
  kv(M + 270, "Passengers", String(pax.length));
  y -= 40;

  // ---- passengers table
  section("Passengers");
  const cols = [M + 6, M + 30, M + 245, M + 330, M + 410];
  p.rect(M, y - 6, W - 2 * M, 20, LIGHT);
  ["#", "Name", "Age / Gender", "Coach / Seat", "Berth"].forEach((h, i) => p.text(cols[i], y, h.toUpperCase(), { size: 7.5, font: "F2", color: SOFT }));
  y -= 22;
  pax.forEach((q, i) => {
    p.text(cols[0], y, String(i + 1), { size: 10 });
    p.text(cols[1], y, q.name || "-", { size: 10, font: "F2" });
    p.text(cols[2], y, `${q.age ?? "-"} / ${GENDER[q.gender] || q.gender || "-"}`, { size: 10 });
    p.text(cols[3], y, q.coach ? `${q.coach} / ${q.coach_seat}` : (q.seat_number || "Waitlisted"), { size: 10, font: "F3" });
    p.text(cols[4], y, q.berth_type || "-", { size: 10 });
    p.line(M, y - 7, W - M, y - 7, "#E6E9F2", 0.5);
    y -= 22;
  });
  y -= 14;

  // ---- billing
  section("Fare & billing");
  const cx = { desc: M + 6, qty: M + 300, rate: M + 365, amt: W - M - 6 };
  p.rect(M, y - 6, W - 2 * M, 20, LIGHT);
  p.text(cx.desc, y, "DESCRIPTION", { size: 7.5, font: "F2", color: SOFT });
  p.text(cx.qty, y, "QTY", { size: 7.5, font: "F2", color: SOFT });
  p.text(cx.rate, y, "RATE", { size: 7.5, font: "F2", color: SOFT });
  p.text(cx.amt, y, "AMOUNT", { size: 7.5, font: "F2", color: SOFT, align: "right" });
  y -= 22;
  const rateClass = b.upgraded_from || b.class_code;
  p.text(cx.desc, y, `Ticket fare - class ${rateClass}`, { size: 10 });
  p.text(cx.qty, y, String(n), { size: 10 });
  p.text(cx.rate, y, money(fare / n), { size: 10 });
  p.text(cx.amt, y, money(fare), { size: 10, align: "right" });
  p.line(M, y - 7, W - M, y - 7, "#E6E9F2", 0.5);
  y -= 22;
  if (b.upgraded_from) {
    p.text(cx.desc, y, `Auto-upgrade ${b.upgraded_from} -> ${b.class_code} (complimentary)`, { size: 10, color: SOFT });
    p.text(cx.amt, y, money(0), { size: 10, color: SOFT, align: "right" });
    p.line(M, y - 7, W - M, y - 7, "#E6E9F2", 0.5);
    y -= 22;
  }
  y -= 4;
  p.rect(M + 300, y - 10, W - 2 * M - 300, 30, NAVY);
  p.text(M + 312, y, "TOTAL PAYABLE", { size: 9, font: "F2", color: "#FFFFFF" });
  p.text(W - M - 10, y, money(fare), { size: 12.5, font: "F2", color: "#FFFFFF", align: "right" });
  y -= 46;

  // ---- payment
  section("Payment details");
  kv(M, "Payment mode", online ? "Online - UPI" : "Offline - pay at counter");
  kv(M + 270, "Payment status", b.payment_status || "-");
  y -= 38;
  kv(M, "Amount", money(fare));
  kv(M + 270, online ? "Transaction ID" : "Pay at", online ? (b.transaction_id || "-") : "Railway booking counter");
  y -= 38;
  if (online && opts.upiId) { kv(M, "Paid to UPI ID", opts.upiId); y -= 38; }
  if (online && b.payment_status !== "Verified") {
    p.text(M, y, "Payment is awaiting verification by staff. This ticket is final once the status shows Verified.", { size: 8.5, color: SOFT });
    y -= 16;
  }

  // ---- footer
  p.line(M, 74, W - M, 74, LINE, 0.8);
  p.text(M, 58, "This is a computer-generated document and does not need a signature.", { size: 8, color: SOFT });
  p.text(M, 46, "Please carry a valid photo ID while travelling. Check PNR status anytime on the RailReserve website.", { size: 8, color: SOFT });
  p.text(W - M, 58, `Invoice: INV-${b.pnr || ""}`, { size: 8, font: "F3", color: SOFT, align: "right" });
  p.text(W - M, 46, `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, { size: 8, color: SOFT, align: "right" });

  return assemble(p);
}

export function downloadTicketPdf(b, opts) {
  const bytes = buildTicketPdf(b, opts);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = `ticket-${b.pnr}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
