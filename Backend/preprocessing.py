import re


def preprocess(text, language="English"):
    if not text:
        return ""

    # Lowercase
    text = text.lower()

    # Comma, dot, extra punctuation remove — VOICE FIX
    text = text.replace(",", " ")
    text = text.replace(".", " ")
    text = text.replace(";", " ")
    text = text.replace(":", " ")
    text = text.replace("?", " ")
    text = text.replace("!", " ")
    text = text.replace("।", " ") 
    text = text.replace("-", " ")

    # Multi-word condition phrases → single operator
    text = text.replace("greater than or equal to", ">=")
    text = text.replace("less than or equal to", "<=")
    text = text.replace("not equal to", "!=")
    text = text.replace("greater than", ">")
    text = text.replace("less than", "<")
    text = text.replace("equal to", "==")
    text = text.replace("equals to", "==")
    text = text.replace("equals", "==")

    # Hindi condition phrases
    text = text.replace("se bada ya barabar", ">=")
    text = text.replace("se chota ya barabar", "<=")
    text = text.replace("ke barabar nahi", "!=")
    text = text.replace("se bada", ">")
    text = text.replace("se chota", "<")
    text = text.replace("ke barabar", "==")
    text = text.replace("barabar hai", "==")

    # Operators ke around space add karo
    text = re.sub(r'(>=|<=|==|!=|>|<)', r' \1 ', text)

    # Extra spaces remove
    text = " ".join(text.split())

    return text
