import base64

from flask import Flask, jsonify, request
from flask_cors import CORS

from assistant_core import (
    debug_code,
    execute_sql_preview,
    explain_code,
    generate_code_from_prompt,
    generate_documentation,
    generate_sql,
    is_sql_request,
    optimize_code,
    review_code,
)
from code_generator import generate_code as generate_pipeline_code
from flowchart_generator import generate_flowchart
from ir_generator import generate_ir
from language_mapper import map_language
from lexer import lexical_analysis
from ocr_module_2 import extract_text_from_image
from parser import parse
from preprocessing import preprocess
from semantic import semantic_analysis
from utils import normalize_voice_input


app = Flask(__name__)
CORS(app)

history = []


def _run_pipeline(raw_text, language="English"):
    if is_sql_request(raw_text):
        sql_result = generate_sql(raw_text)
        query = sql_result["options"][0]["query"]
        return {
            "success": True,
            "steps": {
                "input": raw_text,
                "preprocessed": raw_text.strip(),
                "tokens": [],
                "mapped_tokens": [],
                "parsed": {"type": "SQL", "intent": sql_result["intent"]},
                "semantic": sql_result,
                "ir": [{"op": "SQL", "intent": sql_result["intent"], "query": query}],
                "code": query,
                "flowchart": "",
            },
            "code": query,
            "sql": sql_result,
            "flowchart": "",
        }

    processed = preprocess(raw_text, language)
    tokens = lexical_analysis(processed)
    mapped = map_language(tokens)
    parsed = parse(mapped, language)
    semantic = semantic_analysis(parsed)
    ir = generate_ir(semantic)
    code = generate_pipeline_code(ir)
    flowchart = generate_flowchart(ir)

    return {
        "success": True,
        "steps": {
            "input": raw_text,
            "preprocessed": processed,
            "tokens": tokens,
            "mapped_tokens": [str(m) for m in mapped],
            "parsed": parsed,
            "semantic": semantic,
            "ir": ir,
            "code": code,
            "flowchart": flowchart,
        },
        "code": code,
        "flowchart": flowchart,
    }


def _run_multiline(raw_text, language="English"):
    lines = [line.strip() for line in raw_text.strip().splitlines()]
    clean_lines = [line for line in lines if line and not line.startswith("#")]
    if not clean_lines:
        raise ValueError("File is empty or does not contain a valid statement.")
    return _run_pipeline(" and ".join(clean_lines), language)


def _json_payload():
    return request.get_json(silent=True) or {}


def _record(kind, prompt, result):
    item = {
        "id": len(history) + 1,
        "kind": kind,
        "prompt": prompt,
        "result": result,
    }
    history.insert(0, item)
    del history[50:]
    return item


@app.route("/", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "message": "AI coding and SQL assistant backend is running.",
        }
    )


@app.route("/compile", methods=["POST"])
def compile_code():
    try:
        data = _json_payload()
        raw_text = data.get("text", "").strip()
        language = data.get("language", "English")
        if not raw_text:
            return jsonify({"success": False, "error": "Text input is required."}), 400

        result = _run_multiline(raw_text, language) if "\n" in raw_text else _run_pipeline(raw_text, language)
        _record("compile", raw_text, result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/compile-voice", methods=["POST"])
def compile_voice():
    try:
        data = _json_payload()
        raw_text = data.get("text", "").strip()
        language = data.get("language", "English")
        if not raw_text:
            return jsonify({"success": False, "error": "Voice text is required."}), 400

        normalized = normalize_voice_input(raw_text)
        result = _run_pipeline(normalized, language)
        result["voice_info"] = {
            "original": raw_text,
            "normalized": normalized,
            "language": language,
        }
        _record("voice", raw_text, result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/compile-file", methods=["POST"])
def compile_file():
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "File is required."}), 400
        file = request.files["file"]
        language = request.form.get("language", "English")
        if not file.filename.lower().endswith(".txt"):
            return jsonify({"success": False, "error": "Only .txt files are allowed."}), 400
        content = file.read().decode("utf-8").strip()
        if not content:
            return jsonify({"success": False, "error": "File is empty."}), 400

        result = _run_multiline(content, language)
        _record("file", file.filename, result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/compile-image", methods=["POST"])
def compile_image():
    try:
        language = request.form.get("language", "English")
        image_bytes = None

        if "image" in request.files:
            image_bytes = request.files["image"].read()
        else:
            data = _json_payload()
            image_data = data.get("image", "")
            language = data.get("language", language)
            if "," in image_data:
                image_data = image_data.split(",", 1)[1]
            if image_data:
                image_data += "=" * (-len(image_data) % 4)
                image_bytes = base64.b64decode(image_data)

        if not image_bytes:
            return jsonify({"success": False, "error": "Image data is required."}), 400

        extracted, err = extract_text_from_image(image_bytes)
        if err:
            return jsonify({"success": False, "error": err}), 400
        if not extracted:
            return jsonify({"success": False, "error": "No text was detected in the image."}), 400

        result = _run_multiline(extracted, language)
        result["extracted_text"] = extracted
        _record("image", "uploaded image", result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/generate", methods=["POST"])
def generate():
    try:
        prompt = _json_payload().get("prompt", "").strip()
        code = generate_code_from_prompt(prompt)
        result = {
            "success": True,
            "code": code,
            "explanation": explain_code(code),
            "complexity": "Depends on generated logic; common templates include practical baseline implementations.",
        }
        _record("generate", prompt, result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/explain", methods=["POST"])
def explain():
    code = _json_payload().get("code", "")
    return jsonify({"success": True, "explanation": explain_code(code)})


@app.route("/optimize", methods=["POST"])
def optimize():
    code = _json_payload().get("code", "")
    return jsonify({"success": True, **optimize_code(code)})


@app.route("/debug", methods=["POST"])
def debug():
    code = _json_payload().get("code", "")
    return jsonify({"success": True, **debug_code(code)})


@app.route("/review", methods=["POST"])
def review():
    code = _json_payload().get("code", "")
    return jsonify({"success": True, **review_code(code)})


@app.route("/documentation", methods=["POST"])
def documentation():
    code = _json_payload().get("code", "")
    return jsonify({"success": True, "documentation": generate_documentation(code)})


@app.route("/sql/generate", methods=["POST"])
def sql_generate():
    try:
        data = _json_payload()
        prompt = data.get("prompt", "").strip()
        dialect = data.get("dialect", "mysql")
        schema = data.get("schema")
        result = generate_sql(prompt, schema=schema, dialect=dialect)
        _record("sql", prompt, result)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/sql/execute", methods=["POST"])
def sql_execute():
    query = _json_payload().get("query", "")
    result = execute_sql_preview(query)
    _record("sql-execute", query, result)
    return jsonify(result), 200 if result["success"] else 400


@app.route("/history", methods=["GET"])
def get_history():
    return jsonify({"success": True, "history": history})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
