# Intelligent SQL Assistant

A self-contained browser app that converts natural language requirements into SQL query options, explains the generated SQL, lists involved tables and attributes, estimates impact, validates risk, and keeps query history.

## Features

- Natural language prompt processing
- Schema-aware table and column mapping
- Query generation for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`
- Multiple query alternatives for review and preview
- Plain-language query explanation
- Tables and attributes involved in each query
- Estimated returned or affected rows
- Risk warnings for write operations
- Basic validation and optimization suggestions
- MySQL and PostgreSQL dialect selection
- Local query history after simulated execution

## Run

Open `index.html` in a browser.

No build step or package installation is required.

## Schema Format

Edit the schema box using one table per line:

```text
Employee(id INT PRIMARY KEY, name VARCHAR(100), salary DECIMAL, department VARCHAR(80)) -- rows: 250
Students(id INT PRIMARY KEY, name VARCHAR(100), cgpa DECIMAL, semester INT) -- rows: 1200
```

The optional `-- rows:` value is used for impact estimates.

## Notes

This implementation uses deterministic browser-side rules so it can run offline. A production version can connect the same interface to a backend that reads a live MySQL or PostgreSQL schema, validates SQL against the database engine, estimates row counts with `EXPLAIN`, and executes selected queries with permissions and audit logging.
