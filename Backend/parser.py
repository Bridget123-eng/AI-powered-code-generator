# Fuzzy matching for error suggestions
KEYWORD_LIST = ["add", "subtract", "multiply", "divide", "if", "loop", "repeat", "and",
                "jodo", "ghataao", "guna", "bhaag", "agar", "baar", "aur",
                "then", "else", "toh", "warna", "times"]

def _suggest(word):
    """Levenshtein distance se closest keyword suggest karo"""
    word = str(word).lower()
    best, best_dist = None, 999
    for kw in KEYWORD_LIST:
        dist = _levenshtein(word, kw)
        if dist < best_dist:
            best_dist = dist
            best = kw
    if best_dist <= 2:
        return best
    return None

def _levenshtein(a, b):
    m, n = len(a), len(b)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1,m+1):
        for j in range(1,n+1):
            cost = 0 if a[i-1]==b[j-1] else 1
            dp[i][j] = min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost)
    return dp[m][n]


def parse(tokens, language="English"):
    parsed = []
    i = 0

    def err(en, hi, hien):
        return {"English": en, "Hindi": hi, "Hinglish": hien}.get(language, en)

    def is_num(t):
        try: float(t); return True
        except: return False

    def is_op(t):
        return t in ["ADD", "SUB", "MUL", "DIV"]

    tokens = _reorder_hindi(tokens)
    tokens = _fix_hinglish_and(tokens)

    while i < len(tokens):
        token = tokens[i]

        if is_op(token):
            if i + 2 >= len(tokens):
                raise Exception(err(
                    f"'{token}' needs 2 numbers. Example: add 5 3",
                    f"'{token}' ke baad 2 numbers chahiye. Udaaharan: jodo 5 3",
                    f"'{token}' ke baad 2 numbers chahiye. Example: add 5 3"
                ))
            v1, v2 = tokens[i+1], tokens[i+2]
            if not is_num(v1):
                raise Exception(err(f"Expected a number, got '{v1}'", f"Number chahiye tha, mila '{v1}'", f"Number chahiye tha, mila '{v1}'"))
            if not is_num(v2):
                raise Exception(err(f"Expected a number, got '{v2}'", f"Number chahiye tha, mila '{v2}'", f"Number chahiye tha, mila '{v2}'"))
            parsed.append({"type": token, "values": [v1, v2]})
            i += 3

        elif token == "IF":
            if i + 3 >= len(tokens):
                raise Exception(err(
                    "IF needs a condition. Example: if 5 > 3 then add 2 1",
                    "IF ke baad condition chahiye. Udaaharan: agar 5 > 3 toh jodo 2 1",
                    "IF ke baad condition chahiye. Example: if 5 > 3 then add 2 1"
                ))
            left, op, right = tokens[i+1], tokens[i+2], tokens[i+3]
            if op not in [">","<","==","!=",">=","<="]:
                raise Exception(err(
                    f"Invalid operator '{op}'. Use: >, <, ==, !=, >=, <=",
                    f"Galat operator '{op}'. Use karein: >, <, ==, !=, >=, <=",
                    f"Invalid operator '{op}'. Use karo: >, <, ==, !=, >=, <="
                ))
            condition = {"left": left, "op": op, "right": right}
            i += 4
            if i < len(tokens) and tokens[i] == "THEN": i += 1
            if i >= len(tokens) or not is_op(tokens[i]):
                raise Exception(err(
                    "IF needs an action. Example: if 5 > 3 then add 2 1",
                    "IF ke baad koi kaam chahiye. Udaaharan: agar 5 > 3 toh jodo 2 1",
                    "IF ke baad action chahiye. Example: if 5 > 3 then add 2 1"
                ))
            at = tokens[i]
            if i + 2 >= len(tokens):
                raise Exception(err(f"'{at}' needs 2 values", f"'{at}' ke baad 2 values chahiye", f"'{at}' ke baad 2 values chahiye"))
            action = {"type": at, "values": [tokens[i+1], tokens[i+2]]}
            i += 3
            else_action = None
            if i < len(tokens) and tokens[i] == "ELSE":
                i += 1
                if i >= len(tokens) or not is_op(tokens[i]):
                    raise Exception(err("ELSE needs an action", "ELSE ke baad koi kaam chahiye", "ELSE ke baad action chahiye"))
                et = tokens[i]
                if i + 2 >= len(tokens):
                    raise Exception(err(f"'{et}' needs 2 values", f"'{et}' ke baad 2 values chahiye", f"'{et}' ke baad 2 values chahiye"))
                else_action = {"type": et, "values": [tokens[i+1], tokens[i+2]]}
                i += 3
            parsed.append({"type": "IF", "condition": condition, "action": action, "else": else_action})

        elif token == "LOOP":
            if i + 1 >= len(tokens):
                raise Exception(err(
                    "LOOP needs a count. Example: loop 3 times add 2 1",
                    "LOOP ke baad count chahiye. Udaaharan: 3 baar jodo 2 1",
                    "LOOP ke baad count chahiye. Example: loop 3 times add 2 1"
                ))
            count = tokens[i+1]
            try: count = int(count)
            except: raise Exception(err(f"Loop count must be a number, got '{count}'", f"Count number hona chahiye, mila '{count}'", f"Count number hona chahiye, mila '{count}'"))
            if count <= 0:
                raise Exception(err("Loop count must be positive", "Count positive hona chahiye", "Count positive hona chahiye"))
            i += 2
            if i < len(tokens) and tokens[i] == "TIMES": i += 1
            if i >= len(tokens) or tokens[i] == "AND":
                parsed.append({"type": "LOOP", "count": count, "action": {"type": "ADD", "values": [1, 1]}})
                continue
            if not is_op(tokens[i]):
                parsed.append({"type": "LOOP", "count": count, "action": {"type": "ADD", "values": [1, 1]}})
                continue
            at = tokens[i]
            if i + 2 >= len(tokens):
                raise Exception(err(f"'{at}' needs 2 values", f"'{at}' ke baad 2 values chahiye", f"'{at}' ke baad 2 values chahiye"))
            action = {"type": at, "values": [tokens[i+1], tokens[i+2]]}
            i += 3
            parsed.append({"type": "LOOP", "count": count, "action": action})

        elif token == "AND": i += 1
        elif token == "TIMES": i += 1

        else:
            # Error suggestion
            suggestion = _suggest(str(token))
            if suggestion:
                raise Exception(err(
                    f"Unknown word: '{token}'. Did you mean '{suggestion}'?",
                    f"Samajh nahi aaya: '{token}'. Kya aap '{suggestion}' likhna chahte the?",
                    f"Samajh nahi aaya: '{token}'. Kya aap '{suggestion}' likhna chahte the?"
                ))
            else:
                raise Exception(err(
                    f"Unknown word: '{token}'. Supported: add, subtract, multiply, divide, if, loop, and",
                    f"Samajh nahi aaya: '{token}'. Supported: jodo, ghataao, guna, bhaag, agar, loop, aur",
                    f"Samajh nahi aaya: '{token}'. Supported: add/jodo, subtract/ghataao, multiply/guna"
                ))

    if not parsed:
        raise Exception(err("No valid statement found.", "Input mein koi valid statement nahi mili.", "Input mein koi valid statement nahi mili."))
    return parsed


