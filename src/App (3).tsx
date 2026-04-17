import React, { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle, Github, Lock, Search, AlertTriangle, Wallet, LogOut, ExternalLink, ChevronDown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWallet } from './hooks/useWallet';

const isAddress = (addr: string | null | undefined): addr is `0x${string}` => {
  if (!addr || typeof addr !== 'string' || addr === 'undefined') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
};

const VITE_CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const FALLBACK_CONTRACT = '0x56651EDE70D20C192031C9E11f217d742707DD3a' as `0x${string}`;
const CONTRACT_ADDRESS = isAddress(VITE_CONTRACT_ADDRESS) ? VITE_CONTRACT_ADDRESS : FALLBACK_CONTRACT;

interface ScanResult {
  status: "SECURE" | "NOT SECURE" | "PENDING" | "NOT_FOUND";
  env_vars_issues?: string[];
  api_keys_issues?: string[];
  db_uris_issues?: string[];
}

const FloatingShields = () => {
  const shields = Array.from({ length: 15 });
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[#020617]" />
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      
      {shields.map((_, i) => {
        const size = Math.random() * 32 + 24;
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;
        const duration = Math.random() * 20 + 20;
        const delay = Math.random() * -20;
        
        return (
          <motion.div
            key={i}
            className="absolute text-indigo-500/25"
            initial={{ 
              x: `${startX}vw`, 
              y: `${startY}vh`, 
              rotate: 0 
            }}
            animate={{ 
              y: [`${startY}vh`, `${startY - 100}vh`],
              rotate: 360
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "linear"
            }}
          >
            <Shield size={size} />
          </motion.div>
        );
      })}
    </div>
  );
};

