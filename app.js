const defaultSchema = `Employee(id INT PRIMARY KEY, name VARCHAR(100), salary DECIMAL, department VARCHAR(80), joining_date DATE) -- rows: 250
Students(id INT PRIMARY KEY, name VARCHAR(100), cgpa DECIMAL, department VARCHAR(80), semester INT) -- rows: 1200
Orders(id INT PRIMARY KEY, customer_id INT, order_date DATE, amount DECIMAL, status VARCHAR(40)) -- rows: 5400
Customers(id INT PRIMARY KEY, name VARCHAR(100), city VARCHAR(80), email VARCHAR(120)) -- rows: 900
Products(id INT PRIMARY KEY, name VARCHAR(100), category VARCHAR(80), price DECIMAL, stock INT) -- rows: 450
Departments(id INT PRIMARY KEY, name VARCHAR(80), manager_id INT) -- rows: 12`;

const examples = [
  "Show all employees whose salary is greater than 50000.",
  "Find the top 5 students with highest CGPA.",
  "Increase salary of all employees in IT department by 10%.",
  "Delete cancelled orders older than 2024-01-01.",
  "Show customers from Mumbai with their orders.",
  "Add a new product named Keyboard in Electronics category with price 1200 and stock 50."
];

if (typeof document === "undefined") {
  console.log("This is a browser app. Open index.html in your browser to use the SQL assistant.");
  process.exit(0);
}

const storage = typeof localStorage === "undefined"
  ? { getItem: () => null, setItem: () => {} }
  : localStorage;

const state = {
  dialect: "mysql",
  options: [],
  selectedIndex: 0,
  history: JSON.parse(storage.getItem("sqlAssistantHistory") || "[]")
};

const els = {
  promptInput: document.querySelector("#promptInput"),
  schemaInput: document.querySelector("#schemaInput"),
  generateQuery: document.querySelector("#generateQuery"),
  loadExample: document.querySelector("#loadExample"),
  resetSchema: document.querySelector("#resetSchema"),
  clearHistory: document.querySelector("#clearHistory"),
  queryOptions: document.querySelector("#queryOptions"),
  selectedSql: document.querySelector("#selectedSql"),
  queryExplanation: document.querySelector("#queryExplanation"),
  entityList: document.querySelector("#entityList"),
  impactBox: document.querySelector("#impactBox"),
  validationList: document.querySelector("#validationList"),
  executionResult: document.querySelector("#executionResult"),
  historyList: document.querySelector("#historyList"),
  copySql: document.querySelector("#copySql"),
  executeSql: document.querySelector("#executeSql")
};

els.schemaInput.value = defaultSchema;

document.querySelectorAll(".dialect").forEach((button) => {
  button.addEventListener("click", () => {
    state.dialect = button.dataset.dialect;
    document.querySelectorAll(".dialect").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    if (state.options.length > 0) {
      generate();
    }
  });
});

els.generateQuery.addEventListener("click", generate);
els.loadExample.addEventListener("click", () => {
  const current = examples.indexOf(els.promptInput.value.trim());
  els.promptInput.value = examples[(current + 1) % examples.length];
  generate();
});
els.resetSchema.addEventListener("click", () => {
  els.schemaInput.value = defaultSchema;
  generate();
});
els.clearHistory.addEventListener("click", () => {
  state.history = [];
  saveHistory();
  renderHistory();
});
els.copySql.addEventListener("click", async () => {
  const option = state.options[state.selectedIndex];
  if (!option) return;
  await navigator.clipboard.writeText(option.sql);
  els.copySql.textContent = "Copied";
  setTimeout(() => {
    els.copySql.textContent = "Copy";
  }, 1200);
});
els.executeSql.addEventListener("click", () => {
  const option = state.options[state.selectedIndex];
  if (!option) return;
  const impact = option.impact;
  const resultText = option.intent === "select"
    ? `Simulation complete: ${impact.estimatedRows} row(s) returned.`
    : `Simulation complete: ${impact.estimatedRows} row(s) would be affected.`;
  els.executionResult.innerHTML = `<strong>${resultText}</strong><span>${option.risk}</span>`;
  addHistory(option);
});

