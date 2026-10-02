"""Pytest configuration and fixtures for backend tests."""
import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_root = str(Path(__file__).resolve().parent.parent)
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)
