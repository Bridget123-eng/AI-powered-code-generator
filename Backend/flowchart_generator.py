def generate_flowchart(ir):
    """
    IR se Graphviz DOT format string generate karta hai.
    Frontend mein render hoga (viz.js se).
    """

    op_symbol = {
        "ADD": "+", "SUB": "-", "MUL": "*", "DIV": "/"
    }

    lines = []
    lines.append("digraph flowchart {")
    lines.append('    rankdir=TB;')
    lines.append('    node [shape=rectangle, style=filled, fillcolor="#4A90D9", fontcolor=white, fontsize=12];')
    lines.append('    edge [color="#333333"];')
    lines.append("")

    # Start node
    lines.append('    Start [shape=oval, fillcolor="#2ECC71", label="START"];')

    prev = "Start"
    node_count = 1

    for stmt in ir:
        op = stmt["op"]
        node_id = f"N{node_count}"

        # ── ARITHMETIC ──────────────────────────────────
        if op in ["ADD", "SUB", "MUL", "DIV"]:
            sym = op_symbol[op]
            a1 = _fmt(stmt["arg1"])
            a2 = _fmt(stmt["arg2"])
            res = stmt["result"]
            label = f"{res} = {a1} {sym} {a2}\\nprint({res})"

            lines.append(f'    {node_id} [shape=rectangle, label="{label}"];')
            lines.append(f'    {prev} -> {node_id};')
            prev = node_id
            node_count += 1

        # ── IF ───────────────────────────────────────────
        elif op == "IF":
            cond = stmt["condition"]
            cond_label = f'{_fmt(cond["left"])} {cond["op"]} {_fmt(cond["right"])}'

            # Diamond decision node
            lines.append(f'    {node_id} [shape=diamond, fillcolor="#E67E22", label="IF\\n{cond_label}"];')
            lines.append(f'    {prev} -> {node_id};')

            # THEN branch
            then = stmt["then"]
            then_sym = op_symbol[then["op"]]
            then_label = f'{then["result"]} = {_fmt(then["arg1"])} {then_sym} {_fmt(then["arg2"])}\\nprint({then["result"]})'
            then_node = f"N{node_count + 1}"
            lines.append(f'    {then_node} [shape=rectangle, fillcolor="#27AE60", label="{then_label}"];')
            lines.append(f'    {node_id} -> {then_node} [label="YES", color="green"];')

            merge_node = f"M{node_count}"

            if stmt["else"]:
                el = stmt["else"]
                else_sym = op_symbol[el["op"]]
                else_label = f'{el["result"]} = {_fmt(el["arg1"])} {else_sym} {_fmt(el["arg2"])}\\nprint({el["result"]})'
                else_node = f"N{node_count + 2}"
                lines.append(f'    {else_node} [shape=rectangle, fillcolor="#C0392B", label="{else_label}"];')
                lines.append(f'    {node_id} -> {else_node} [label="NO", color="red"];')
                lines.append(f'    {merge_node} [shape=point, width=0.1];')
                lines.append(f'    {then_node} -> {merge_node};')
                lines.append(f'    {else_node} -> {merge_node};')
                node_count += 3
            else:
                lines.append(f'    {merge_node} [shape=point, width=0.1];')
                lines.append(f'    {then_node} -> {merge_node};')
                lines.append(f'    {node_id} -> {merge_node} [label="NO", color="red"];')
                node_count += 2

            prev = merge_node

        # ── LOOP ─────────────────────────────────────────
        elif op == "LOOP":
            count = stmt["count"]
            body = stmt["body"]
            body_sym = op_symbol[body["op"]]
            body_label = f'{body["result"]} = {_fmt(body["arg1"])} {body_sym} {_fmt(body["arg2"])}'

            loop_start = f"LS{node_count}"
            loop_body = f"LB{node_count}"
            loop_check = f"LC{node_count}"

            lines.append(f'    {loop_start} [shape=oval, fillcolor="#8E44AD", label="Loop\\n{count} times"];')
            lines.append(f'    {loop_body} [shape=rectangle, label="{body_label}\\nprint(result)"];')
            lines.append(f'    {loop_check} [shape=diamond, fillcolor="#E67E22", label="i < {count}?"];')

            lines.append(f'    {prev} -> {loop_start};')
            lines.append(f'    {loop_start} -> {loop_check};')
            lines.append(f'    {loop_check} -> {loop_body} [label="YES", color="green"];')
            lines.append(f'    {loop_body} -> {loop_check} [label="next i"];')

            prev = loop_check
            node_count += 1

    # End node
    lines.append(f'    End [shape=oval, fillcolor="#E74C3C", label="END"];')
    lines.append(f'    {prev} -> End;')
    lines.append("}")

    return "\n".join(lines)


def _fmt(val):
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val)
