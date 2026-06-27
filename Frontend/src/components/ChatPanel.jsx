import { useState } from "react";
import axios from "axios";

export default function ChatPanel({ setCode }) {

  const [prompt, setPrompt] = useState("");

  const generateCode = async () => {

    const res = await axios.post(
      "http://localhost:5000/generate",
      {
        prompt
      }
    );

    setCode(res.data.code);
  };

  return (
    <div>

      <h2>AI Chat</h2>

      <textarea
        rows="5"
        cols="80"
        placeholder="Describe what code you want..."
        onChange={(e) => setPrompt(e.target.value)}
      />

      <br />

      <button onClick={generateCode}>
        Generate Code
      </button>

    </div>
  );
}