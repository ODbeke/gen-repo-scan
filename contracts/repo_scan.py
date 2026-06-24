# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
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
        self.repos[scan_id] = raw_urls_joined[:200]
        self.next_scan_id += u32(1)

        if not raw_urls_joined:
            self.scan_results[scan_id] = '{"status": "FETCH_FAILED", "error": "No URLs provided"}'
            return scan_id

        def check_security_nondet() -> str:
            urls = raw_urls_joined.split(",")[:5]
            file_data = ""
            scanned_files = []
            
            for u in urls:
                url_clean = u.strip()
                if not url_clean:
                    continue
                try:
                    content = gl.nondet.web.render(url_clean, mode="text")
                    if content:
                        # Slice content to prevent prompt context bloat
                        file_data += f"\n=== FILE/DIFF: {url_clean} ===\n{content[:4000]}\n"
                        scanned_files.append(url_clean)
                except Exception:
                    pass

            if not scanned_files:
                result_dict = {
                    "status": "FETCH_FAILED",
                    "error": "Failed to fetch content from any of the provided URLs. Ensure the repository, files, or commits are public and accessible.",
                    "scanned_files": []
                }
                return json.dumps(result_dict, sort_keys=True)

            prompt = f"""
            You are a strict, highly deterministic cybersecurity auditor. Review the following code file contents or git diff data.
            
            Files Content:
            {file_data[:15000]}
            
            Task: Perform 3 specific security checks.
            1. Environment variables or secret files: Check for hardcoded API keys, database connection secrets, secret keys, or private SSH keys.
            2. API Keys or auth tokens: Check for exposed client keys, JWT secrets, oauth tokens, or AWS credentials.
            3. Exposed Database URIs: Check for database connection strings containing password parameters (e.g. postgres://user:password@host/db).

            Rules:
            - ONLY return true if you find explicit, hardcoded credentials or secrets.
            - DO NOT flag placeholder values (e.g. '<password>', 'YOUR_KEY', 'TODO', 'secret-placeholder', 'your_jwt_secret_here'), variable names, or generic documentation.
            - If analyzing a Git Diff (identified by diff markers like + or - at the start of lines), check if new secrets are added (lines starting with +). If a secret is deleted (lines starting with -), do not flag it.
            - When in doubt, assume it is secure and return false.
            
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
            
            final_env = ["Contains environment variables or secret keys"] if has_env else []
            final_api = ["Contains API Keys or auth tokens"] if has_api else []
            final_db = ["Contains exposed Database URIs"] if has_db else []
            
            status = "NOT SECURE" if (has_env or has_api or has_db) else "SECURE"
                
            result_dict = {
                "status": status,
                "env_vars_issues": final_env,
                "api_keys_issues": final_api,
                "db_uris_issues": final_db,
                "scanned_files": scanned_files
            }
            
            return json.dumps(result_dict, sort_keys=True)

        consensus_result = gl.eq_principle.prompt_comparative(
            check_security_nondet,
            "The two JSON results must agree on the status (SECURE, NOT SECURE, or FETCH_FAILED) and must agree on which categories (env_vars_issues, api_keys_issues, db_uris_issues) contain detected vulnerability strings, ignoring minor formatting or wording variations."
        )
        
        self.scan_results[scan_id] = consensus_result
        return scan_id

    @gl.public.view
    def get_scan_result(self, scan_id: u32) -> str:
        return self.scan_results.get(scan_id, '{"status": "PENDING"}')
