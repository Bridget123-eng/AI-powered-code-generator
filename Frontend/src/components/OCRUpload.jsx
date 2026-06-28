import axios from "axios";

export default function OCRUpload({ apiUrl, setCode, setStatus }) {
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setStatus("Reading image...");
      const res = await axios.post(`${apiUrl}/compile-image`, formData);
      setCode(res.data.code || res.data.steps?.code || "");
      setStatus(res.data.extracted_text ? `Extracted: ${res.data.extracted_text}` : "Image processed.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Image upload failed.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>OCR Upload</h2>
      </div>
      <input type="file" accept="image/*" onChange={uploadImage} />
    </section>
  );
}
