def word_to_number(word):
    num_map = {
        # English
        "zero":"0","one":"1","two":"2","three":"3","four":"4",
        "five":"5","six":"6","seven":"7","eight":"8","nine":"9",
        "ten":"10","eleven":"11","twelve":"12","thirteen":"13",
        "fourteen":"14","fifteen":"15","twenty":"20","thirty":"30",
        "forty":"40","fifty":"50","hundred":"100",
        # Hinglish
        "ek":"1","do":"2","teen":"3","char":"4","paanch":"5",
        "chhe":"6","saat":"7","aath":"8","nau":"9","das":"10",
        "gyarah":"11","barah":"12","bees":"20","tees":"30",
        "chalis":"40","pachaas":"50","sau":"100",

        #Hindi
        "एक":"1","दो": "2","तीन": "3","चार": "4","पाँच": "5","पांच": "5","छह": "6","सात": "7","आठ": "8","नौ": "9","दस": "10",
    }
    return num_map.get(word.lower(), word)


def normalize_voice_input(text):
    """
    Voice input clean karta hai:
    - Comma word remove karta hai
    - Trailing dots/punctuation hata deta hai
    - Number words convert karta hai
    - Multi-word conditions fix karta hai
    """
    if not text:
        return ""

    # Lowercase
    text = text.lower()

    # Punctuation remove — dots, commas, question marks
    import re
    text = re.sub(r'[.,!?;:]', ' ', text)

    # "comma" word explicitly remove karo
    text = re.sub(r'\bcomma\b', ' ', text)
    text = re.sub(r'\bperiod\b', ' ', text)
    text = re.sub(r'\bfull stop\b', ' ', text)

    # Multi-word conditions replace BEFORE splitting
    text = text.replace("greater than or equal to", ">=")
    text = text.replace("less than or equal to", "<=")
    text = text.replace("not equal to", "!=")
    text = text.replace("greater than", ">")
    text = text.replace("less than", "<")
    text = text.replace("equal to", "==")
    text = text.replace("equals to", "==")

    words = text.split()
    result = []
    i = 0

    while i < len(words):
        w = words[i]

        # Skip empty
        if not w:
            i += 1
            continue

        # "and" between two numbers → skip "and", keep both numbers
        if i + 2 < len(words):
            w_num   = word_to_number(w)
            next_w  = words[i + 1]
            next2_w = word_to_number(words[i + 2])
            if next_w == "and" and w_num.isdigit() and next2_w.isdigit():
                result.append(w_num)
                result.append(next2_w)
                i += 3
                continue

        # Convert number words
        converted = word_to_number(w)
        result.append(converted)
        i += 1

    return " ".join(result)


def is_number(s):
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False