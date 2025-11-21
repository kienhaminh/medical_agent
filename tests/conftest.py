"""Pytest configuration and fixtures."""

import os
import logging
import warnings


# Suppress Google Cloud ALTS warnings
os.environ.setdefault("GRPC_ENABLE_FORK_SUPPORT", "1")
os.environ.setdefault("GRPC_POLL_STRATEGY", "poll")

# Suppress gRPC debug logging
logging.getLogger("grpc").setLevel(logging.ERROR)
logging.getLogger("absl").setLevel(logging.ERROR)
logging.getLogger("google").setLevel(logging.ERROR)

# Suppress warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*ALTS.*")
