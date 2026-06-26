import subprocess
import os
from PIL import Image
import tempfile

TESSERACT_PATH = r'C:\Users\saini\OneDrive\Desktop\Compiler_p\tesseract.exe'

def extract_text_from_image(image_bytes):
    try:
        if not os.path.exists(TESSERACT_PATH):
            return None, "Tesseract not found at: " + TESSERACT_PATH
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_in:
            tmp_in.write(image_bytes)
            tmp_input = tmp_in.name
        
        tmp_output = tmp_input.replace('.png', '_out')
        
        result = subprocess.run(
            [TESSERACT_PATH, tmp_input, tmp_output, '-l', 'eng'],
            capture_output=True, text=True
        )
        
        output_file = tmp_output + '.txt'
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                text = f.read().strip()
            os.unlink(tmp_input)
            os.unlink(output_file)
            return text, None
        else:
            return None, "OCR failed: " + result.stderr
            
    except Exception as e:
        return None, str(e)