# { "Depends": "py-genlayer:test" }
from genlayer import *
import json

class RepoScanner(gl.Contract):
    next_scan_id: u32
    repos: TreeMap[u32, str]
    scan_results: TreeMap[u32, str] 

    def __init__(self):
        self.next_scan_id = u32(1)

    @gl.public.write
    def submit_and_scan(self, raw_urls_joined: str) -> u32:
        scan_id = self.next_scan_id
        self.repos[scan_id] = raw_urls_joined[:100]
        self.next_scan_id += u32(1)

        if not raw_urls_joined:
            self.scan_results[scan_id] = '{"status": "NOT_FOUND"}'
            return scan_id

        def check_security_nondet() -> str:
            urls = raw_urls_joined.split(",")[:5] # Check up to 5 highest-risk files
            file_data = ""
            for u in urls:
                try:
                    content = gl.nondet.web.render(u.strip(), mode="text")
                    file_data += f"\n=== FILE: {u.strip()} ===\n{content[:4000]}\n"
                except Exception:
                    pass
            
            prompt = f"""
            You are a strict, highly deterministic cybersecurity auditor. Review the following text.
            
            Files Content:
            {file_data[:15000]}
            
            Task: Perform 3 specific security checks. 
            ONLY return true if you find explicit, hardcoded secrets. 
            DO NOT flag placeholder values (e.g. '<password>', 'YOUR_KEY', 'TODO'), variable names, or generic documentation.
            When in doubt, assume it is secure and return false.
            
            Return a JSON object strictly following this structure:
            {{
              "has_env": false,
              "has_api": false,
              "has_db": false
            }}
            """
            
            try:
                response = gl.nondet.exec_prompt(prompt, response_format="json")
                
                def is_true(val) -> bool:
                    if isinstance(val, bool):
                        return val
                    if isinstance(val, str):
                        return val.strip().lower() == "true"
                    return False

                has_env = is_true(response.get("has_env"))
                has_api = is_true(response.get("has_api"))
                has_db = is_true(response.get("has_db"))
            except Exception:
                has_env, has_api, has_db = False, False, False
            
            # Rebuild arrays deterministically to bypass any AI string variations
            final_env = ["Contains environment variables or secret keys"] if has_env else []
            final_api = ["Contains API Keys or auth tokens"] if has_api else []
            final_db = ["Contains exposed Database URIs"] if has_db else []
            
            status = "NOT SECURE" if (has_env or has_api or has_db) else "SECURE"
                
            result_dict = {
                "status": status,
                "env_vars_issues": final_env,
                "api_keys_issues": final_api,
                "db_uris_issues": final_db
            }
            
            return json.dumps(result_dict, sort_keys=True)

        consensus_result = gl.eq_principle.strict_eq(check_security_nondet)
        
        self.scan_results[scan_id] = consensus_result
        return scan_id

    @gl.public.view
    def get_scan_result(self, scan_id: u32) -> str:
        return self.scan_results.get(scan_id, '{"status": "PENDING"}')