// ═══════════════════════════════════════════════
//  NL COMPILER · app.js
//  Features: Compile · Live Execute · PDF Export
//            Voice Input · Read Aloud · Error Suggestions
// ═══════════════════════════════════════════════

const BACKEND = "http://localhost:5000";
let currentMode = "text", currentLanguage = "English";
let selectedFile = null, selectedImage = null;
let voiceText = "", isListening = false, recognition = null;
let pyodide = null, pyodideReady = false;
let currentCode = "", currentSteps = null, isSpeaking = false;

const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);

// ── PYODIDE INIT (background) ─────────────────
async function initPyodide() {
  try {
    pyodide = await loadPyodide();
    pyodideReady = true;
    console.log("Pyodide ready ✓");
  } catch(e) {
    console.log("Pyodide not loaded:", e);
  }
}
initPyodide();

// ── BACKEND STATUS ────────────────────────────
async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      $("status-dot").className = "status-dot online";
      $("status-text").textContent = "Backend Online";
    }
  } catch {
    $("status-dot").className = "status-dot offline";
    $("status-text").textContent = "Backend Offline";
  }
}
checkBackend();
setInterval(checkBackend, 10000);

// ── LANGUAGE ──────────────────────────────────
$$(".lang-btn").forEach(btn => btn.addEventListener("click", () => {
  $$(".lang-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentLanguage = btn.dataset.lang;
}));

// ── MODE TABS ─────────────────────────────────
$$(".mode-btn").forEach(btn => btn.addEventListener("click", () => {
  $$(".mode-btn").forEach(b => b.classList.remove("active"));
  $$(".mode-pane").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  currentMode = btn.dataset.mode;
  $(`pane-${currentMode}`).classList.add("active");
}));

// ── ACCORDION ─────────────────────────────────
function toggleStep(hd) { hd.parentElement.classList.toggle("closed"); }

// ── CHIPS ─────────────────────────────────────
$$(".chip").forEach(chip => chip.addEventListener("click", () => {
  $$(".mode-btn").forEach(b => b.classList.remove("active"));
  $$(".mode-pane").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-mode="text"]').classList.add("active");
  $("pane-text").classList.add("active");
  currentMode = "text";
  $("text-input").value = chip.dataset.val;
  $("text-input").focus();
}));

// ── FILE UPLOAD ───────────────────────────────
const fileZone = $("file-zone"), fileInput = $("file-input");
fileZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => {
  const f = e.target.files[0];
  if (f) { selectedFile = f; $("file-name").textContent = `✓ ${f.name}`; }
});
fileZone.addEventListener("dragover", e => { e.preventDefault(); fileZone.classList.add("over"); });
fileZone.addEventListener("dragleave", () => fileZone.classList.remove("over"));
fileZone.addEventListener("drop", e => {
  e.preventDefault(); fileZone.classList.remove("over");
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith(".txt")) { selectedFile = f; $("file-name").textContent = `✓ ${f.name}`; }
  else showError("Only .txt files are supported.");
});

// ── IMAGE UPLOAD ──────────────────────────────
const imageZone = $("image-zone"), imageInput = $("image-input");
imageZone.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", e => { if (e.target.files[0]) handleImage(e.target.files[0]); });
imageZone.addEventListener("dragover", e => { e.preventDefault(); imageZone.classList.add("over"); });
imageZone.addEventListener("dragleave", () => imageZone.classList.remove("over"));
imageZone.addEventListener("drop", e => {
  e.preventDefault(); imageZone.classList.remove("over");
  if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]);
});
function handleImage(file) {
  selectedImage = file;
  const reader = new FileReader();
  reader.onload = e => { $("img-preview").src = e.target.result; $("img-preview-wrap").style.display = "block"; };
  reader.readAsDataURL(file);
}

