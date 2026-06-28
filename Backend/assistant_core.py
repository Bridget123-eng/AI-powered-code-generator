import ast
import math
import re
from datetime import datetime


ARITHMETIC_TEMPLATES = {
    "factorial": """def factorial(n):
    if n < 0:
        raise ValueError("factorial is not defined for negative numbers")
    if n in (0, 1):
        return 1
    result = 1
    for value in range(2, n + 1):
        result *= value
    return result""",
    "fibonacci": """def fibonacci(n):
    if n < 0:
        raise ValueError("n must be non-negative")
    sequence = []
    a, b = 0, 1
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence""",
    "prime": """def is_prime(n):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    divisor = 5
    while divisor * divisor <= n:
        if n % divisor == 0 or n % (divisor + 2) == 0:
            return False
        divisor += 6
    return True""",
}


DEFAULT_SCHEMA = {
    "Employee": {
        "columns": ["ID", "Name", "Salary", "Department"],
        "rows": 250,
    },
    "Students": {
        "columns": ["ID", "Name", "CGPA", "Semester"],
        "rows": 1200,
    },
}


def generate_code_from_prompt(prompt):
    clean_prompt = (prompt or "").strip()
    lowered = clean_prompt.lower()

    if not clean_prompt:
        raise ValueError("Prompt is required.")

    if "sql" in lowered or _looks_like_sql_request(lowered):
        sql_result = generate_sql(clean_prompt)
        return sql_result["options"][0]["query"]

    for keyword, code in ARITHMETIC_TEMPLATES.items():
        if keyword in lowered:
            return code

    name = _function_name_from_prompt(lowered)
    return f'''def {name}(*args, **kwargs):
    """Generated starter function for: {clean_prompt}"""
    # TODO: Add the exact business logic for this requirement.
    return {{
        "requirement": {clean_prompt!r},
        "args": args,
        "kwargs": kwargs,
    }}'''


def explain_code(code):
    code = (code or "").strip()
    if not code:
        return "No code was provided to explain."

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"The code has a syntax error before it can be explained: {exc.msg} at line {exc.lineno}."

    notes = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            notes.append(f"Defines function `{node.name}` with {len(node.args.args)} positional parameter(s).")
        elif isinstance(node, ast.ClassDef):
            notes.append(f"Defines class `{node.name}`.")
        elif isinstance(node, ast.Import):
            names = ", ".join(alias.name for alias in node.names)
            notes.append(f"Imports module(s): {names}.")
        elif isinstance(node, ast.Assign):
            notes.append("Assigns a value to one or more variables.")
        elif isinstance(node, ast.Expr):
            notes.append("Runs an expression or function call.")

    return "\n".join(notes or ["The code is valid Python."])


def debug_code(code):
    code = (code or "").strip()
    if not code:
        return {
            "status": "Error",
            "message": "No code was provided.",
            "suggestions": ["Paste Python source code before running debug."],
        }

    try:
        ast.parse(code)
    except SyntaxError as exc:
        return {
            "status": "Error",
            "message": f"{exc.msg} at line {exc.lineno}, column {exc.offset}.",
            "suggestions": [
                "Check indentation, missing colons, unclosed brackets, and quote pairs.",
                "Run the corrected code again after fixing the reported line.",
            ],
        }

    suggestions = []
    if "except:" in code:
        suggestions.append("Avoid bare `except:`; catch a specific exception type.")
    if "eval(" in code or "exec(" in code:
        suggestions.append("Avoid `eval` and `exec` unless input is fully trusted.")
    if "print(" not in code and "return " not in code:
        suggestions.append("Consider returning a value or printing output so behavior is visible.")

    return {
        "status": "OK",
        "message": "No Python syntax errors found.",
        "suggestions": suggestions or ["Code parses successfully."],
    }


