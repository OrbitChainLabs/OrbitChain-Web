'use client';

import { useState, useEffect } from 'react';
import { Share2, Twitter, Linkedin, MessageCircle, Copy, Check } from 'lucide-react';
import { toast } from '@/utils/toast';
import { useWalletStore } from '@/store/walletStore';

interface ShareButtonsProps {
  campaignId: string;
  campaignTitle: string;
  campaignUrl: string;
  shareCount?: number;
}

export function ShareButtons({
  campaignId,
  campaignTitle,
  campaignUrl,
  shareCount = 0,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState(shareCount);
  const [isLoading, setIsLoading] = useState(false);
  const walletAddress = useWalletStore((state) => state.address);

  const shareMessage = `Support "${campaignTitle}" on OrbitChain. Every contribution helps make a difference! 🌟`;

  // The server-side stats are the source of truth for the count; the
  // shareCount prop is only the initial fallback.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/campaigns/${campaignId}/shares/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.data?.totalShares !== undefined) {
          setShares(data.data.totalShares);
        }
      })
      .catch(() => {
        // Keep the prop value when the stats route is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleShare = async (platform: 'twitter' | 'linkedin' | 'whatsapp' | 'copy') => {
    setIsLoading(true);
    try {
      // Track share in backend. Only a connected wallet counts — an absent
      // identity must not inflate the stats.
      let recorded = false;
      if (walletAddress) {
        const res = await fetch(`/api/campaigns/${campaignId}/shares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, walletAddress }),
        });
        recorded = res.ok;
      } else {
        toast.info('Connect a wallet to track this share');
      }

      if (recorded) {
        setShares((prev) => prev + 1);
      }

      switch (platform) {
        case 'twitter':
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(campaignUrl)}`,
            'twitter-share',
            'width=550,height=420'
          );
          toast.success('Shared on Twitter!');
          break;

        case 'linkedin':
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(campaignUrl)}`,
            'linkedin-share',
            'width=750,height=600'
          );
          toast.success('Shared on LinkedIn!');
          break;

        case 'whatsapp':
          window.open(
            `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${campaignUrl}`)}`,
            'whatsapp-share'
          );
          toast.success('Shared on WhatsApp!');
          break;

        case 'copy':
          await navigator.clipboard.writeText(campaignUrl);
          setCopied(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
          break;
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to track share');
    } finally {
      setIsLoading(false);
    }
  };

  const shareButtons = [
    {
      id: 'twitter',
      label: 'Twitter',
      icon: Twitter,
      color: 'hover:bg-blue-100 hover:text-blue-600',
      onClick: () => handleShare('twitter'),
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      icon: Linkedin,
      color: 'hover:bg-blue-100 hover:text-blue-700',
      onClick: () => handleShare('linkedin'),
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageCircle,
      color: 'hover:bg-green-100 hover:text-green-600',
      onClick: () => handleShare('whatsapp'),
    },
    {
      id: 'copy',
      label: 'Copy Link',
      icon: copied ? Check : Copy,
      color: 'hover:bg-gray-100 hover:text-gray-700',
      onClick: () => handleShare('copy'),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Share Campaign</span>
        {shares > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {shares} {shares === 1 ? 'share' : 'shares'}
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {shareButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={btn.onClick}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium transition-colors ${
                btn.color
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={btn.label}
              aria-label={btn.label}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