// ── VOICE INPUT ───────────────────────────────
$("voice-btn").addEventListener("click", () => isListening ? stopVoice() : startVoice());

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $("voice-label").textContent = "Browser not supported. Use Chrome."; return; }
  const langMap = { English: "en-US", Hindi: "hi-IN", Hinglish: "en-IN" };
  recognition = new SR();
  recognition.lang = langMap[currentLanguage] || "en-US";
  recognition.interimResults = true;
  recognition.onstart = () => {
    isListening = true;
    $("voice-btn").classList.add("listening");
    $("voice-label").textContent = "LISTENING...";
    $("voice-transcript").textContent = "";
  };
  recognition.onresult = e => {
    const t = Array.from(e.results).map(r => r[0].transcript).join("");
    $("voice-transcript").textContent = `"${t}"`;
    voiceText = t;
  };
  recognition.onend = () => {
    stopVoice();
    if (voiceText) $("voice-label").textContent = "CAPTURED · HIT COMPILE";
  };
  recognition.onerror = e => {
    stopVoice();
    const msgs = { "no-speech": "No speech detected.", "not-allowed": "Microphone access denied.", "audio-capture": "Microphone not found." };
    $("voice-label").textContent = msgs[e.error] || `Error: ${e.error}`;
  };
  recognition.start();
}
function stopVoice() {
  isListening = false;
  if (recognition) recognition.stop();
  $("voice-btn").classList.remove("listening");
  if (!voiceText) $("voice-label").textContent = "TAP TO SPEAK";
}

// ── COMPILE ───────────────────────────────────
$("compile-btn").addEventListener("click", async () => {
  hideAll(); showLoading();
  // Hide exec panel
  $("exec-panel").style.display = "none";

  try {
    let data;
    if (currentMode === "text") {
      const t = $("text-input").value.trim();
      if (!t) { showError("Please type an instruction first."); return; }
      data = await callApi("/compile", { text: t, language: currentLanguage });
    } else if (currentMode === "voice") {
      if (!voiceText) { showError("Please record voice first."); return; }
      data = await callApi("/compile-voice", { text: voiceText, language: currentLanguage });
    } else if (currentMode === "file") {
      if (!selectedFile) { showError("Please select a .txt file first."); return; }
      const fd = new FormData();
      fd.append("file", selectedFile); fd.append("language", currentLanguage);
      const r = await fetch(`${BACKEND}/compile-file`, { method: "POST", body: fd });
      data = await r.json();
    } else if (currentMode === "image") {
      if (!selectedImage) { showError("Please select an image first."); return; }
      data = await compileImage(selectedImage);
    }
    hideLoading();
    if (data.success) { currentSteps = data.steps; renderOutput(data.steps); }
    else showError(data.error || "Something went wrong.", data.suggestion);
  } catch (err) {
    hideLoading();
    showError("Cannot connect to backend. Is Flask running? (python app.py)");
  }
});