def _fix_hinglish_and(tokens):
    def is_num(t):
        try: float(t); return True
        except: return False
    def is_op(t):
        return t in ["ADD", "SUB", "MUL", "DIV"]
    result = []
    i = 0
    while i < len(tokens):
        if (i + 3 < len(tokens) and is_op(tokens[i]) and is_num(tokens[i+1])
                and tokens[i+2] == "AND" and is_num(tokens[i+3])):
            result.append(tokens[i])
            result.append(tokens[i+1])
            result.append(tokens[i+3])
            i += 4
            continue
        result.append(tokens[i])
        i += 1
    return result


def _reorder_hindi(tokens):
    def is_num(t):
        try: float(t); return True
        except: return False
    def is_op(t):
        return t in ["ADD", "SUB", "MUL", "DIV"]
    result = []
    i = 0
    t = tokens
    while i < len(t):
        if (i + 3 < len(t) and is_num(t[i]) and t[i+1] == "AND"
                and is_num(t[i+2]) and is_op(t[i+3])):
            result.append(t[i+3]); result.append(t[i]); result.append(t[i+2])
            i += 4; continue
        if (i + 2 < len(t) and is_num(t[i]) and is_num(t[i+1]) and is_op(t[i+2])):
            result.append(t[i+2]); result.append(t[i]); result.append(t[i+1])
            i += 3; continue
        if (i + 1 < len(t) and is_num(t[i]) and t[i+1] == "LOOP"):
            result.append("LOOP"); result.append(t[i])
            i += 2; continue
        result.append(t[i]); i += 1
    return result