def optimize_code(code):
    code = (code or "").strip()
    if not code:
        return {
            "optimized": "",
            "suggestions": ["No code was provided to optimize."],
        }

    suggestions = []
    if "+=" not in code and re.search(r"\w+\s*=\s*\w+\s*\+", code):
        suggestions.append("Use augmented assignment such as `total += value` where appropriate.")
    if "for " in code and ".append(" in code:
        suggestions.append("For simple transformations, consider a list comprehension.")
    if "range(len(" in code:
        suggestions.append("Prefer `enumerate()` or direct iteration instead of indexing with `range(len(...))`.")
    if not suggestions:
        suggestions.append("The code is already simple; focus optimization on measured bottlenecks.")

    return {
        "optimized": code,
        "suggestions": suggestions,
    }


def review_code(code):
    debug = debug_code(code)
    issues = []
    if debug["status"] != "OK":
        issues.append(debug["message"])
    issues.extend(debug.get("suggestions", []))
    return {
        "quality": "Needs attention" if debug["status"] != "OK" else "Good",
        "issues": issues,
        "refactoring": optimize_code(code)["suggestions"],
    }


def generate_documentation(code):
    explanation = explain_code(code)
    return f"""# Generated Documentation

Generated: {datetime.utcnow().isoformat(timespec="seconds")}Z

## Explanation
{explanation}

## Source
```python
{(code or '').strip()}
```"""


