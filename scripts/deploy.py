"""Deploy a RepoScanner contract to StudioNet via genlayer-py.

Reads private key from the .env file.
Usage:
    python scripts/deploy.py
"""
import os
import sys
import time
from pathlib import Path

# Load env vars from .env in the root directory
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from genlayer_py import create_client
from genlayer_py.chains import studionet
from eth_account import Account


def main() -> int:
    # Use standard PRIVATE_KEY or account fallback from env
    pk = os.environ.get("PRIVATE_KEY") or os.environ.get("ACCOUNT_PRIVATE_KEY_1")
    if not pk:
        print("Error: PRIVATE_KEY or ACCOUNT_PRIVATE_KEY_1 missing in .env")
        print("Please create a .env file with your private key, e.g.:")
        print("PRIVATE_KEY=0x...")
        return 1
        
    if not pk.startswith("0x"):
        pk = "0x" + pk
        
    try:
        account = Account.from_key(pk)
    except Exception as e:
        print(f"Error parsing private key: {e}")
        return 1

    contract_path = Path(__file__).resolve().parents[1] / "contracts" / "repo_scan.py"
    if not contract_path.exists():
        print(f"Error: Contract not found at {contract_path}")
        return 1
        
    code = contract_path.read_text()

    client = create_client(chain=studionet, account=account)

    print("-" * 60)
    print("GENLAYER SMART CONTRACT DEPLOYER")
    print("-" * 60)
    print(f"Contract Source: {contract_path.name}")
    print(f"Deployer Address: {account.address}")
    print(f"Chain:            StudioNet (61999)")
    print(f"Contract Size:    {len(code.encode('utf-8'))} bytes")
    print("-" * 60)

    print("\nSubmitting deployment transaction...")
    try:
        tx_hash = client.deploy_contract(
            code=code,
            account=account,
            args=[],
        )
    except Exception as e:
        print(f"Deploy transaction submission failed: {e}")
        return 1

    print(f"Tx Hash: {tx_hash}")
    print("Waiting for consensus receipt (can take ~10-30 seconds)...")
    
    receipt = None
    # Wait for receipt by status polling
    for i in range(30):
        try:
            rx = client.get_transaction(transaction_hash=tx_hash)
            sn = rx.get("status_name") or rx.get("statusName")
            rn = rx.get("result_name") or rx.get("resultName")
            print(f"  [{i*3}s] transaction status: {sn} | result: {rn}")
            if sn in ("ACCEPTED", "FINALIZED"):
                receipt = rx
                break
            if sn in ("CANCELED", "UNDETERMINED") or rn == "TIMEOUT":
                print("Transaction failed or was canceled.")
                return 2
        except Exception as e2:
            print(f"  [{i*3}s] polling error: {e2}")
        time.sleep(3)

    if not receipt:
        print("Error: Timed out waiting for transaction consensus.")
        return 2

    en = receipt.get("tx_execution_result_name") or receipt.get("txExecutionResultName")
    print(f"Execution Result: {en}")

    contract_addr = (
        receipt.get("data", {}).get("contract_address")
        or receipt.get("contract_address")
        or receipt.get("contractAddress")
        or receipt.get("to_address")
        or receipt.get("toAddress")
    )
    
    print("\n" + "=" * 60)
    print(f"SUCCESSFULLY DEPLOYED CONTRACT!")
    print(f"CONTRACT ADDRESS: {contract_addr}")
    print(f"DEPLOY TX HASH:   {tx_hash}")
    print("=" * 60)

    if en == "FINISHED_WITH_ERROR":
        print("Warning: The deploy transaction completed, but finished with execution error.")
        return 3
        
    return 0


if __name__ == "__main__":
    sys.exit(main())
