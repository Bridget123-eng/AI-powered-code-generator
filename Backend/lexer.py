def lexical_analysis(text):
    """
    Text ko individual tokens mein split karta hai.
    Operators ko alag token banata hai.
    """

    if not text:
        return []

    tokens = text.split()

    # Clean tokens - empty remove karo
    tokens = [t.strip() for t in tokens if t.strip()]

    return tokens
