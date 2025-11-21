"""Secure logging utilities."""

import logging
import re
from typing import Any


class SecureFormatter(logging.Formatter):
    """Formatter that redacts sensitive information."""

    # Patterns to redact
    PATTERNS = [
        (re.compile(r"sk-ant-[a-zA-Z0-9-_]+"), "[REDACTED_API_KEY]"),
        (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED_EMAIL]"),
        (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
        (re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"), "[REDACTED_PHONE]"),
    ]

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with sensitive data redacted.

        Args:
            record: Log record to format

        Returns:
            Formatted and redacted log message
        """
        # Format the message
        message = super().format(record)

        # Redact sensitive patterns
        for pattern, replacement in self.PATTERNS:
            message = pattern.sub(replacement, message)

        return message


def setup_logger(
    name: str,
    level: str = "INFO",
    format_str: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
) -> logging.Logger:
    """Set up a logger with secure formatting.

    Args:
        name: Logger name
        level: Logging level
        format_str: Log format string

    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    logger.handlers = []

    # Create console handler
    handler = logging.StreamHandler()
    handler.setLevel(getattr(logging, level.upper()))

    # Set secure formatter
    formatter = SecureFormatter(format_str)
    handler.setFormatter(formatter)

    logger.addHandler(handler)

    return logger


def redact_secrets(text: str) -> str:
    """Redact secrets from text.

    Args:
        text: Text potentially containing secrets

    Returns:
        Text with secrets redacted
    """
    result = text
    for pattern, replacement in SecureFormatter.PATTERNS:
        result = pattern.sub(replacement, result)
    return result
