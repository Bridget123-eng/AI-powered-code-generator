import axios from "axios";

export default function OCRUpload({ setCode }) {

  const uploadImage = async (e) => {

    const file = e.target.files[0];

    const formData = new FormData();

    formData.append("image", file);

    const res = await axios.post(
      "http://localhost:5000/compile-image",
      formData
    );

    setCode(res.data.code);
  };

  return (
    <div>

      <h2>Upload Code Image</h2>

      <input
        type="file"
        onChange={uploadImage}
      />

    </div>
  );
}