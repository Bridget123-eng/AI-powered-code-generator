def generate_ir(semantic):
    """
    Semantic output se Intermediate Representation (IR) banata hai.
    IR ek simple, language-independent format hai.
    """

    ir = []
    temp_count = 0

    for stmt in semantic:

        # ── ARITHMETIC ──────────────────────────────────
        if stmt["type"] in ["ADD", "SUB", "MUL", "DIV"]:

            result_var = f"t{temp_count}"
            temp_count += 1

            ir.append({
                "op": stmt["type"],
                "arg1": stmt["values"][0],
                "arg2": stmt["values"][1],
                "result": result_var
            })

        # ── IF ───────────────────────────────────────────
        elif stmt["type"] == "IF":

            then_result = f"t{temp_count}"
            temp_count += 1

            else_result = f"t{temp_count}" if stmt["else"] else None
            if stmt["else"]:
                temp_count += 1

            ir_stmt = {
                "op": "IF",
                "condition": stmt["condition"],
                "then": {
                    "op": stmt["action"]["type"],
                    "arg1": stmt["action"]["values"][0],
                    "arg2": stmt["action"]["values"][1],
                    "result": then_result
                },
                "else": None
            }

            if stmt["else"]:
                ir_stmt["else"] = {
                    "op": stmt["else"]["type"],
                    "arg1": stmt["else"]["values"][0],
                    "arg2": stmt["else"]["values"][1],
                    "result": else_result
                }

            ir.append(ir_stmt)

        # ── LOOP ─────────────────────────────────────────
        elif stmt["type"] == "LOOP":

            loop_result = f"t{temp_count}"
            temp_count += 1

            ir.append({
                "op": "LOOP",
                "count": stmt["count"],
                "body": {
                    "op": stmt["action"]["type"],
                    "arg1": stmt["action"]["values"][0],
                    "arg2": stmt["action"]["values"][1],
                    "result": loop_result
                }
            })

    return ir
