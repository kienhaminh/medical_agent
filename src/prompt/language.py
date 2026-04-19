"""Language instruction helpers for system prompts."""

_INSTRUCTIONS: dict[str, str] = {
    "ko": """\
## Language Override
Always respond in Korean (한국어). Use formal, respectful speech (존댓말) throughout.
Medical terms may be followed by the English equivalent in parentheses for clinical clarity \
(e.g. 심근경색 (myocardial infarction)).

""",
    "en": "",  # English is the default — dynamic language detection handles this
}


def get_language_instruction(lang: str) -> str:
    """Return a language-override block to prepend to a system prompt.

    Returns an empty string for "en" (the prompt's built-in language rule handles it).
    """
    return _INSTRUCTIONS.get(lang, "")