async function callApi(endpoint, body) {
  const r = await fetch(`${BACKEND}${endpoint}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  return r.json();
}
async function compileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const r = await fetch(`${BACKEND}/compile-image`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: e.target.result, mime_type: file.type, language: currentLanguage })
        });
        resolve(await r.json());
      } catch (err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}

// ── RENDER OUTPUT ─────────────────────────────
function renderOutput(steps) {
  hideAll();
  currentCode = steps.code || "";
  $("output-content").style.display = "block";
  $("out-pre").textContent = steps.preprocessed || "";
  renderTokens("out-tokens", steps.tokens || [], false);
  renderTokens("out-mapped", steps.mapped_tokens || [], true);
  $("out-ir").textContent = JSON.stringify(steps.ir, null, 2);
  $("out-code").textContent = currentCode;
  renderFlowchart(steps.flowchart || "");
}

function renderTokens(id, tokens, isMapped) {
  const wrap = $(id); wrap.innerHTML = "";
  const KW = ["ADD","SUB","MUL","DIV","IF","THEN","ELSE","LOOP","TIMES","AND"];
  tokens.forEach(t => {
    const span = document.createElement("span");
    span.className = "tok"; span.textContent = String(t);
    if (KW.includes(String(t).toUpperCase())) span.classList.add("kw");
    else if (!isNaN(t) && t !== "") span.classList.add("num");
    wrap.appendChild(span);
  });
}

function renderFlowchart(dot) {
  const wrap = $("out-flowchart");
  if (!dot) { wrap.innerHTML = '<span style="color:var(--text-dim)">No flowchart.</span>'; return; }
  wrap.innerHTML = '<span style="color:var(--text-muted);font-size:.78rem">Rendering...</span>';
  try {
    new Viz().renderSVGElement(dot)
      .then(svg => { wrap.innerHTML = ""; svg.style.maxWidth = "100%"; wrap.appendChild(svg); })
      .catch(() => { wrap.innerHTML = `<pre style="color:var(--text-muted);font-size:.72rem;white-space:pre-wrap">${dot}</pre>`; });
  } catch {
    wrap.innerHTML = `<pre style="color:var(--text-muted);font-size:.72rem;white-space:pre-wrap">${dot}</pre>`;
  }
}

// ── LIVE CODE EXECUTION ───────────────────────
$("run-btn").addEventListener("click", async () => {
  if (!currentCode) return;
  const panel = $("exec-panel");
  const output = $("exec-output");
  const status = $("exec-status");

  panel.style.display = "block";
  output.textContent = "";
  status.textContent = "Running...";

  if (!pyodideReady) {
    // Fallback — simulate output by evaluating simple expressions
    status.textContent = "Loading Python runtime...";
    try {
      pyodide = await loadPyodide();
      pyodideReady = true;
    } catch {
      status.textContent = "Error";
      output.textContent = "⚠ Python runtime could not load.\nMake sure you have internet connection.\n\nGenerated code:\n\n" + currentCode;
      return;
    }
  }

  try {
    status.textContent = "Running...";
    let captured = "";
    pyodide.globals.set("print", (...args) => {
      captured += args.join(" ") + "\n";
    });

    // Clean code — remove f-string issues for pyodide
    let cleanCode = currentCode
      .replace(/# Auto-generated.*\n/g, '')
      .replace(/# Generated by.*\n/g, '')
      .replace(/# .*\n/g, '');

    await pyodide.runPythonAsync(cleanCode);
    status.textContent = "✓ Done";
    output.textContent = captured || "(No output)";
  } catch (e) {
    status.textContent = "Error";
    output.textContent = "Error: " + e.message;
  }
});

// ── READ ALOUD ────────────────────────────────
$("speak-btn").addEventListener("click", () => {
  if (!currentCode) return;
  if (isSpeaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    $("speak-btn").classList.remove("speaking");
    $("speak-btn").innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Read Aloud`;
    return;
  }

  const lines = currentCode.split('\n')
    .filter(l => !l.startsWith('#') && l.trim())
    .join('. ');

  const utterance = new SpeechSynthesisUtterance(lines);
  utterance.rate = 0.85; utterance.pitch = 1;
  utterance.onend = () => {
    isSpeaking = false;
    $("speak-btn").classList.remove("speaking");
    $("speak-btn").innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Read Aloud`;
  };
  speechSynthesis.speak(utterance);
  isSpeaking = true;
  $("speak-btn").classList.add("speaking");
  $("speak-btn").innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg> Stop`;
});

