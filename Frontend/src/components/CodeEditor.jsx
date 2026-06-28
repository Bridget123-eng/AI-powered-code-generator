import { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";

export default function CodeEditor({ apiUrl, code, setCode, setStatus }) {
  const [details, setDetails] = useState("");

  const explainCode = async () => {
    const res = await axios.post(`${apiUrl}/explain`, { code });
    setDetails(res.data.explanation);
    setStatus("Explanation generated.");
  };

  const optimizeCode = async () => {
    const res = await axios.post(`${apiUrl}/optimize`, { code });
    setCode(res.data.optimized || code);
    setDetails((res.data.suggestions || []).join("\n"));
    setStatus("Optimization suggestions generated.");
  };

  const createDocs = async () => {
    const res = await axios.post(`${apiUrl}/documentation`, { code });
    setDetails(res.data.documentation);
    setStatus("Documentation generated.");
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(code || "No code generated yet.", 180);
    doc.text(lines, 10, 12);
    doc.save("assistant-output.pdf");
  };

  return (
    <section className="panel editor-panel">
      <div className="panel-heading">
        <h2>Code / Query</h2>
        <div className="toolbar">
          <button onClick={explainCode}>Explain</button>
          <button onClick={optimizeCode}>Optimize</button>
          <button onClick={createDocs}>Docs</button>
          <button onClick={downloadPDF}>PDF</button>
        </div>
      </div>

      <textarea
        className="code-box"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck="false"
        placeholder="Generated code or SQL will appear here."
      />

      {details && (
        <div className="details-box">
          <h3>Assistant Notes</h3>
          <pre>{details}</pre>
        </div>
      )}
    </section>
  );
}
