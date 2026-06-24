import os
import sys
import pathlib

# Inject contracts directory into path for import resolution in unit tests
CONTRACTS_DIR = pathlib.Path(__file__).resolve().parent.parent / "contracts"
if str(CONTRACTS_DIR) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_DIR))
