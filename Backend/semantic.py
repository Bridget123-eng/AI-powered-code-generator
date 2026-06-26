from utils import is_number


def semantic_analysis(parsed):
    """
    Parsed output ka semantic validation karta hai.
    Type checking, value checking, operator validation.
    """

    semantic_output = []

    for stmt in parsed:

        # ── ARITHMETIC ──────────────────────────────────
        if stmt["type"] in ["ADD", "SUB", "MUL", "DIV"]:

            if len(stmt["values"]) != 2:
                raise Exception(f"{stmt['type']}: exactly 2 values chahiye")

            v1, v2 = stmt["values"]

            if not is_number(v1):
                raise Exception(f"{stmt['type']}: '{v1}' ek valid number nahi hai")

            if not is_number(v2):
                raise Exception(f"{stmt['type']}: '{v2}' ek valid number nahi hai")

            # DIV by zero check
            if stmt["type"] == "DIV" and float(v2) == 0:
                raise Exception("Division by zero allowed nahi hai!")

            semantic_output.append({
                "type": stmt["type"],
                "values": [float(v1), float(v2)]
            })

        # ── IF ───────────────────────────────────────────
        elif stmt["type"] == "IF":

            cond = stmt["condition"]

            valid_ops = [">", "<", "==", "!=", ">=", "<="]
            if cond["op"] not in valid_ops:
                raise Exception(f"Invalid condition operator: '{cond['op']}'")

            # Condition values numeric check
            if not is_number(cond["left"]):
                raise Exception(f"IF condition: '{cond['left']}' number nahi hai")
            if not is_number(cond["right"]):
                raise Exception(f"IF condition: '{cond['right']}' number nahi hai")

            # Action validate
            action = stmt["action"]
            _validate_action(action)

            # Else validate (if present)
            else_action = stmt["else"]
            if else_action:
                _validate_action(else_action)

            semantic_output.append({
                "type": "IF",
                "condition": {
                    "left": float(cond["left"]),
                    "op": cond["op"],
                    "right": float(cond["right"])
                },
                "action": {
                    "type": action["type"],
                    "values": [float(action["values"][0]), float(action["values"][1])]
                },
                "else": {
                    "type": else_action["type"],
                    "values": [float(else_action["values"][0]), float(else_action["values"][1])]
                } if else_action else None
            })

        # ── LOOP ─────────────────────────────────────────
        elif stmt["type"] == "LOOP":

            count = stmt["count"]

            if not isinstance(count, int) or count <= 0:
                raise Exception(f"LOOP count positive integer hona chahiye, mila: '{count}'")

            action = stmt["action"]
            _validate_action(action)

            semantic_output.append({
                "type": "LOOP",
                "count": count,
                "action": {
                    "type": action["type"],
                    "values": [float(action["values"][0]), float(action["values"][1])]
                }
            })

        else:
            raise Exception(f"Unknown statement type: '{stmt['type']}'")

    return semantic_output


def _validate_action(action):
    """Action (arithmetic operation) ko validate karta hai"""

    if action["type"] not in ["ADD", "SUB", "MUL", "DIV"]:
        raise Exception(f"Invalid action type: '{action['type']}'")

    if len(action["values"]) != 2:
        raise Exception(f"{action['type']}: 2 values chahiye")

    v1, v2 = action["values"]

    from utils import is_number
    if not is_number(v1):
        raise Exception(f"{action['type']}: '{v1}' number nahi hai")
    if not is_number(v2):
        raise Exception(f"{action['type']}: '{v2}' number nahi hai")

    if action["type"] == "DIV" and float(v2) == 0:
        raise Exception("Division by zero allowed nahi hai!")
