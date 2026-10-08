import { useEffect, useState } from "react";
import api from "../api/client";
import Toast from "../components/Toast";

const BLANK = { name: "", age: "", gender: "M" };

export default function Passengers() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.get("/passengers").then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.age) return;
    if (editingId) {
      await api.put(`/passengers/${editingId}`, { ...form, age: Number(form.age) });
      setToast("Passenger updated.");
    } else {
      await api.post("/passengers", { ...form, age: Number(form.age) });
      setToast("Passenger added.");
    }
    setForm(BLANK);
    setEditingId(null);
    load();
  }

  function startEdit(p) {
    setForm({ name: p.name, age: p.age, gender: p.gender });
    setEditingId(p.id);
  }

  async function remove(id) {
    if (!window.confirm("Remove this passenger?")) return;
    await api.delete(`/passengers/${id}`);
    setToast("Passenger removed.");
    load();
  }

  return (
    <div className="container" style={{ padding: "40px 24px 70px", maxWidth: 800 }}>
      <Toast message={toast} onDone={() => setToast("")} />
      <h2>Passenger Management</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        Save passengers here so you don't have to retype their details every time you book.
      </p>

      <form onSubmit={submit} className="card" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginBottom: 28, alignItems: "end" }}>
        <div className="form-field" style={{ margin: 0 }}>
          <label>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-field" style={{ margin: 0 }}>
          <label>Age</label>
          <input type="number" min="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />
        </div>
        <div className="form-field" style={{ margin: 0 }}>
          <label>Gender</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit">{editingId ? "Update" : "Add passenger"}</button>
      </form>

      {loading && <p>Loading…</p>}
      {!loading && list.length === 0 && (
        <div className="empty-state"><h4>No saved passengers</h4><p>Add one above to reuse across bookings.</p></div>
      )}

      {list.length > 0 && (
        <table className="data-table" style={{ width: "100%" }}>
          <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.age}</td><td>{p.gender}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
