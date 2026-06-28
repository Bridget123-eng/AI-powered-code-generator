export default function VoiceInput({ setCode, setStatus }) {
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setStatus("Listening...");
    recognition.onerror = () => setStatus("Voice input failed.");
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setCode(text);
      setStatus("Voice text added to the editor.");
    };
    recognition.start();
  };

  return (
    <button className="voice-button" onClick={startVoice}>
      Voice Input
    </button>
  );
}
