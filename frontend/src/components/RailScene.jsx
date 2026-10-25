/**
 * Elegant railway illustration: rails converging to a vanishing point under a
 * night-sky gradient, a faint far-away train with a headlight glow, and a
 * semi-transparent dark-blue overlay so hero text stays readable.
 * Pure SVG, no image files needed.
 */
export default function RailScene() {
  const sleepers = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 1) / 12;                 // 0 (far) .. 1 (near)
    const y = 200 + Math.pow(t, 1.8) * 200; // perspective spacing
    const half = 12 + t * 330;              // half-width of the track at that depth
    return { y, half, w: 1 + t * 5 };
  });
  return (
    <div className="rail-scene" aria-hidden="true">
      <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="rs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#010736" />
            <stop offset=".6" stopColor="#0D1C42" />
            <stop offset="1" stopColor="#22396F" />
          </linearGradient>
          <radialGradient id="rs-glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#bcd4ff" stopOpacity=".95" />
            <stop offset="1" stopColor="#6f9bff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rs-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#010736" stopOpacity=".1" />
            <stop offset="1" stopColor="#010736" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <rect width="800" height="400" fill="url(#rs-sky)" />
        {/* distant skyline hills */}
        <path d="M0 200 L90 185 L180 197 L300 178 L420 196 L540 182 L660 195 L800 184 L800 205 L0 205 Z" fill="#0b1640" />
        {/* ballast bed */}
        <path d="M388 200 L412 200 L800 400 L0 400 Z" fill="#101b45" />
        {/* sleepers */}
        {sleepers.map((s, i) => (
          <line key={i} x1={400 - s.half} y1={s.y} x2={400 + s.half} y2={s.y} stroke="#3a5088" strokeOpacity=".75" strokeWidth={s.w} strokeLinecap="round" />
        ))}
        {/* rails */}
        <path d="M396 200 L110 400" stroke="#9db6ea" strokeOpacity=".8" strokeWidth="3" fill="none" />
        <path d="M404 200 L690 400" stroke="#9db6ea" strokeOpacity=".8" strokeWidth="3" fill="none" />
        <path d="M399 200 L255 400" stroke="#9db6ea" strokeOpacity=".5" strokeWidth="1.4" fill="none" />
        <path d="M401 200 L545 400" stroke="#9db6ea" strokeOpacity=".5" strokeWidth="1.4" fill="none" />
        {/* far train + headlight */}
        <rect x="391" y="192" width="18" height="9" rx="2" fill="#2b4a8f" />
        <circle cx="400" cy="197" r="26" fill="url(#rs-glow)" className="rail-glow" />
        <circle cx="400" cy="197" r="2.2" fill="#fff" />
        <rect width="800" height="400" fill="url(#rs-fade)" />
      </svg>
    </div>
  );
}
