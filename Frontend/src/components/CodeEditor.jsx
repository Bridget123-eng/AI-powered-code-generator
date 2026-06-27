import Editor from "@monaco-editor/react";

export default function CodeEditor({ code, setCode }) {

  return (
    <div>

      <h2>Code Editor</h2>

      <Editor
        height="500px"
        defaultLanguage="python"
        value={code}
        onChange={(value) => setCode(value)}
      />

    </div>
  );
}