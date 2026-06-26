const defaultSchema = `Employee(EmpID INT PRIMARY KEY, EmpName VARCHAR(100), Salary DECIMAL, Department VARCHAR(80), JoiningDate DATE) -- rows: 250
Students(id INT PRIMARY KEY, name VARCHAR(100), cgpa DECIMAL, department VARCHAR(80), semester INT) -- rows: 1200
Orders(id INT PRIMARY KEY, customer_id INT, order_date DATE, amount DECIMAL, status VARCHAR(40)) -- rows: 5400
Customers(id INT PRIMARY KEY, name VARCHAR(100), city VARCHAR(80), email VARCHAR(120)) -- rows: 900
Products(id INT PRIMARY KEY, name VARCHAR(100), category VARCHAR(80), price DECIMAL, stock INT) -- rows: 450
Departments(id INT PRIMARY KEY, name VARCHAR(80), manager_id INT) -- rows: 12`;

const examples = [
  "Show all employees whose salary is greater than 50000.",
  "Find the top 5 students with highest CGPA.",
  "Increase salary of all employees in IT department by 10%.",
  "Find dense rank and row number for employee salaries.",
  "Show the highest earned employee.",
  "Delete cancelled orders older than 2024-01-01.",
  "Show customers from Mumbai with their orders.",
  "Add a new product named Keyboard in Electronics category with price 1200 and stock 50."
];

const demoData = {
  employee: [
    { EmpID: 101, EmpName: "Aarav Mehta", Salary: 95000, Department: "IT", JoiningDate: "2021-04-12" },
    { EmpID: 102, EmpName: "Neha Rao", Salary: 87000, Department: "Finance", JoiningDate: "2020-08-20" },
    { EmpID: 103, EmpName: "Kabir Shah", Salary: 95000, Department: "IT", JoiningDate: "2019-01-15" },
    { EmpID: 104, EmpName: "Isha Nair", Salary: 62000, Department: "HR", JoiningDate: "2022-11-03" },
    { EmpID: 105, EmpName: "Rohan Das", Salary: 51000, Department: "IT", JoiningDate: "2023-06-27" },
    { EmpID: 106, EmpName: "Maya Singh", Salary: 47000, Department: "Sales", JoiningDate: "2024-02-10" }
  ],
  students: [
    { id: 1, name: "Anaya", cgpa: 9.8, department: "CSE", semester: 6 },
    { id: 2, name: "Dev", cgpa: 9.4, department: "ECE", semester: 6 },
    { id: 3, name: "Sara", cgpa: 9.1, department: "CSE", semester: 4 },
    { id: 4, name: "Vihaan", cgpa: 8.9, department: "ME", semester: 5 },
    { id: 5, name: "Tara", cgpa: 8.7, department: "CSE", semester: 3 }
  ],
  customers: [
    { id: 201, name: "Priya Kapoor", city: "Mumbai", email: "priya@example.com" },
    { id: 202, name: "Arjun Sen", city: "Delhi", email: "arjun@example.com" },
    { id: 203, name: "Nisha Patel", city: "Mumbai", email: "nisha@example.com" }
  ],
  orders: [
    { id: 301, customer_id: 201, order_date: "2025-02-11", amount: 4200, status: "Completed" },
    { id: 302, customer_id: 203, order_date: "2025-05-19", amount: 1800, status: "Pending" },
    { id: 303, customer_id: 202, order_date: "2023-12-01", amount: 900, status: "Cancelled" }
  ],
  products: [
    { id: 401, name: "Keyboard", category: "Electronics", price: 1200, stock: 50 },
    { id: 402, name: "Monitor", category: "Electronics", price: 9800, stock: 18 }
  ]
};

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
  const preview = simulateExecution(option);
  els.executionResult.innerHTML = `<strong>${resultText}</strong><span>${option.risk}</span>${preview}`;
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
    const rankingSql = createRankingSql(lower, table);
    const selectSql = rankingSql || createSelectSql(lower, table, secondary, dialect);
    options.push(createOption(rankingSql ? "Window function ranking" : "Recommended SELECT", selectSql, "select", table, secondary, lower));
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
  const limit = extractLimit(lower) || inferSingleResultLimit(lower, table);
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

