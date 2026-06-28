import { useState } from "react";
import axios from "axios";

export default function DebugPanel({ apiUrl, code, setStatus }) {
  const [report, setReport] = useState(null);

  const runCheck = async (path) => {
    try {
      const res = await axios.post(`${apiUrl}/${path}`, { code });
      setReport(res.data);
      setStatus(path === "review" ? "Code review complete." : "Debug check complete.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Check failed.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Quality</h2>
        <div className="toolbar">
          <button onClick={() => runCheck("debug")}>Debug</button>
          <button onClick={() => runCheck("review")}>Review</button>
        </div>
      </div>

      {report && (
        <div className="details-box compact">
          <strong>{report.status || report.quality}</strong>
          {report.message && <p>{report.message}</p>}
          {(report.suggestions || report.issues || []).map((item) => (
            <p className="muted" key={item}>{item}</p>
          ))}
        </div>
      )}
    </section>
  );
}
