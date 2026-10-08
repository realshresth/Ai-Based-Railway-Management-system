import { useState } from "react";

/**
 * Same idea as TrainThumb: looks for /public/images/destinations/<slug>.jpg,
 * falls back to the plain gradient card if no photo has been added yet.
 */
export default function DestThumb({ slug, title, sub }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="dest-card">
      {!broken && (
        <img
          className="dest-card-img"
          src={`/images/destinations/${slug}.jpg`}
          alt={title}
          onError={() => setBroken(true)}
        />
      )}
      <div className="dest-card-overlay" />
      <b>{title}</b>
      <span>{sub}</span>
    </div>
  );
}