function generate() {
  const schema = parseSchema(els.schemaInput.value);
  const prompt = normalizePrompt(els.promptInput.value);
  state.options = buildQueryOptions(prompt, schema, state.dialect);
  state.selectedIndex = 0;
  renderOptions();
  renderSelected();
}

function normalizePrompt(value) {
  return value.trim().replace(/\s+/g, " ");
}

function parseSchema(schemaText) {
  return schemaText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const rowMatch = line.match(/rows:\s*(\d+)/i);
      const tableMatch = line.match(/^([a-z_][\w]*)\s*\((.+)\)/i);
      if (!tableMatch) return null;
      const columns = tableMatch[2]
        .split(",")
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean);
      return {
        name: tableMatch[1],
        columns,
        rowCount: rowMatch ? Number(rowMatch[1]) : 1000
      };
    })
    .filter(Boolean);
}

function buildQueryOptions(prompt, schema, dialect) {
  if (!prompt) {
    return [fallbackOption("Please enter a natural language requirement.", schema)];
  }

  const lower = prompt.toLowerCase();
  const intent = detectIntent(lower);
  const table = findBestTable(lower, schema);
  const secondary = findJoinTable(lower, schema, table);
  const columns = table?.columns || ["id", "name"];

  if (!table) {
    return [fallbackOption("No matching table was found in the schema.", schema)];
  }

  const options = [];
  if (intent === "select") {
    const selectSql = createSelectSql(lower, table, secondary, dialect);
    options.push(createOption("Recommended SELECT", selectSql, "select", table, secondary, lower));
    if (!secondary && schema.length > 1) {
      const alt = `SELECT ${columns.join(", ")}\nFROM ${table.name};`;
      options.push(createOption("Broad table scan", alt, "select", table, null, lower));
    }
  }

  if (intent === "update") {
    const updateSql = createUpdateSql(lower, table);
    options.push(createOption("Filtered UPDATE", updateSql, "update", table, null, lower));
    options.push(createOption("Preview affected rows", updateSql.replace(/^UPDATE[\s\S]+?WHERE/i, `SELECT *\nFROM ${table.name}\nWHERE`), "select", table, null, lower));
  }

  if (intent === "delete") {
    const deleteSql = createDeleteSql(lower, table);
    options.push(createOption("Filtered DELETE", deleteSql, "delete", table, null, lower));
    options.push(createOption("Preview rows before delete", deleteSql.replace(/^DELETE FROM/i, "SELECT *\nFROM").replace(/;$/, ";"), "select", table, null, lower));
  }

  if (intent === "insert") {
    options.push(createOption("INSERT row", createInsertSql(lower, table), "insert", table, null, lower));
  }

  return options;
}

function detectIntent(lower) {
  if (/\b(increase|decrease|update|change|modify|set)\b/.test(lower)) return "update";
  if (/\b(delete|remove)\b/.test(lower)) return "delete";
  if (/\b(add|insert|create new)\b/.test(lower)) return "insert";
  return "select";
}

