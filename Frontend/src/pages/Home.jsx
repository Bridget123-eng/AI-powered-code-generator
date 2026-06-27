import { useState } from "react";
import ChatPanel from "../components/ChatPanel";
import CodeEditor from "../components/CodeEditor";
import DebugPanel from "../components/DebugPanel";
import VoiceInput from "../components/VoiceInput";
import OCRUpload from "../components/OCRUpload";
import HistoryPanel from "../components/HistoryPanel";

export default function Home() {

  const [code, setCode] = useState("");
  const [response, setResponse] = useState("");

  return (
    <div className="container">

      <h1>AI Coding Assistant</h1>

      <VoiceInput setCode={setCode} />

      <OCRUpload setCode={setCode} />

      <ChatPanel setCode={setCode} />

      <CodeEditor code={code} setCode={setCode} />

      <DebugPanel code={code} />

      <HistoryPanel />

    </div>
  );
}