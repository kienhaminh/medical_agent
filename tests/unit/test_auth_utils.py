"""Unit tests for JWT authentication utilities."""
import time
from unittest.mock import patch

import jwt
import pytest

from src.utils.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


# --- Password hashing ---


def test_hash_password_returns_bcrypt_hash():
    hashed = hash_password("secret123")
    assert hashed.startswith("$2b$")
    assert hashed != "secret123"


def test_hash_password_produces_unique_hashes():
    h1 = hash_password("same_password")
    h2 = hash_password("same_password")
    assert h1 != h2  # Different salts


def test_verify_password_correct():
    hashed = hash_password("correct")
    assert verify_password("correct", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_verify_password_empty_string():
    hashed = hash_password("notempty")
    assert verify_password("", hashed) is False


# --- JWT tokens ---


def test_create_access_token_returns_string():
    token = create_access_token(user_id=1, username="doctor", role="doctor")
    assert isinstance(token, str)
    assert len(token) > 0


def test_create_access_token_payload_contents():
    token = create_access_token(user_id=42, username="admin", role="admin")
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "42"
    assert payload["username"] == "admin"
    assert payload["role"] == "admin"
    assert "exp" in payload


def test_decode_access_token_valid():
    token = create_access_token(user_id=7, username="officer", role="officer")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "7"
    assert payload["username"] == "officer"
    assert payload["role"] == "officer"


def test_decode_access_token_invalid_signature():
    token = create_access_token(user_id=1, username="x", role="doctor")
    # Tamper with the token
    tampered = token[:-4] + "XXXX"
    assert decode_access_token(tampered) is None


def test_decode_access_token_garbage_string():
    assert decode_access_token("not.a.token") is None
    assert decode_access_token("") is None


def test_decode_access_token_expired():
    """Expired tokens should return None."""
    with patch("src.utils.auth.ACCESS_TOKEN_EXPIRE_HOURS", 0):
        # Create token that expires immediately (timedelta(hours=0) = now)
        expired = jwt.encode(
            {"sub": "1", "username": "x", "role": "doctor", "exp": time.time() - 10},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
    assert decode_access_token(expired) is None


def test_decode_access_token_wrong_secret():
    token = jwt.encode(
        {"sub": "1", "username": "x", "role": "doctor", "exp": time.time() + 3600},
        "wrong-secret-key",
        algorithm=ALGORITHM,
    )
    assert decode_access_token(token) is None
