export default function RailScene({ cars = 4 }) {
  return (
    <div className="rail-scene">
      <div className="rail-track" />
      <div className="rail-train">
        {Array.from({ length: cars }).map((_, i) => (
          <div className="rail-car" key={i}>
            <div className="rw" />
          </div>
        ))}
      </div>
    </div>
  );
}
