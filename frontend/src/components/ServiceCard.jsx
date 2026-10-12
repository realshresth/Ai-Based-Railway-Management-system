import { Link } from "react-router-dom";

export default function ServiceCard({ icon, title, description, to }) {
  return (
    <div className="card">
      <div className="card-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{description}</p>
      <Link className="link-btn" to={to || "#"}>
        Learn more →
      </Link>
    </div>
  );
}
