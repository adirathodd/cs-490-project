import re

COMMON_SUFFIXES = [r'\binc\b', r'\bincorporated\b', r'\bcorp\b', r'\bcorporation\b', r'\bllc\b', r'\bltd\b', r'\bco\b', r'\bcompany\b']


def normalize_name(name: str) -> str:
    """Normalize company name for fuzzy matching and trigram indexing.

    - Lowercases
    - Removes punctuation
    - Strips common corporate suffixes (Inc, LLC, Ltd, etc.)
    - Collapses whitespace
    """
    if not name:
        return ''
    s = name.lower()
    # remove punctuation (keep alphanumerics and spaces)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    # strip common suffixes
    for suf in COMMON_SUFFIXES:
        s = re.sub(suf, ' ', s)
    # collapse whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s