def generate_sql(prompt, schema=None, dialect="mysql"):
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("Prompt is required.")

    schema = parse_schema(schema) if isinstance(schema, str) else (schema or DEFAULT_SCHEMA)
    dialect = (dialect or "mysql").lower()
    lowered = _normalize_text(prompt)
    table = _find_table(lowered, schema)
    columns = schema[table]["columns"]
    row_count = int(schema[table].get("rows", 100))
    intent = _detect_sql_intent(lowered)
    options = []

    if intent == "UPDATE":
        column = _find_column(lowered, columns, fallback="Salary")
        where_column, where_value = _infer_filter(lowered, columns)
        percent = _extract_percent(lowered, default=10)
        factor = 1 + (percent / 100)
        if "decrease" in lowered or "reduce" in lowered:
            factor = 1 - (percent / 100)
        query = f"UPDATE {table}\nSET {column} = {column} * {factor:.2f}\nWHERE {where_column} = '{where_value}';"
        options.append(_sql_option(
            query,
            table,
            [column, where_column],
            f"Updates {column} for records where {where_column} is {where_value}.",
            math.ceil(row_count / 6),
            "modified",
            risky=True,
        ))
    elif intent == "DELETE":
        where_column, where_value = _infer_filter(lowered, columns)
        query = f"DELETE FROM {table}\nWHERE {where_column} = '{where_value}';"
        options.append(_sql_option(
            query,
            table,
            [where_column],
            f"Deletes records from {table} where {where_column} is {where_value}.",
            math.ceil(row_count / 10),
            "modified",
            risky=True,
        ))
    elif intent == "INSERT":
        insert_columns, values = _infer_insert_values(lowered, columns)
        value_sql = ", ".join(_sql_literal(value) for value in values)
        query = f"INSERT INTO {table} ({', '.join(insert_columns)})\nVALUES ({value_sql});"
        options.append(_sql_option(
            query,
            table,
            insert_columns,
            f"Inserts one new record into {table}.",
            1,
            "inserted",
            risky=True,
        ))
    elif "second highest" in lowered and _has_column(columns, "Salary"):
        salary = _find_column("salary", columns, fallback="Salary")
        query = f"SELECT MAX({salary}) AS SecondHighestSalary\nFROM {table}\nWHERE {salary} < (SELECT MAX({salary}) FROM {table});"
        options.append(_sql_option(
            query,
            table,
            [salary],
            "Finds the highest salary after excluding the maximum salary.",
            1,
            "returned",
        ))
    elif "top" in lowered or "highest" in lowered:
        limit_match = re.search(r"top\s+(\d+)", lowered)
        limit = int(limit_match.group(1)) if limit_match else 5
        order_column = _find_column(lowered, columns, fallback=columns[-1])
        query = f"SELECT *\nFROM {table}\nORDER BY {order_column} DESC\n{_limit_clause(limit, dialect)};"
        options.append(_sql_option(
            query,
            table,
            columns,
            f"Returns top {limit} records based on {order_column}.",
            min(limit, row_count),
            "returned",
        ))
    else:
        where = _comparison_filter(lowered, columns)
        if where:
            query = f"SELECT *\nFROM {table}\nWHERE {where};"
            explanation = f"Displays records from {table} where {where}."
            estimate = max(1, row_count // 10)
        else:
            query = f"SELECT *\nFROM {table};"
            explanation = f"Returns all records from {table}."
            estimate = row_count
        options.append(_sql_option(query, table, columns, explanation, estimate, "returned"))

    if options[0]["query"].startswith("SELECT *"):
        column_list = ", ".join(columns)
        options.append({
            **options[0],
            "query": options[0]["query"].replace("SELECT *", f"SELECT {column_list}", 1),
            "explanation": "Alternative with explicit columns for clearer, more maintainable SQL.",
            "optimization": "Avoids SELECT * and returns only known schema columns.",
        })

    return {
        "success": True,
        "prompt": prompt,
        "dialect": "postgresql" if dialect in {"postgres", "postgresql"} else "mysql",
        "intent": intent,
        "options": options,
    }


def parse_schema(schema_text):
    if not schema_text:
        return DEFAULT_SCHEMA
    if isinstance(schema_text, dict):
        return schema_text

    schema = {}
    for raw_line in str(schema_text).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        rows = 100
        row_match = re.search(r"--\s*rows\s*:\s*(\d+)", line, re.IGNORECASE)
        if row_match:
            rows = int(row_match.group(1))
            line = line[:row_match.start()].strip()
        match = re.match(r"([A-Za-z_][A-Za-z0-9_]*)\s*\((.+)\)", line)
        if not match:
            continue
        table = match.group(1)
        column_defs = [part.strip() for part in match.group(2).split(",")]
        columns = [part.split()[0] for part in column_defs if part]
        if columns:
            schema[table] = {"columns": columns, "rows": rows}
    return schema or DEFAULT_SCHEMA


def validate_sql(query):
    stripped = (query or "").strip()
    first_word = stripped.split(None, 1)[0].upper() if stripped else ""
    errors = []
    if not stripped:
        errors.append("Query is empty.")
    if first_word not in {"SELECT", "INSERT", "UPDATE", "DELETE"}:
        errors.append("Only SELECT, INSERT, UPDATE, and DELETE are supported.")
    if first_word in {"UPDATE", "DELETE"} and not re.search(r"\bWHERE\b", stripped, re.IGNORECASE):
        errors.append("Write queries must include a WHERE clause.")
    if stripped and not stripped.endswith(";"):
        errors.append("Query should end with a semicolon.")
    return {
        "valid": not errors,
        "errors": errors,
    }


def execute_sql_preview(query):
    validation = validate_sql(query)
    if not validation["valid"]:
        return {
            "success": False,
            "validation": validation,
            "result": "Query was not executed because validation failed.",
        }

    first_word = query.strip().split(None, 1)[0].upper()
    if first_word == "SELECT":
        result = "Preview execution: records would be returned by the database."
    elif first_word == "INSERT":
        result = "Preview execution: 1 record would be inserted."
    else:
        result = "Preview execution: matching records would be modified after confirmation."
    return {
        "success": True,
        "validation": validation,
        "result": result,
    }


def _function_name_from_prompt(text):
    words = re.findall(r"[a-zA-Z]+", text)
    useful = [word for word in words if word not in {"write", "create", "make", "a", "an", "the", "function", "to"}]
    return "_".join(useful[:4]) or "generated_function"


def _looks_like_sql_request(text):
    return any(word in text for word in ["query", "table", "employee", "student", "salary", "cgpa", "select", "update", "delete", "insert"])


def _normalize_text(text):
    return text.lower().replace("₹", "rs ").replace(",", "").replace(".", "")


def _detect_sql_intent(text):
    if any(word in text for word in ["insert", "add new", "create record"]):
        return "INSERT"
    if any(word in text for word in ["increase", "decrease", "reduce", "update", "set "]):
        return "UPDATE"
    if any(word in text for word in ["delete", "remove"]):
        return "DELETE"
    return "SELECT"


def _find_table(text, schema):
    for table in schema:
        table_name = table.lower()
        if table_name in text or table_name.rstrip("s") in text:
            return table
    if "student" in text and "Students" in schema:
        return "Students"
    if "employee" in text and "Employee" in schema:
        return "Employee"
    return next(iter(schema))


def _find_column(text, columns, fallback):
    for column in columns:
        if column.lower() in text:
            return column
    for column in columns:
        if column.lower() == fallback.lower():
            return column
    return columns[0]


def _infer_filter(text, columns):
    if "it department" in text and _has_column(columns, "Department"):
        return _find_column("department", columns, fallback="Department"), "IT"
    dept_match = re.search(r"(?:department|dept)\s+(?:is|=|as|of)?\s*['\"]?([a-zA-Z0-9_]+)", text)
    if dept_match and _has_column(columns, "Department"):
        return _find_column("department", columns, fallback="Department"), dept_match.group(1).upper()

    for column in columns:
        if column.lower() in text:
            match = re.search(rf"{column.lower()}\s+(?:is|=|by|of)?\s*['\"]?([a-zA-Z0-9_]+)", text)
            if match:
                return column, match.group(1).strip()
    return columns[0], "<value>"


def _comparison_filter(text, columns):
    column = _find_column(text, columns, fallback="Salary" if _has_column(columns, "Salary") else columns[-1])
    number_match = re.search(r"(?:greater than|above|more than|over|exceeds?)\s+(?:rs\s*)?[$]?\s*(\d+(?:\.\d+)?)", text)
    if number_match:
        return f"{column} > {number_match.group(1)}"
    number_match = re.search(r"(?:less than|below|under)\s+(?:rs\s*)?[$]?\s*(\d+(?:\.\d+)?)", text)
    if number_match:
        return f"{column} < {number_match.group(1)}"
    where_column, where_value = _infer_filter(text, columns)
    if where_value != "<value>":
        return f"{where_column} = '{where_value}'"
    return None


def _sql_option(query, table, columns, explanation, estimate, action, risky=False):
    warnings = []
    if risky:
        warnings.append("Review the WHERE clause before execution because this modifies data.")
    validation = validate_sql(query)
    return {
        "query": query,
        "explanation": explanation,
        "tables": [table],
        "attributes": sorted(set(columns)),
        "impact": f"Approximately {estimate} row(s) may be {action}.",
        "expected_output": f"{estimate} row(s) {action}.",
        "clauses": _describe_clauses(query),
        "optimization": _optimization_note(query),
        "warnings": warnings,
        "valid": validation["valid"],
        "validation": validation,
    }


def _has_column(columns, name):
    return any(column.lower() == name.lower() for column in columns)


def _limit_clause(limit, dialect):
    return f"LIMIT {limit}" if dialect in {"mysql", "postgresql", "postgres"} else f"LIMIT {limit}"


def _extract_percent(text, default):
    match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if match:
        return float(match.group(1))
    match = re.search(r"by\s+(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else float(default)


def _infer_insert_values(text, columns):
    insert_columns = [column for column in columns if column.lower() not in {"id", "employeeid", "studentid"}]
    values = []
    for column in insert_columns:
        match = re.search(rf"{column.lower()}\s+(?:is|=|as)?\s*['\"]?([a-zA-Z0-9_.-]+)", text)
        values.append(match.group(1) if match else f"<{column}>")
    return insert_columns, values


def _sql_literal(value):
    if re.fullmatch(r"\d+(?:\.\d+)?", str(value)):
        return str(value)
    return f"'{value}'"


def _describe_clauses(query):
    upper = query.upper()
    clauses = []
    for clause in ["SELECT", "FROM", "WHERE", "ORDER BY", "LIMIT", "UPDATE", "SET", "INSERT INTO", "VALUES", "DELETE FROM"]:
        if clause in upper:
            clauses.append(clause)
    return clauses


def _optimization_note(query):
    upper = query.upper()
    if upper.startswith("SELECT *"):
        return "Use the explicit-column alternative when only known columns are needed."
    if upper.startswith(("UPDATE", "DELETE")):
        return "Run inside a transaction and confirm the WHERE clause before execution."
    return "Query structure is suitable for the detected requirement."
