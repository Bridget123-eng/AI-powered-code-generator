import axios from "axios";

export default function DebugPanel({ code }) {

  const debugCode = async () => {

    const res = await axios.post(
      "http://localhost:5000/debug",
      {
        code
      }
    );

    alert(res.data.message);
  };

  return (
    <div>

      <h2>Debugging</h2>

      <button onClick={debugCode}>
        Debug Code
      </button>

    </div>
  );
}