// ── PDF EXPORT ────────────────────────────────
$("pdf-btn").addEventListener("click", () => {
  if (!currentSteps) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W = 210, margin = 15;
  let y = 20;

  const addTitle = (text, color=[41,65,148]) => {
    doc.setFillColor(...color);
    doc.rect(margin, y-5, W - margin*2, 10, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(11);
    doc.text(text, margin+3, y+2);
    doc.setTextColor(30,30,30);
    y += 12;
  };

  const addText = (text, size=9, color=[50,50,50]) => {
    doc.setFont("helvetica","normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), W - margin*2);
    lines.forEach(line => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 2;
  };

  // Header
  doc.setFillColor(15,12,41);
  doc.rect(0,0,W,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("NL Compiler — Compilation Report", margin, 16);
  doc.setFontSize(9);
  doc.setTextColor(180,180,220);
  doc.text(`Multilingual Natural Language → Python Code Generator  |  ${new Date().toLocaleString()}`, margin, 23);
  y = 36;

  // Input
  addTitle("INPUT");
  addText(currentSteps.input || "");

  // Preprocessed
  addTitle("PREPROCESSED TEXT", [48,100,180]);
  addText(currentSteps.preprocessed || "");

  // Tokens
  addTitle("TOKENS", [80,60,160]);
  addText((currentSteps.tokens || []).join("  |  "));

  // Mapped
  addTitle("MAPPED TOKENS", [80,60,160]);
  addText((currentSteps.mapped_tokens || []).join("  |  "));

  // IR
  addTitle("INTERMEDIATE REPRESENTATION", [40,120,80]);
  addText(JSON.stringify(currentSteps.ir, null, 2));

  // Code
  addTitle("GENERATED PYTHON CODE", [20,100,60]);
  doc.setFont("courier","normal");
  doc.setFontSize(8.5);
  doc.setTextColor(20,80,20);
  const codeLines = (currentSteps.code || "").split('\n');
  codeLines.forEach(line => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  // Footer
  doc.setFillColor(15,12,41);
  doc.rect(0,287,W,10,'F');
  doc.setTextColor(150,150,200);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.text("NL Compiler · Multilingual Natural Language to Python Code Generator", margin, 293);

  doc.save("nl_compiler_report.pdf");
});

// ── COPY ──────────────────────────────────────
$("copy-btn").addEventListener("click", () => {
  navigator.clipboard.writeText($("out-code").textContent).then(() => {
    const btn = $("copy-btn");
    btn.textContent = "Copied ✓"; btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      btn.classList.remove("copied");
    }, 2000);
  });
});

// ── ERROR SUGGESTION ──────────────────────────
function showError(msg, suggestion) {
  hideAll();
  $("err-msg").textContent = msg;
  $("error-state").style.display = "flex";
  $("compile-btn").disabled = false;

  // Check if error contains suggestion
  const didYouMean = msg.match(/Did you mean '(.+?)'\?|kya aap '(.+?)' likhna/i);
  if (didYouMean) {
    const word = didYouMean[1] || didYouMean[2];
    $("suggestion-text").textContent = `'${word}'`;
    $("err-suggestion").style.display = "flex";
    $("suggestion-btn").onclick = () => {
      const ta = $("text-input");
      const current = ta.value;
      // Replace the bad word
      const badWord = msg.match(/Unknown word: '(.+?)'/i)?.[1] ||
                      msg.match(/Samajh nahi aaya: '(.+?)'/i)?.[1];
      if (badWord) ta.value = current.replace(badWord, word);
      $("err-suggestion").style.display = "none";
      $("error-state").style.display = "none";

      // Switch to text mode
      $$(".mode-btn").forEach(b => b.classList.remove("active"));
      $$(".mode-pane").forEach(p => p.classList.remove("active"));
      document.querySelector('[data-mode="text"]').classList.add("active");
      $("pane-text").classList.add("active");
      currentMode = "text";
      ta.focus();
    };
  } else {
    $("err-suggestion").style.display = "none";
  }
}

// ── UI HELPERS ────────────────────────────────
function hideAll() {
  $("placeholder").style.display    = "none";
  $("loading").style.display        = "none";
  $("error-state").style.display    = "none";
  $("output-content").style.display = "none";
}
function showLoading() {
  hideAll();
  $("loading").style.display   = "flex";
  $("compile-btn").disabled    = true;
}
function hideLoading() {
  $("loading").style.display   = "none";
  $("compile-btn").disabled    = false;
}

// ══════════════════════════════════════════════
//  HISTORY PANEL
// ══════════════════════════════════════════════

const MAX_HISTORY = 15;
let compilationHistory = JSON.parse(localStorage.getItem("nl_history") || "[]");

// ── DRAWER OPEN/CLOSE ─────────────────────────
$("history-toggle").addEventListener("click", openHistory);
$("history-close").addEventListener("click", closeHistory);
$("history-overlay").addEventListener("click", closeHistory);

function openHistory() {
  $("history-drawer").classList.add("open");
  $("history-overlay").classList.add("show");
  renderHistory();
}
function closeHistory() {
  $("history-drawer").classList.remove("open");
  $("history-overlay").classList.remove("show");
}

// ── SAVE TO HISTORY ───────────────────────────
function saveToHistory(steps, language, mode) {
  const entry = {
    id:       Date.now(),
    input:    steps.input || "",
    language: language,
    mode:     mode,
    code:     steps.code || "",
    time:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date:     new Date().toLocaleDateString(),
    ops:      countOps(steps.ir || []),
    steps:    steps
  };

  compilationHistory.unshift(entry);
  if (compilationHistory.length > MAX_HISTORY)
    compilationHistory = compilationHistory.slice(0, MAX_HISTORY);

  localStorage.setItem("nl_history", JSON.stringify(compilationHistory));
  updateHistoryBadge();
}

function countOps(ir) {
  return ir.length + " stmt" + (ir.length !== 1 ? "s" : "");
}

function updateHistoryBadge() {
  const n = compilationHistory.length;
  $("history-count").textContent = `${n} compilation${n !== 1 ? "s" : ""} saved`;
}

// ── RENDER HISTORY LIST ───────────────────────
function renderHistory() {
  const list = $("history-list");
  updateHistoryBadge();

  if (compilationHistory.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">🕐</div>
        <div>No history yet.<br/>Compile something first!</div>
      </div>`;
    return;
  }

  list.innerHTML = compilationHistory.map((entry, idx) => `
    <div class="history-item" data-idx="${idx}">
      <button class="hi-del" data-idx="${idx}" title="Delete">✕</button>
      <div class="hi-top">
        <div class="hi-input" title="${entry.input}">${entry.input}</div>
        <div class="hi-time">${entry.date} ${entry.time}</div>
      </div>
      <div class="hi-meta">
        <span class="hi-badge lang">${entry.language}</span>
        <span class="hi-badge mode">${entry.mode}</span>
        <span class="hi-badge ops">${entry.ops}</span>
      </div>
    </div>
  `).join("");

  // Click to restore
  list.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", e => {
      if (e.target.classList.contains("hi-del")) return;
      const idx = parseInt(item.dataset.idx);
      restoreFromHistory(compilationHistory[idx]);
    });
  });

  // Delete individual
  list.querySelectorAll(".hi-del").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      compilationHistory.splice(idx, 1);
      localStorage.setItem("nl_history", JSON.stringify(compilationHistory));
      renderHistory();
    });
  });
}

// ── RESTORE ───────────────────────────────────
function restoreFromHistory(entry) {
  closeHistory();

  // Set language
  $$(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === entry.language);
  });
  currentLanguage = entry.language;

  // Set text input
  $$(".mode-btn").forEach(b => b.classList.remove("active"));
  $$(".mode-pane").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-mode="text"]').classList.add("active");
  $("pane-text").classList.add("active");
  currentMode = "text";
  $("text-input").value = entry.input;

  // Render output
  currentSteps = entry.steps;
  currentCode  = entry.code;
  renderOutput(entry.steps);
}

// ── CLEAR ALL ─────────────────────────────────
$("clear-all-btn").addEventListener("click", () => {
  if (confirm("Saari history delete karein?")) {
    compilationHistory = [];
    localStorage.removeItem("nl_history");
    renderHistory();
  }
});

// ── HOOK INTO COMPILE ─────────────────────────
// Original renderOutput ko wrap karo
const _origRenderOutput = renderOutput;
window.renderOutput = function(steps) {
  _origRenderOutput(steps);
  saveToHistory(steps, currentLanguage, currentMode);
};

// Init badge on load
updateHistoryBadge();
