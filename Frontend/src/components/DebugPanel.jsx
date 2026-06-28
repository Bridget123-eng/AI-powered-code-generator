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
          <strong>Quality Status: {report.status || report.quality}</strong>
          {report.message && <p>{report.message}</p>}
          
          {(report.suggestions || report.issues || []).length > 0 && (
            <div className="report-section">
              <span className="section-label">Issues & Suggestions:</span>
              {(report.suggestions || report.issues || []).map((item) => (
                <p className="muted" key={item}>• {item}</p>
              ))}
            </div>
          )}

          {report.refactoring && report.refactoring.length > 0 && (
            <div className="report-section" style={{ marginTop: "10px" }}>
              <span className="section-label">Refactoring & Improvements:</span>
              {report.refactoring.map((item) => (
                <p className="muted" key={item}>• {item}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
