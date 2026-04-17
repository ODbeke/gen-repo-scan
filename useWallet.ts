import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider } from 'ethers';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: string | null;
}

export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    chainId: null,
  });

  const GENLAYER_RPC_URL = (import.meta.env.VITE_GENLAYER_RPC_URL && import.meta.env.VITE_GENLAYER_RPC_URL !== 'undefined') 
    ? import.meta.env.VITE_GENLAYER_RPC_URL 
    : 'https://studio.genlayer.com/api';
  const GENLAYER_CHAIN_ID = '0xf22f'; // 61999 in hex

  const isAddress = (addr: any): addr is string => {
    return !!addr && typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const checkWallet = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setState(s => ({ ...s, error: 'Please install a Web3 wallet (like MetaMask) to use this feature.' }));
      return false;
    }
    return true;
  }, []);

  const connect = async () => {
    const hasWallet = await checkWallet();
    if (!hasWallet) return;

    setState(s => ({ ...s, isConnecting: true, error: null }));
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = '0x' + network.chainId.toString(16);
      
      if (!isAddress(address)) {
        throw new Error('Invalid account address received from wallet.');
      }

      setState({
        address: address,
        isConnected: true,
        isConnecting: false,
        error: null,
        chainId: chainId,
      });

      // Handle network switch if needed
      await switchNetwork();
    } catch (err: any) {
      console.error('Connection error:', err);
      setState(s => ({ 
        ...s, 
        isConnecting: false, 
        error: err.code === 4001 ? 'Connection rejected by user.' : 'Failed to connect wallet.' 
      }));
    }
  };

  const disconnect = () => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      chainId: null,
    });
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GENLAYER_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: GENLAYER_CHAIN_ID,
                chainName: 'GenLayer StudioNet',
                rpcUrls: [GENLAYER_RPC_URL],
                nativeCurrency: {
                  name: 'GEN',
                  symbol: 'GEN',
                  decimals: 18,
                },
                blockExplorerUrls: [], // Add if available
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add GenLayer network', addError);
        }
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccounts = async (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          try {
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            if (isAddress(address)) {
              setState(s => ({ ...s, address: address, isConnected: true }));
            } else {
              setState(s => ({ ...s, address: null, isConnected: false }));
            }
          } catch (e) {
            console.error('Error handling account change:', e);
            setState(s => ({ ...s, address: null, isConnected: false }));
          }
        } else {
          setState(s => ({ ...s, address: null, isConnected: false }));
        }
      };

      const handleChain = (chainId: string) => {
        setState(s => ({ ...s, chainId }));
      };

      window.ethereum.on('accountsChanged', handleAccounts);
      window.ethereum.on('chainChanged', handleChain);

      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccounts);
          window.ethereum.removeListener('chainChanged', handleChain);
        }
      };
    }
  }, []);

  const truncatedAddress = state.address 
    ? `${state.address.slice(0, 6)}...${state.address.slice(-4)}`
    : null;

  return {
    ...state,
    connect,
    disconnect,
    truncatedAddress,
  };
};