function createRankingSql(lower, table) {
  if (!/\b(rank|dense rank|row number|row_number|dense_rank)\b/.test(lower)) return null;
  const orderColumn = findColumn(table, ["Salary", "salary", "cgpa", "amount", "price"]) || findMentionedColumn(lower, table) || table.columns[0];
  const baseColumns = preferredDisplayColumns(table, orderColumn);
  const rankingColumns = [];
  if (/\bdense rank|dense_rank\b/.test(lower)) {
    rankingColumns.push(`DENSE_RANK() OVER (ORDER BY ${orderColumn} DESC) AS dense_rank_no`);
  }
  if (/\brow number|row_number\b/.test(lower)) {
    rankingColumns.push(`ROW_NUMBER() OVER (ORDER BY ${orderColumn} DESC) AS row_no`);
  }
  if (rankingColumns.length === 0) {
    rankingColumns.push(`RANK() OVER (ORDER BY ${orderColumn} DESC) AS rank_no`);
  }
  return `SELECT ${baseColumns.concat(rankingColumns).join(", ")}\nFROM ${table.name};`;
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

function inferSingleResultLimit(lower, table) {
  const asksForOne = /\b(highest|maximum|max|largest|top earned|highest earned|highest paid|best paid)\b/.test(lower);
  const isEmployeeSalary = table.name.toLowerCase() === "employee" && /\b(earned|paid|salary|salaries|employee)\b/.test(lower);
  return asksForOne && isEmployeeSalary ? 1 : null;
}

function extractOrder(lower, table) {
  const highestColumn = inferOrderColumn(lower, table) || findMentionedColumn(lower, table);
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

  const dept = lower.match(/\b(?:department|dept)\s+(?:is|=|equals|in)\s*['"]?([a-z ]+)['"]?/i);
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
  const normalized = names.map((name) => name.toLowerCase());
  return table.columns.find((column) => normalized.includes(column.toLowerCase()));
}

function inferOrderColumn(lower, table) {
  if (table.name.toLowerCase() === "employee" && /\b(earned|paid|salary|salaries)\b/.test(lower)) {
    return findColumn(table, ["salary"]);
  }
  return null;
}

function preferredDisplayColumns(table, orderColumn) {
  if (table.name.toLowerCase() === "employee") {
    return [
      findColumn(table, ["empid", "id"]),
      findColumn(table, ["empname", "name"]),
      orderColumn
    ].filter(Boolean);
  }
  return table.columns.slice(0, 3);
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
  if (/\bDENSE_RANK\(\)|\bROW_NUMBER\(\)|\bRANK\(\)/i.test(sql)) {
    return `Reads records from ${table.name} and calculates ranking values with SQL window functions. DENSE_RANK gives the same rank to equal values, while ROW_NUMBER assigns a unique sequence number.`;
  }
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

function simulateExecution(option) {
  if (option.intent !== "select") {
    return `<p class="demo-note">No real database is connected. This is a safe simulation only.</p>`;
  }

  const tableKey = option.table.name.toLowerCase();
  let rows = [...(demoData[tableKey] || [])];
  if (rows.length === 0) {
    return `<p class="demo-note">No local demo rows are available for this table. Connect a database backend to display live authorized data.</p>`;
  }

  rows = applyDemoFilters(rows, option.sql);
  rows = applyDemoOrdering(rows, option.sql);
  rows = applyDemoWindowFunctions(rows, option.sql);
  rows = applyDemoLimit(rows, option.sql);
  rows = projectDemoRows(rows, option.sql);
  return `<p class="demo-note">Preview uses local demo data only. No real database or unauthorized records are accessed.</p>${renderResultTable(rows)}`;
}

function applyDemoFilters(rows, sql) {
  const salaryGreater = sql.match(/\bSalary\s*>\s*(\d+)/i);
  if (salaryGreater) rows = rows.filter((row) => Number(row.Salary) > Number(salaryGreater[1]));

  const department = sql.match(/\bDepartment\s*=\s*'([^']+)'/i);
  if (department) rows = rows.filter((row) => String(row.Department || "").toLowerCase() === department[1].toLowerCase());

  const city = sql.match(/\bcity\s*=\s*'([^']+)'/i);
  if (city) rows = rows.filter((row) => String(row.city || "").toLowerCase() === city[1].toLowerCase());

  return rows;
}

function applyDemoOrdering(rows, sql) {
  const order = sql.match(/\bORDER BY\s+([a-z_][\w]*)\s+(ASC|DESC)/i);
  if (!order) return rows;
  const [, column, direction] = order;
  return [...rows].sort((a, b) => {
    const left = a[column];
    const right = b[column];
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
    return direction.toUpperCase() === "DESC" ? -comparison : comparison;
  });
}

function applyDemoWindowFunctions(rows, sql) {
  const windowOrder = sql.match(/OVER\s*\(\s*ORDER BY\s+([a-z_][\w]*)\s+DESC\s*\)/i);
  if (!windowOrder) return rows;
  const column = windowOrder[1];
  const sorted = [...rows].sort((a, b) => Number(b[column]) - Number(a[column]));
  let denseRank = 0;
  let previousValue;
  return sorted.map((row, index) => {
    if (row[column] !== previousValue) {
      denseRank += 1;
      previousValue = row[column];
    }
    const ranked = { ...row };
    if (/\bDENSE_RANK\(\)/i.test(sql)) ranked.dense_rank_no = denseRank;
    if (/\bROW_NUMBER\(\)/i.test(sql)) ranked.row_no = index + 1;
    return ranked;
  });
}

function applyDemoLimit(rows, sql) {
  const limit = sql.match(/\bLIMIT\s+(\d+)/i);
  return limit ? rows.slice(0, Number(limit[1])) : rows;
}

function projectDemoRows(rows, sql) {
  if (/\bSELECT\s+\*/i.test(sql)) return rows;
  const select = sql.match(/\bSELECT\s+([\s\S]+?)\s+FROM\b/i);
  if (!select) return rows;
  const columns = select[1]
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const alias = part.match(/\s+AS\s+([a-z_][\w]*)$/i);
      if (alias) return alias[1];
      return part.replace(/^.*\./, "");
    })
    .filter((column) => !/\(|\)/.test(column));
  if (columns.length === 0) return rows;
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
}

function renderResultTable(rows) {
  if (rows.length === 0) return `<p class="demo-note">No demo rows match this query.</p>`;
  const columns = Object.keys(rows[0]);
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(String(row[column]))}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
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
