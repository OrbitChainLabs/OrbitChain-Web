'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Copy, Check, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api/auth';
import { truncateAddress } from '@/lib/stellar/formatting';

// Generate a unique gradient background derived from the wallet address
function getWalletGradient(address: string) {
  if (!address) return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = Math.abs((hash * 17) % 360);
  return `linear-gradient(135deg, hsl(${hue1}, 75%, 55%), hsl(${hue2}, 80%, 40%))`;
}

export default function WalletDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { address, balance, balanceError, disconnect } = useWalletStore();

  const handleDisconnect = async () => {
    setIsOpen(false);
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Failed to invalidate session on backend:', err);
    }
    // Clear auth store state (resets JWT, user, etc.)
    useAuthStore.getState().logout();
    // Clear wallet store state
    disconnect();
    // Redirect to home page
    router.push('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (!address) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 px-3 rounded-lg border border-border bg-card hover:bg-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Wallet menu"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm select-none shrink-0"
          style={{ background: getWalletGradient(address) }}
        >
          {address.slice(0, 2)}
        </div>
        <div className="flex flex-col items-start leading-tight text-left">
          <span className="text-xs font-semibold text-foreground">
            {truncateAddress(address)}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {balanceError
              ? 'Balance unavailable'
              : balance
                ? `${parseFloat(balance).toFixed(2)} XLM`
                : '0.00 XLM'}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border border-border py-2 z-50 transition-all duration-200 transform origin-top-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* Wallet Info Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md select-none shrink-0"
            style={{ background: getWalletGradient(address) }}
          >
            {address.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate" title={address}>
              {address}
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {balanceError
                ? 'Balance unavailable'
                : balance
                  ? `${parseFloat(balance).toFixed(4)} XLM`
                  : '0.0000 XLM'}
            </p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          {/* Copy Address */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors duration-150 focus:outline-none focus:bg-muted"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-green-600 font-semibold">Address copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Copy full address</span>
              </>
            )}
          </button>

          {/* View on Explorer */}
          <a
            href={`https://stellar.expert/explorer/testnet/account/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors duration-150 focus:outline-none focus:bg-muted"
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>View on StellarExpert</span>
          </a>

          {/* Disconnect */}
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors duration-150 focus:outline-none focus:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Disconnect Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
