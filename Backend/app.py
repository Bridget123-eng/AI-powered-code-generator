from flask import Flask, request, jsonify
from flask_cors import CORS
import base64


from preprocessing import preprocess
from lexer import lexical_analysis
from language_mapper import map_language
from parser import parse
from semantic import semantic_analysis
from ir_generator import generate_ir
from code_generator import generate_code
from flowchart_generator import generate_flowchart
from utils import normalize_voice_input

from ocr_module_2 import extract_text_from_image
OCR_AVAILABLE = True

app = Flask(__name__)
CORS(app)

def _run_pipeline(raw_text, language="English"):
    """Single statement ya AND se joined multi-statement pipeline"""
    processed = preprocess(raw_text, language)
    tokens    = lexical_analysis(processed)
    mapped    = map_language(tokens)
    parsed    = parse(mapped, language)
    semantic  = semantic_analysis(parsed)
    ir        = generate_ir(semantic)
    code      = generate_code(ir)
    flowchart = generate_flowchart(ir)

    return {
        "success": True,
        "steps": {
            "input":         raw_text,
            "preprocessed":  processed,
            "tokens":        tokens,
            "mapped_tokens": [str(m) for m in mapped],
            "parsed":        parsed,
            "semantic":      semantic,
            "ir":            ir,
            "code":          code,
            "flowchart":     flowchart
        }
    }


def _run_multiline(raw_text, language="English"):
    """
    Multi-line text ko handle karta hai.
    Har line alag statement hai — sab AND se join karke ek pipeline mein chalata hai.
    Empty lines aur comments (#) ignore hote hain.
    """
    lines = raw_text.strip().splitlines()

    # Clean lines
    clean_lines = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            clean_lines.append(line)

    if not clean_lines:
        raise Exception("File empty hai ya koi valid statement nahi mila.")

    # Saari lines ko AND se join karo
    combined = " and ".join(clean_lines)

    return _run_pipeline(combined, language)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Compiler backend chal raha hai!"})


@app.route("/compile", methods=["POST"])
def compile_code():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"success": False, "error": "Text input nahi mila"}), 400
        raw_text = data.get("text", "").strip()
        language = data.get("language", "English")
        if not raw_text:
            return jsonify({"success": False, "error": "Input empty hai"}), 400

        # Multi-line text support
        if "\n" in raw_text:
            result = _run_multiline(raw_text, language)
        else:
            result = _run_pipeline(raw_text, language)

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/compile-voice", methods=["POST"])
def compile_voice():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"success": False, "error": "Voice text nahi mila"}), 400
        language   = data.get("language", "English")
        raw_text   = data["text"].strip()
        if not raw_text:
            return jsonify({"success": False, "error": "Voice input empty hai. Dobara bolkar try karo."}), 400
        normalized  = normalize_voice_input(raw_text)
        result      = _run_pipeline(normalized, language)
        result["voice_info"] = {"original": raw_text, "normalized": normalized, "language": language}
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/compile-file", methods=["POST"])
def compile_file():
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "File nahi mili"}), 400
        file     = request.files["file"]
        language = request.form.get("language", "English")
        if not file.filename.lower().endswith(".txt"):
            return jsonify({"success": False, "error": "Only .txt files allowed"}), 400
        content = file.read().decode("utf-8").strip()
        if not content:
            return jsonify({"success": False, "error": "File empty hai"}), 400

        # Multi-line file — line by line process
        result = _run_multiline(content, language)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/compile-image", methods=["POST"])
def compile_image():
    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"success": False, "error": "Image data nahi mila"}), 400
        language  = data.get("language", "English")
      
        image_data = data["image"]

        if "," in image_data:
         image_data = image_data.split(",")[1]

        image_data += "=" * (4 - len(image_data) % 4)
        image_bytes = base64.b64decode(image_data)
        extracted, err = extract_text_from_image(image_bytes)       
        if err:
            return jsonify({"success": False, "error": err}), 400
        if not extracted:
            return jsonify({"success": False, "error": "Image se koi text nahi nikla"}), 400

        result = _run_multiline(extracted, language)
        result["extracted_text"] = extracted
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
    
    history = []

@app.route("/generate", methods=["POST"])
def generate():

    data = request.json

    prompt = data["prompt"]

    result = generate_code(prompt)

    history.append({
        "prompt": prompt
    })

    return jsonify({
        "code": result
    })

@app.route("/explain", methods=["POST"])
def explain():

    code = request.json["code"]

    explanation = explain_code(code)

    return jsonify({
        "explanation": explanation
    })

@app.route("/optimize", methods=["POST"])
def optimize():

    code = request.json["code"]

    optimized = optimize_code(code)

    return jsonify({
        "optimized": optimized
    })

@app.route("/debug", methods=["POST"])
def debug():

    code = request.json["code"]

    result = debug_python(code)

    return jsonify(result)

@app.route("/history", methods=["GET"])
def get_history():

    return jsonify(history)

if __name__ == "__main__":
    app.run(debug=True)
