export default function VoiceInput({ setCode }) {

  const startVoice = () => {

    const recognition =
      new window.webkitSpeechRecognition();

    recognition.onresult = (event) => {

      const text =
        event.results[0][0].transcript;

      setCode(text);
    };

    recognition.start();
  };

  return (
    <button onClick={startVoice}>
      Voice Input
    </button>
  );
}