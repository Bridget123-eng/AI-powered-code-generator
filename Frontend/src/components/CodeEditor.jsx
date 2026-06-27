import axios from "axios";

const explainCode = async () => {

  const res = await axios.post(
    "http://localhost:5000/explain",
    {
      code
    }
  );

  alert(res.data.explanation);
};
const optimizeCode = async () => {

  const res = await axios.post(
    "http://localhost:5000/optimize",
    {
      code
    }
  );

  setCode(res.data.optimized);
};
<button onClick={optimizeCode}>
  Optimize Code
</button>
import jsPDF from "jspdf";

const downloadPDF = () => {

  const doc = new jsPDF();

  doc.text(code, 10, 10);

  doc.save("generated_code.pdf");
};
<button onClick={downloadPDF}>
  Download PDF
</button>