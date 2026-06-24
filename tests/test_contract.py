import json
from gltest import get_contract_factory

def test_deploy_and_get_empty(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/repo_scan.py", sdk_version="v0.2.16")
    
    # Non-existent scan should return PENDING
    assert json.loads(contract.get_scan_result(999)) == {"status": "PENDING"}

def test_submit_empty_url(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/repo_scan.py", sdk_version="v0.2.16")
    
    scan_id = contract.submit_and_scan("")
    result = json.loads(contract.get_scan_result(scan_id))
    assert result["status"] == "FETCH_FAILED"
    assert "No URLs provided" in result["error"]

def test_successful_scan_clean(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/repo_scan.py", sdk_version="v0.2.16")
    
    # Mock the web request for the file
    direct_vm.mock_web(r".*clean-file\.py.*", {
        "status": 200,
        "body": "def add(a, b):\n    return a + b\n",
    })
    
    # Mock the LLM prompt response
    direct_vm.mock_llm(r".*", '{"has_env": false, "has_api": false, "has_db": false}')
    
    scan_id = contract.submit_and_scan("https://raw.githubusercontent.com/user/repo/main/clean-file.py")
    result = json.loads(contract.get_scan_result(scan_id))
    
    assert result["status"] == "SECURE"
    assert result["env_vars_issues"] == []
    assert result["api_keys_issues"] == []
    assert result["db_uris_issues"] == []
    assert "clean-file.py" in result["scanned_files"][0]

def test_successful_scan_vulnerable(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/repo_scan.py", sdk_version="v0.2.16")
    
    # Mock the web request for the file
    direct_vm.mock_web(r".*vulnerable-file\.py.*", {
        "status": 200,
        "body": "AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'\n",
    })
    
    # Mock the LLM prompt response
    direct_vm.mock_llm(r".*", '{"has_env": false, "has_api": true, "has_db": false}')
    
    scan_id = contract.submit_and_scan("https://raw.githubusercontent.com/user/repo/main/vulnerable-file.py")
    result = json.loads(contract.get_scan_result(scan_id))
    
    assert result["status"] == "NOT SECURE"
    assert len(result["api_keys_issues"]) > 0
    assert result["env_vars_issues"] == []
    assert result["db_uris_issues"] == []
    assert "vulnerable-file.py" in result["scanned_files"][0]

def test_all_fetches_failed(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/repo_scan.py", sdk_version="v0.2.16")
    
    # We do NOT mock the web request, which will cause it to raise a MockNotFoundError (failing the fetch)
    scan_id = contract.submit_and_scan("https://raw.githubusercontent.com/user/repo/main/non-existent.py")
    result = json.loads(contract.get_scan_result(scan_id))
    
    assert result["status"] == "FETCH_FAILED"
    assert "Failed to fetch content" in result["error"]
    assert result["scanned_files"] == []
