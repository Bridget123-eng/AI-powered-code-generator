import { useState } from "react";
import axios from "axios";

const DEFAULT_SCHEMA = `Employee(ID INT PRIMARY KEY, Name VARCHAR(100), Salary DECIMAL, Department VARCHAR(80)) -- rows: 250
Students(ID INT PRIMARY KEY, Name VARCHAR(100), CGPA DECIMAL, Semester INT) -- rows: 1200`;

export default function ChatPanel({ apiUrl, setCode, setStatus, onHistoryChanged }) {
  const [mode, setMode] = useState("sql");
  const [dialect, setDialect] = useState("mysql");
  const [prompt, setPrompt] = useState("");
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [sqlResult, setSqlResult] = useState(null);
  const [executionResult, setExecutionResult] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) {
      setStatus("Enter a prompt first.");
      return;
    }

    setLoading(true);
    setStatus("Generating...");
    setSqlResult(null);
    setExecutionResult("");

    try {
      if (mode === "sql") {
        const res = await axios.post(`${apiUrl}/sql/generate`, { prompt, dialect, schema });
        setSqlResult(res.data);
        setCode(res.data.options?.[0]?.query || "");
        setStatus(`${res.data.intent} query generated.`);
      } else {
        const res = await axios.post(`${apiUrl}/generate`, { prompt });
        setCode(res.data.code || "");
        setStatus(res.data.explanation || "Code generated.");
      }
      onHistoryChanged();
    } catch (error) {
      setStatus(error.response?.data?.error || "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async (query) => {
    try {
      const res = await axios.post(`${apiUrl}/sql/execute`, { query });
      setExecutionResult(res.data.result);
      setStatus("Execution preview complete.");
    } catch (error) {
      const data = error.response?.data;
      setExecutionResult(data?.result || "Execution preview failed.");
      setStatus(data?.validation?.errors?.join(" ") || "Execution preview failed.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Prompt</h2>
        <div className="segmented">
          <button className={mode === "sql" ? "active" : ""} onClick={() => setMode("sql")}>
            SQL
          </button>
          <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}>
            Code
          </button>
        </div>
      </div>

      {mode === "sql" && (
        <div className="field-row">
          <label>
            Dialect
            <select value={dialect} onChange={(event) => setDialect(event.target.value)}>
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
          </label>
        </div>
      )}

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={
          mode === "sql"
            ? "Increase salary of all employees in IT department by 10%"
            : "Write a Python function to find factorial"
        }
      />

      {mode === "sql" && (
        <textarea
          className="schema-box"
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
          spellCheck="false"
        />
      )}

      <button className="primary" onClick={submit} disabled={loading}>
        {loading ? "Working..." : "Generate"}
      </button>

      {executionResult && <p className="status-inline">{executionResult}</p>}

      {sqlResult?.options?.length > 0 && (
        <div className="result-list">
          {sqlResult.options.map((option, index) => (
            <article className="result-item" key={`${option.query}-${index}`}>
              <div className="result-title">Option {index + 1}</div>
              <pre>{option.query}</pre>
              <p>{option.explanation}</p>
              <p className="muted">Tables: {option.tables.join(", ")} | Attributes: {option.attributes.join(", ")}</p>
              <p className="muted">Clauses: {option.clauses.join(", ")}</p>
              <p className="muted">{option.impact}</p>
              <p className="muted">{option.optimization}</p>
              {!option.valid && <p className="warning">{option.validation.errors.join(" ")}</p>}
              {option.warnings.map((warning) => (
                <p className="warning" key={warning}>{warning}</p>
              ))}
              <div className="toolbar">
                <button onClick={() => setCode(option.query)}>Use Query</button>
                <button onClick={() => executeQuery(option.query)}>Preview Execute</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
