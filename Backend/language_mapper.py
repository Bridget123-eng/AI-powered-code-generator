from utils import word_to_number


def map_language(tokens):

    keyword_map = {
        # ARITHMETIC
        "add": "ADD",       "plus": "ADD",      "sum": "ADD",
        "jodo": "ADD",      "jod": "ADD",        "jodon": "ADD",
        "addition": "ADD",  "jodna": "ADD",      "jodte": "ADD",

        "subtract": "SUB",  "minus": "SUB",      "ghatao": "SUB",
        "ghata": "SUB",     "subtraction": "SUB","sub": "SUB",
        "ghatana": "SUB",

        "multiply": "MUL",  "product": "MUL",    "guna": "MUL",
        "gunao": "MUL",     "multiplication": "MUL", "mul": "MUL",
        "guna_karo": "MUL",

        "divide": "DIV",    "divideby": "DIV",   "bhaag": "DIV",

        "bhago": "DIV", "bhag":"DIV", "division": "DIV",   "div": "DIV",
        "bhaagna": "DIV",

        # CONTROL
        "if": "IF",         "agar": "IF",        "yadi": "IF",
        "then": "THEN",     "toh": "THEN",       "to": "THEN",
        "else": "ELSE",     "warna": "ELSE",     "anyatha": "ELSE",

        # LOOP
        "repeat": "LOOP",   "loop": "LOOP",
        "baar": "LOOP",     "bar": "LOOP",       "dohrao": "LOOP",
        "times": "TIMES",

        # SEPARATOR — "aur" in arithmetic context = AND not separator for numbers
        "and": "AND",       "aur": "AND",
        "also": "AND",      "phir": "AND",

        # CONDITIONS
        ">": ">", "<": "<", "==": "==", "!=": "!=", ">=": ">=", "<=": "<=",
        "greater": ">",     "bada": ">",         "zyada": ">",   "adhik": ">",
        "less": "<",        "chota": "<",        "kam": "<",
        "equal": "==",      "barabar": "==",     "equals": "==",
        "notequal": "!=",   "alag": "!=",
        "greaterequal": ">=", "lessequal": "<=",

        

        # Hindi arithmetic operators
        "जोड़ो": "ADD","जोडो": "ADD","जोड़": "ADD","घटाओ": "SUB","घटाओ": "SUB","गुणा": "MUL","गुणो": "MUL","भाग": "DIV","गो": "DIV",
    }

    mapped = []

    for token in tokens:
        token_lower = token.lower()

        # Number word conversion
        num = word_to_number(token_lower)
        if num != token_lower:
            try:    mapped.append(int(num))
            except: mapped.append(float(num))
            continue

        # Already a number
        if token_lower.lstrip('-').replace('.','',1).isdigit():
            try:    mapped.append(int(token_lower))
            except: mapped.append(float(token_lower))
            continue

        # Keyword map
        if token_lower in keyword_map:
            mapped.append(keyword_map[token_lower])
        else:
            mapped.append(token_lower)

    return mapped
