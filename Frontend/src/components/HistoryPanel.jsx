import { useEffect, useState } from "react";
import axios from "axios";

export default function HistoryPanel({ apiUrl, refreshKey, setCode }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    axios
      .get(`${apiUrl}/history`)
      .then((res) => setItems(res.data.history || []))
      .catch(() => setItems([]));
  }, [apiUrl, refreshKey]);

  const restore = (item) => {
    const code = item.result?.code || item.result?.options?.[0]?.query || item.result?.steps?.code || "";
    setCode(code);
  };

  return (
    <aside className="panel history-panel">
      <div className="panel-heading">
        <h2>History</h2>
      </div>
      {items.length === 0 && <p className="muted">No generated items yet.</p>}
      {items.map((item) => (
        <button className="history-item" key={item.id} onClick={() => restore(item)}>
          <span>{item.kind}</span>
          <strong>{item.prompt || "Untitled"}</strong>
        </button>
      ))}
    </aside>
  );
}
