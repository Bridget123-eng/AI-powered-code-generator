import { useState } from "react";
import "./App.css";
import ChatPanel from "./components/ChatPanel";
import CodeEditor from "./components/CodeEditor";
import DebugPanel from "./components/DebugPanel";
import HistoryPanel from "./components/HistoryPanel";
import OCRUpload from "./components/OCRUpload";
import VoiceInput from "./components/VoiceInput";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function App() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const onHistoryChanged = () => setRefreshKey((value) => value + 1);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Developer Productivity Workspace</p>
          <h1>AI Coding and SQL Assistant</h1>
        </div>
        <VoiceInput setCode={setCode} setStatus={setStatus} />
      </header>

      {status && <div className="status-line">{status}</div>}

      <section className="workspace-grid">
        <div className="panel-stack">
          <ChatPanel
            apiUrl={API_URL}
            setCode={setCode}
            setStatus={setStatus}
            onHistoryChanged={onHistoryChanged}
          />
          <OCRUpload apiUrl={API_URL} setCode={setCode} setStatus={setStatus} />
          <DebugPanel apiUrl={API_URL} code={code} setCode={setCode} setStatus={setStatus} />
        </div>

        <CodeEditor apiUrl={API_URL} code={code} setCode={setCode} setStatus={setStatus} />

        <HistoryPanel apiUrl={API_URL} refreshKey={refreshKey} setCode={setCode} />
      </section>
    </main>
  );
}
