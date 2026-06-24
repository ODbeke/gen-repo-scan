# GenLayer Smart Repo Scanner

A decentralized, on-chain security auditing protocol built on GenLayer. It uses AI validator networks (via GenVM) to scan public GitHub codebases and recent commit history diffs for exposed credentials, secret keys, API tokens, and database connection URIs.

---

## Milestone Submission Details

- **Project Name:** GenLayer Smart Repo Scanner
- **Builder:** ODbeke
- **Live Demo Link:** [https://gen-repo-scan.vercel.app/](https://gen-repo-scan.vercel.app/)
- **Deployed Contract Address (StudioNet):** `0x56651EDE70D20C192031C9E11f217d742707DD3a`
- **Submission Type:** Milestone Project

---

By utilizing GenLayer's **Optimistic Democracy** consensus, multiple validators run independent Large Language Models (LLMs) and fetch files off-chain via browser renders, arriving at an on-chain, trustless agreement on the security status of the code.

---

## Key Features

1. **AI-Driven Vulnerability Audits:** Goes beyond simple regex checks. AI validators understand code semantics, ignoring safe placeholder values (like `'YOUR_API_KEY'` or `'TODO'`) while flagging actual, hardcoded secrets.
2. **Multi-File & Commit History Scans:** Automatically crawls a repository tree to locate high-risk files (like `.env`, `secret`, `config`, `.ts`, `.py`) and fetches the latest commit `.diff` URL to scan recent changes for secrets added or deleted.
3. **Comparative Prompt Consensus:** Configures `gl.eq_principle.prompt_comparative` to compare validator LLM outputs semantically, ensuring that consensus is robust against slight variations in phrasing or formatting while enforcing strict agreement on the security verdict.
4. **On-Chain Consensus Proof Inspector:** Visualizes validator votes, signatures, gas fees, and leader receipts inside the UI, with an encoded base64 output that acts as cryptographic proof of consensus.
5. **Fail-Safe UI Alerts:** Reports when fetches fail (e.g., private repositories or bad URLs) so users are not misled by false-negative "SECURE" reports.

---

## Directory Structure

```text
├── contracts/
│   └── repo_scan.py        # GenLayer Intelligent Contract (prompt_comparative, nondet fetches)
├── scripts/
│   └── deploy.py           # Python script to compile and deploy to StudioNet
├── tests/
│   ├── conftest.py         # Pytest bootstrap and path configurations
│   └── test_contract.py    # Unit tests running in direct (mocked) mode
├── src/
│   ├── hooks/
│   │   └── useWallet.ts    # React Web3 wallet connection hook (supports MetaMask + StudioNet)
│   ├── App.tsx             # Main dashboard UI & contract integration
│   ├── index.css           # Styling configuration (Tailwind V4)
│   └── main.tsx            # Application entry point
├── gltest.config.yaml      # Testing configurations mapping to StudioNet
├── package.json            # Node.js frontend dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # Documentation
```

---

## Setup & Installation

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** & npm
- A Web3 Wallet (like **MetaMask**) configured for **GenLayer StudioNet** (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`)

### 1. Python Environment Setup
Install the GenLayer Testing suite and Python SDK dependencies:
```bash
pip install genlayer-test python-dotenv eth-account
```

### 2. Node.js Frontend Setup
Clone the repository and install Node dependencies:
```bash
npm install
```

---

## Running Unit Tests

The project includes unit tests written for `gltest` (running in Direct Mode, which mocks web fetches and LLM outputs for fast, free execution).

Run the tests using `pytest`:
```bash
pytest tests/ -v
```

This tests:
- Deployment states
- Instant rejection of empty URLs
- Correct identification of clean files (`SECURE`)
- Correct identification of credential leaks (`NOT SECURE`)
- Correct failure propagation when file downloads fail (`FETCH_FAILED`)

---

## Smart Contract Deployment

To deploy the smart contract to **GenLayer StudioNet**:

1. Create a `.env` file in the root directory.
2. Add your StudioNet funded private key:
   ```env
   PRIVATE_KEY=0xyour_funded_private_key_here
   ```
3. Run the automated deployment script:
   ```bash
   python scripts/deploy.py
   ```
4. Copy the logged **CONTRACT ADDRESS** from the terminal and add it to your `.env` for the frontend:
   ```env
   VITE_CONTRACT_ADDRESS=0xdeployed_contract_address_here
   ```

---

## Running the Frontend Locally

Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Connect your MetaMask wallet, switch to **GenLayer StudioNet**, and paste a GitHub repository link to scan!

To verify frontend builds successfully for production:
```bash
npm run build
```

---

## Milestone Upgrades & Changelog

This project has been heavily upgraded from its initial submission to meet production-grade standards for GenLayer milestone review. Below is a detailed log of the changes:

### 1. Architectural Reorganization
- Reorganized codebase into professional directories: `contracts/` (Intelligent Contracts), `tests/` (unit tests), and `scripts/` (deploy scripts).
- Standardized file names: Renamed the contract from `contract.py` to `repo_scan.py`.
- Added standard `.gitignore` config to filter python compilation artifacts, linter files, and build directories.

### 2. Smart Contract Upgrades (`contracts/repo_scan.py`)
- **Semantic Consensus (`prompt_comparative`):** Swapped the rigid `strict_eq` checking for `gl.eq_principle.prompt_comparative`. Instead of requiring binary-identical JSON strings across validators (which fails frequently on minor LLM formatting or whitespace changes), consensus is now robustly evaluated on semantic agreement of the security logs.
- **Fail-Safe Web Handling:** Replaced loose web downloads with a robust error boundary. If target URLs fail to fetch (such as private repository 404s), the contract deterministically aborts and logs `FETCH_FAILED` rather than silently scanning empty files and declaring them `SECURE`.
- **Scanned Targets Audit Log:** The contract now returns the list of successfully retrieved file paths in its JSON payload, allowing the client to verify what was audited.
- **Commit History & Diff Support:** Added specialized prompt logic allowing validators to check git diff files (detecting `+` additions for new secrets and ignoring `-` deletions).

### 3. Frontend Upgrades (`src/App.tsx` & `src/hooks/useWallet.ts`)
- **Multi-File Crawling:** Configured the frontend to dynamically find the top 2 highest-risk files in a repository via the GitHub REST API and combine them with the latest commit `.diff` URL, sending them as a comma-separated query to the contract.
- **Consensus Receipt Inspector:** Built a glowing glassmorphic "Consensus Proof" viewer modal. The modal displays the raw base64-encoded receipt payload and parses out validator signatures, votes, gas used, and leader output.
- **Improved UX States:** Added custom renderers for `FETCH_FAILED` errors and listed audited targets dynamically in the results card.

### 4. Unit Testing and Automation
- Created `gltest.config.yaml` and `tests/conftest.py` setting up path injection and network configurations.
- Implemented a suite of 5 direct-mode unit tests (`tests/test_contract.py`) covering clean scans, vulnerability audits, empty strings, download failures, and deployments.
- Created `scripts/deploy.py` for automated contract compilation and StudioNet deployments.