function findBestTable(lower, schema) {
  let best = null;
  let bestScore = -1;
  schema.forEach((table) => {
    const singular = table.name.toLowerCase().replace(/s$/, "");
    const pluralY = singular.endsWith("y") ? `${singular.slice(0, -1)}ies` : `${singular}s`;
    let score = lower.includes(table.name.toLowerCase()) || lower.includes(singular) ? 8 : 0;
    if (lower.includes(pluralY)) score += 8;
    const position = lower.indexOf(table.name.toLowerCase()) >= 0 ? lower.indexOf(table.name.toLowerCase()) : lower.indexOf(pluralY);
    if (position >= 0) score += Math.max(0, 5 - Math.floor(position / 12));
    table.columns.forEach((column) => {
      if (lower.includes(column.toLowerCase().replace("_", " "))) score += 2;
    });
    if (score > bestScore) {
      best = table;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : schema[0];
}

function findJoinTable(lower, schema, primary) {
  if (!primary || !/\b(with|and their|along with|join)\b/.test(lower)) return null;
  return schema.find((table) => table.name !== primary.name && lower.includes(table.name.toLowerCase().replace(/s$/, ""))) || null;
}

function createSelectSql(lower, table, secondary, dialect) {
  const limit = extractLimit(lower);
  const order = extractOrder(lower, table);
  const where = extractWhere(lower, table);
  const limitClause = limit ? `\nLIMIT ${limit}` : "";

  if (secondary) {
    const joinKey = `${table.name.toLowerCase().replace(/s$/, "")}_id`;
    const reverseKey = `${secondary.name.toLowerCase().replace(/s$/, "")}_id`;
    const onClause = secondary.columns.includes(joinKey)
      ? `${secondary.name}.${joinKey} = ${table.name}.id`
      : table.columns.includes(reverseKey)
        ? `${table.name}.${reverseKey} = ${secondary.name}.id`
        : `${secondary.name}.id = ${table.name}.id`;
    return `SELECT ${table.name}.*, ${secondary.name}.*\nFROM ${table.name}\nJOIN ${secondary.name} ON ${onClause}${where ? `\nWHERE ${where}` : ""}${order}${limitClause};`;
  }

  return `SELECT *\nFROM ${table.name}${where ? `\nWHERE ${where}` : ""}${order}${limitClause};`;
}

function createUpdateSql(lower, table) {
  const percentage = extractNumberBefore(lower, "%") || 10;
  const numericColumn = findColumn(table, ["salary", "price", "amount", "stock"]) || table.columns[1];
  const where = extractWhere(lower, table) || "id IS NOT NULL";
  const multiplier = /\b(decrease|reduce)\b/.test(lower) ? (1 - percentage / 100).toFixed(2) : (1 + percentage / 100).toFixed(2);
  return `UPDATE ${table.name}\nSET ${numericColumn} = ${numericColumn} * ${multiplier}\nWHERE ${where};`;
}

function createDeleteSql(lower, table) {
  const where = extractWhere(lower, table) || "id IS NOT NULL";
  return `DELETE FROM ${table.name}\nWHERE ${where};`;
}

function createInsertSql(lower, table) {
  const usableColumns = table.columns.filter((column) => !/^id$/i.test(column)).slice(0, 4);
  const values = usableColumns.map((column) => inferValueForColumn(lower, column));
  return `INSERT INTO ${table.name} (${usableColumns.join(", ")})\nVALUES (${values.join(", ")});`;
}

function extractLimit(lower) {
  const match = lower.match(/\btop\s+(\d+)|\blimit\s+(\d+)|\bfirst\s+(\d+)/);
  return match ? Number(match[1] || match[2] || match[3]) : null;
}

function extractOrder(lower, table) {
  const highestColumn = findMentionedColumn(lower, table);
  if (!highestColumn) return "";
  if (/\b(highest|top|maximum|max|descending)\b/.test(lower)) return `\nORDER BY ${highestColumn} DESC`;
  if (/\b(lowest|minimum|min|ascending)\b/.test(lower)) return `\nORDER BY ${highestColumn} ASC`;
  return "";
}

function extractWhere(lower, table) {
  const filters = [];
  table.columns.forEach((column) => {
    const label = column.toLowerCase().replace("_", " ");
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const comparison = lower.match(new RegExp(`${escaped}\\s+(?:is\\s+)?(?:greater than|more than|above|over)\\s+([\\d.]+)`, "i"));
    if (comparison) filters.push(`${column} > ${comparison[1]}`);

    const less = lower.match(new RegExp(`${escaped}\\s+(?:is\\s+)?(?:less than|below|under)\\s+([\\d.]+)`, "i"));
    if (less) filters.push(`${column} < ${less[1]}`);

    const exact = lower.match(new RegExp(`${escaped}\\s+(?:is|=|equals|named|in)\\s+['"]?([a-z0-9 _-]+)['"]?`, "i"));
    if (exact && !/greater|less|top|highest|lowest/.test(exact[1])) {
      filters.push(`${column} = '${titleCase(exact[1].trim())}'`);
    }
  });

  const dept = lower.match(/\b(?:department|dept)\s+(?:is|=|equals|in)?\s*['"]?([a-z ]+)['"]?/i);
  if (dept && table.columns.some((column) => column.toLowerCase() === "department")) {
    filters.push(`department = '${titleCase(dept[1].trim())}'`);
  }

  const deptBefore = lower.match(/\bin\s+([a-z ]+)\s+(?:department|dept)\b/i);
  if (deptBefore && table.columns.some((column) => column.toLowerCase() === "department")) {
    filters.push(`department = '${titleCase(deptBefore[1].trim())}'`);
  }

  const city = lower.match(/\b(?:from|in)\s+([a-z ]+)\b/i);
  if (city && table.columns.some((column) => column.toLowerCase() === "city")) {
    filters.push(`city = '${titleCase(city[1].replace(/\bwith\b.+$/i, "").trim())}'`);
  }

  const status = lower.match(/\b(cancelled|canceled|pending|completed|shipped)\b/i);
  if (status && table.columns.some((column) => column.toLowerCase() === "status")) {
    filters.push(`status = '${titleCase(status[1])}'`);
  }

  const date = lower.match(/\bolder than\s+(\d{4}-\d{2}-\d{2})/i);
  const dateColumn = findColumn(table, ["order_date", "joining_date", "created_at", "date"]);
  if (date && dateColumn) filters.push(`${dateColumn} < '${date[1]}'`);

  return [...new Set(filters)].join(" AND ");
}

function extractNumberBefore(lower, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`));
  return match ? Number(match[1]) : null;
}

function findMentionedColumn(lower, table) {
  return table.columns.find((column) => lower.includes(column.toLowerCase().replace("_", " "))) || null;
}

function findColumn(table, names) {
  return table.columns.find((column) => names.includes(column.toLowerCase()));
}

function inferValueForColumn(lower, column) {
  const label = column.toLowerCase();
  const named = lower.match(/\bnamed\s+([a-z0-9 _-]+)/i);
  if (label.includes("name") && named) return `'${titleCase(named[1].replace(/\bin\b.+$/i, "").trim())}'`;
  if (label.includes("category")) {
    const category = lower.match(/\bin\s+([a-z ]+)\s+category/i);
    return category ? `'${titleCase(category[1].trim())}'` : "'General'";
  }
  if (label.includes("price") || label.includes("salary") || label.includes("amount")) {
    const amount = lower.match(/\bprice\s+(\d+)|\bsalary\s+(\d+)|\bamount\s+(\d+)/i);
    return amount ? (amount[1] || amount[2] || amount[3]) : "0";
  }
  if (label.includes("stock") || label.includes("semester")) {
    const number = lower.match(/\bstock\s+(\d+)|\bsemester\s+(\d+)/i);
    return number ? (number[1] || number[2]) : "1";
  }
  if (label.includes("date")) return "CURRENT_DATE";
  return "'Value'";
}

function createOption(title, sql, intent, table, secondary, prompt) {
  const impact = estimateImpact(intent, table, sql);
  const validation = validateSql(sql, intent);
  return {
    title,
    sql,
    intent,
    table,
    secondary,
    impact,
    validation,
    explanation: explainQuery(sql, intent, table, secondary),
    risk: riskText(intent, sql, impact)
  };
}

function estimateImpact(intent, table, sql) {
  const hasWhere = /\bWHERE\b/i.test(sql);
  const limit = sql.match(/\bLIMIT\s+(\d+)/i);
  if (intent === "insert") return { estimatedRows: 1, label: "1 row will be inserted." };
  if (limit) return { estimatedRows: Number(limit[1]), label: `${limit[1]} row(s) may be returned.` };
  const factor = hasWhere ? 0.17 : 1;
  const estimatedRows = Math.max(1, Math.round(table.rowCount * factor));
  const action = intent === "select" ? "returned" : "modified";
  return { estimatedRows, label: `Approximately ${estimatedRows} row(s) may be ${action}.` };
}

function validateSql(sql, intent) {
  const checks = [];
  checks.push(sql.trim().endsWith(";") ? ok("SQL statement ends with a semicolon.") : warn("Add a semicolon at the end."));
  checks.push(/\bFROM\b|\bUPDATE\b|\bINSERT INTO\b/i.test(sql) ? ok("Statement references a table.") : warn("No table reference detected."));
  if (["update", "delete"].includes(intent)) {
    checks.push(/\bWHERE\b/i.test(sql) ? ok("Risk control: WHERE clause is present.") : danger("Risky operation: missing WHERE clause."));
  }
  if (/\bSELECT \*/i.test(sql)) {
    checks.push(warn("SELECT * is convenient, but named columns are often faster and clearer."));
  } else {
    checks.push(ok("Column selection is explicit."));
  }
  return checks;
}

function explainQuery(sql, intent, table, secondary) {
  const subject = secondary ? `${table.name} joined with ${secondary.name}` : table.name;
  if (intent === "select") return `Reads records from ${subject}. Filters, sorting, and limits are applied when present so the result matches the request.`;
  if (intent === "update") return `Updates records in ${table.name}. The SET clause changes column values, and the WHERE clause restricts which rows are modified.`;
  if (intent === "delete") return `Deletes records from ${table.name}. The WHERE clause identifies which rows should be removed.`;
  return `Creates a new row in ${table.name} using the listed columns and values.`;
}

function riskText(intent, sql, impact) {
  if (["update", "delete"].includes(intent) && !/\bWHERE\b/i.test(sql)) return "High risk: this can affect every row.";
  if (["update", "delete"].includes(intent)) return `Review before execution: ${impact.label}`;
  return impact.label;
}

function fallbackOption(message, schema) {
  const table = schema[0] || { name: "UnknownTable", columns: ["id"], rowCount: 0 };
  return createOption("Needs schema match", `-- ${message}\nSELECT *\nFROM ${table.name};`, "select", table, null, "");
}

function renderOptions() {
  els.queryOptions.innerHTML = "";
  state.options.forEach((option, index) => {
    const card = document.createElement("article");
    card.className = `query-card${index === state.selectedIndex ? " selected" : ""}`;
    card.innerHTML = `
      <header>
        <span class="query-title">${option.title}</span>
        <span class="badge ${badgeClass(option.intent, option.sql)}">${option.intent.toUpperCase()}</span>
      </header>
      <pre class="code-block">${escapeHtml(option.sql)}</pre>
      <button type="button" class="secondary">Select</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      state.selectedIndex = index;
      renderOptions();
      renderSelected();
    });
    els.queryOptions.appendChild(card);
  });
}

function renderSelected() {
  const option = state.options[state.selectedIndex];
  if (!option) return;
  els.selectedSql.textContent = option.sql;
  els.queryExplanation.textContent = option.explanation;
  els.entityList.innerHTML = [option.table, option.secondary]
    .filter(Boolean)
    .map((table) => `<div class="entity-item"><strong>${table.name}</strong><span>${table.columns.join(", ")}</span></div>`)
    .join("");
  els.impactBox.innerHTML = `<strong>${option.impact.label}</strong><span>${option.risk}</span>`;
  els.validationList.innerHTML = option.validation
    .map((item) => `<li class="${item.level}">${item.text}</li>`)
    .join("");
}

function renderHistory() {
  if (state.history.length === 0) {
    els.historyList.innerHTML = `<p class="muted">No saved query history yet.</p>`;
    return;
  }
  els.historyList.innerHTML = state.history
    .slice(0, 6)
    .map((item) => `<div class="history-item"><strong>${item.intent.toUpperCase()}</strong><span>${escapeHtml(item.sql)}</span></div>`)
    .join("");
}

function addHistory(option) {
  state.history.unshift({ intent: option.intent, sql: option.sql, createdAt: new Date().toISOString() });
  state.history = state.history.slice(0, 20);
  saveHistory();
  renderHistory();
}

function saveHistory() {
  storage.setItem("sqlAssistantHistory", JSON.stringify(state.history));
}

function badgeClass(intent, sql) {
  if (["update", "delete"].includes(intent) && !/\bWHERE\b/i.test(sql)) return "danger";
  if (["update", "delete"].includes(intent)) return "warning";
  return "";
}

function ok(text) {
  return { level: "ok", text };
}

function warn(text) {
  return { level: "warn", text };
}

function danger(text) {
  return { level: "danger-text", text };
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

generate();
renderHistory();