export default function App() {
  const { address, isConnected, isConnecting, error: walletError, connect, disconnect, truncatedAddress } = useWallet();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !isAddress(address) || !window.ethereum) {
      setError('Please connect your wallet first.');
      return;
    }
    
    let targetUrl = url.trim();
    if (!targetUrl) {
      setError('Please provide a raw file URL or GitHub repo.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    // If it's a GitHub URL, parse it to find sensitive files
    if (targetUrl.startsWith('https://github.com/')) {
        try {
            // Strip out [Scanning Single] prefix if the user clicked analyze twice
            if (targetUrl.includes('[Scanning Single]:')) {
              setError('Please provide a clean GitHub URL.');
              setLoading(false);
              return;
            }

            const parsedUrl = new URL(targetUrl);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            
            if (pathParts.length === 2) {
                setLoadingStep('Discovering sensitive files...');
                const owner = pathParts[0];
                const repo = pathParts[1];
                
                try {
                  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
                  if (treeRes.ok) {
                      const data = await treeRes.json();
                      const allPaths = data.tree ? data.tree.map((t: any) => t.path) : [];
                      
                      const riskKeywords = ['.env', 'secret', 'config', 'key', 'database', 'auth'];
                      const ignoredExtensions = ['.json', '.md', '.lock', '.png', '.jpg'];
                      
                      const riskyFiles = allPaths.filter((path: string) => {
                          const lower = path.toLowerCase();
                          if (ignoredExtensions.some(ext => lower.endsWith(ext))) return false;
                          if (lower.includes('node_modules/')) return false;
                          
                          return riskKeywords.some(kw => lower.includes(kw)) || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.py');
                      });
                      
                      riskyFiles.sort((a: string, b: string) => {
                          const aScore = riskKeywords.filter(kw => a.toLowerCase().includes(kw)).length;
                          const bScore = riskKeywords.filter(kw => b.toLowerCase().includes(kw)).length;
                          return bScore - aScore;
                      });

                      let topFile = riskyFiles.length > 0 ? riskyFiles[0] : 'README.md';
                      
                      targetUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${topFile}`;
                      setUrl(`[Scanning Single]: ${topFile}`);
                  } else {
                      targetUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
                      setUrl(targetUrl);
                  }
                } catch (err) {
                  targetUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
                  setUrl(targetUrl);
                }
            } else if (pathParts.length >= 4 && pathParts[2] === 'blob') {
                pathParts.splice(2, 1);
                targetUrl = `https://raw.githubusercontent.com/${pathParts.join('/')}`;
                setUrl(targetUrl);
            } else {
                setError('Please provide a direct RAW file URL or a Github Root repo URL');
                setLoading(false);
                return;
            }
        } catch (err) {
             setError('Invalid GitHub URL format.');
             setLoading(false);
             return;
        }
    }

    setLoadingStep('Waiting for Wallet Signature...');

    try {
      const provider = new BrowserProvider(window.ethereum);
      
      // Verify we are on the correct network (GenLayer StudioNet: 61999)
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 61999) {
        setError('Incorrect Network. Please switch your wallet to GenLayer StudioNet.');
        setLoading(false);
        return;
      }

      // Initialize GenLayer JS client for properly encoded transactions
      const writeClient = createClient({
        chain: studionet,
        provider: window.ethereum,
        account: address as `0x${string}`,
      });
      const readClient = createClient({
        chain: studionet,
      });

      // 1. Submit the URL and trigger the scan in a single GenVM consensus operation
      setLoadingStep('Waiting for Wallet Signature...');
      const scanTxHash = await writeClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'submit_and_scan',
        args: [targetUrl],
        value: 0n,
      });

      setLoadingStep('Awaiting GenLayer AI Consensus (can take 2-4 minutes)...');
      const scanReceipt: any = await readClient.waitForTransactionReceipt({
        hash: scanTxHash,
        status: TransactionStatus.ACCEPTED,
        fullTransaction: true,
        interval: 2000,
        retries: 300,
      } as any);

      // Extract the returned scanId natively from the consensus data payload
      let scanId = 1;
      const returnedValue = scanReceipt?.consensus_data?.leader_receipt?.[0]?.result?.payload?.readable;
      if (returnedValue) {
        scanId = parseInt(returnedValue, 10);
      } else {
        console.warn("Could not find scanId in receipt, defaulting to ID 1.", scanReceipt);
      }

      setLoadingStep('Fetching Verified Results...');
      // 2. Fetch the stringified JSON result directly (this is an instant, free view call)
      const resultString = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_scan_result',
        args: [scanId],
      });

      setResult(JSON.parse(resultString as string));
      setUrl('');
    } catch (err: any) {
      console.error('Core Analysis Error:', err);
      if (err.message?.includes('User denied') || err.code === 4001) {
        setError('Transaction signature rejected by user.');
      } else if (err.code === 'CALL_EXCEPTION') {
        setError('Execution reverted. The contract may not be deployed at this address or the parameters are invalid.');
      } else {
        setError('Failed to reach consensus or connect to GenLayer StudioNet. Please check your network.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const CheckItem = ({ 
    label, 
    passed, 
    delay, 
    issues,
    description
  }: { 
    label: string; 
    passed?: boolean; 
    delay: number;
    issues?: string[];
    description: string;
  }) => {
    const [expanded, setExpanded] = useState(false);
  
    return (
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className="bg-slate-950/50 rounded-xl border border-slate-800/50 backdrop-blur-sm overflow-hidden"
      >
        <button 
          onClick={() => setExpanded(!expanded)}
          type="button"
          className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${passed ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {passed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
            </div>
            <span className="text-slate-300 font-medium">{label}</span>
          </div>
          <div className="flex flex-row items-center gap-3">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${passed ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {passed ? 'PASSED' : 'FAILED'}
            </span>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-800/50 bg-slate-900/30"
            >
              <div className="p-4 text-sm text-slate-400 text-left">
                <p className="mb-2">{description}</p>
                {!passed && issues && issues.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold text-slate-300 mb-1">Impacted locations:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {issues.map((issue, idx) => (
                        <li key={idx} className="text-red-400 font-mono text-xs break-all">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!passed && (!issues || issues.length === 0) && (
                  <div className="mt-3 p-3 bg-red-500/5 rounded-lg border border-red-500/10 text-red-400/80 italic text-xs leading-relaxed">
                    Note: The GenLayer Consensus AI identified an issue here, but strict path reporting is not exposed in the current smart contract outputs. To see the specific files or folders, the smart contract needs to return them in its JSON payload.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30 relative">
      <FloatingShields />

      <div className="max-w-2xl w-full relative z-10">
        {/* Header with Wallet Connection */}
        <div className="flex justify-end mb-8">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.button
                key="connect"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4" />
                )}
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </motion.button>
            ) : (
              <motion.div
                key="connected"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="group relative"
              >
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl font-mono text-sm text-indigo-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {truncatedAddress}
                </div>
                <button
                  onClick={disconnect}
                  className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-md"
                >
                  <LogOut className="w-3 h-3" />
                  Disconnect
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center mb-12 relative"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-wide uppercase mb-6 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            AI Validator Network Live
          </div>
          <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 mb-6 shadow-2xl shadow-indigo-500/10 inline-block backdrop-blur-xl">
            <ShieldCheck className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            Smart Repo Scanner
          </h1>
          <p className="text-slate-400 text-lg max-w-xl leading-relaxed mb-8">
            Paste any GitHub repository link. Our autonomous AI validators will instantly parse your codebase, detect exposed secrets, and reach on-chain consensus.
          </p>
          <div className="flex gap-4 sm:gap-6 text-sm font-medium text-slate-500 justify-center flex-wrap">
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500/70" /> High-Risk File Auto-Detection</span>
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500/70" /> Multi-Model Validation</span>
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500/70" /> GenVM Secured</span>
          </div>
        </motion.header>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md mb-8"
        >
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">GitHub URL</label>
              <div className="relative group">
                <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {(error || walletError) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-medium">{walletError || error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full relative overflow-hidden group bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-4 py-4 transition-all flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="animate-pulse">{loadingStep}</span>
                </>
              ) : !isConnected ? (
                <>
                  <Wallet className="w-5 h-5" />
                  Connect Wallet to Scan
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Scan Repository
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Results Panel */}
        <AnimatePresence>
          {result && result.status !== "PENDING" && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden"
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 w-full h-1 ${
                result.status === 'SECURE' ? 'bg-green-500' : 'bg-red-500'
              }`} />

              <div className="flex flex-col items-center mb-10">
                <div className={`p-6 rounded-full mb-6 ${
                  result.status === 'SECURE' ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {result.status === 'SECURE' ? (
                    <ShieldCheck className="text-green-500 w-20 h-20" />
                  ) : (
                    <ShieldAlert className="text-red-500 w-20 h-20" />
                  )}
                </div>
                <div className="text-center">
                  <h2 className={`text-4xl font-black tracking-tighter mb-2 ${
                    result.status === 'SECURE' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {result.status}
                  </h2>
                  <p className="text-slate-400 font-medium">
                    {result.status === 'SECURE' 
                      ? 'No critical vulnerabilities detected by the network.' 
                      : 'Critical security risks identified in the source code.'}
                  </p>
                </div>
              </div>

              {/* Checks Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Security Audit Log</h3>
                </div>
                <CheckItem 
                  label="Environment Variables & Secrets" 
                  passed={!result.env_vars_issues || result.env_vars_issues.length === 0} 
                  delay={0.1} 
                  description="Checks for accidentally committed environment variables, hidden files like .env, or hardcoded secrets."
                  issues={result.env_vars_issues}
                />
                <CheckItem 
                  label="API Keys & Authentication Tokens" 
                  passed={!result.api_keys_issues || result.api_keys_issues.length === 0} 
                  delay={0.2} 
                  description="Checks for exposed API keys, authentication tokens, and cryptographic keys."
                  issues={result.api_keys_issues}
                />
                <CheckItem 
                  label="Database Connection Strings" 
                  passed={!result.db_uris_issues || result.db_uris_issues.length === 0} 
                  delay={0.3} 
                  description="Checks for exposed database connection strings containing embedded passwords."
                  issues={result.db_uris_issues}
                />
              </div>

              <div className="mt-10 pt-8 border-t border-slate-800/50 flex justify-center">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">
                  Verified by GenLayer StudioNet Consensus
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 mb-8 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/60 rounded-full border border-slate-800/80 hover:border-indigo-500/30 transition-all hover:bg-slate-900/80 hover:shadow-lg hover:shadow-indigo-500/10 backdrop-blur-md">
            <span className="text-[13px] text-slate-400 font-medium tracking-wide">
              Built by <a href="https://x.com/lamide_nova" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">ODbeke</a>
            </span>
          </div>
          <p className="text-slate-600 text-[10px] font-mono uppercase tracking-widest">
            &copy; 2026 Repo Scanner • Decentralized Security Protocol
          </p>
        </footer>
      </div>
    </div>
  );
}
