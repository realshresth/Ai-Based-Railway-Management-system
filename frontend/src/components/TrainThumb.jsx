import { useState } from "react";

/**
 * Looks for a real photo at /public/images/trains/<train_number>.jpg (drop your
 * own licensed images there — see README "Adding train & route photos").
 * If none exists, falls back to a styled gradient placeholder so the layout
 * never breaks or shows a broken-image icon.
 */
export default function TrainThumb({ trainNumber, name }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || "").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  if (broken) {
    return (
      <div className="train-thumb train-thumb-fallback" title={name}>
        {initials || "🚆"}
      </div>
    );
  }

  return (
    <img
      className="train-thumb"
      src={`/images/trains/${trainNumber}.jpg`}
      alt={name}
      onError={() => setBroken(true)}
    />
  );
}
