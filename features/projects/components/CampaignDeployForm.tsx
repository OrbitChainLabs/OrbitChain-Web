'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader,
  ExternalLink,
  Copy,
} from 'lucide-react';

interface CampaignDeployFormProps {
  formData: Record<string, unknown>;
  onBack: () => void;
  onSuccess: (campaignId: string) => void;
}

interface DeployState {
  status: 'idle' | 'deploying' | 'success' | 'error';
  message?: string;
  campaignId?: string;
  txHash?: string;
  contractId?: string;
  network?: string;
  error?: string;
}

const CONTRACT_PARAMETERS = {
  ESTIMATED_STORAGE_FEE: 0.5,
  ESTIMATED_OPERATION_FEE: 0.1,
  TOTAL_ESTIMATED_FEE: 0.6,
};

const CONFIGURED_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

function explorerUrl(txHash: string, network: string): string {
  const net = network === 'mainnet' ? 'mainnet' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

export const CampaignDeployForm: React.FC<CampaignDeployFormProps> = ({
  formData,
  onBack,
  onSuccess,
}) => {
  const [deployState, setDeployState] = useState<DeployState>({
    status: 'idle',
  });
  const [copied, setCopied] = useState(false);

  const campaignTitle = (formData.title as string) || 'Campaign';
  const goalAmount = (formData.goalAmount as number) || 0;
  const network = CONFIGURED_NETWORK;
  const acceptedAssets = (formData.acceptedAssets as string[]) || [];
  const duration = (formData.campaignDuration as number) || 0;

  const handleDeploy = async () => {
    try {
      setDeployState({
        status: 'deploying',
        message: 'Deploying campaign to Stellar blockchain...',
      });

      // Real submission: the server builds, signs (platform admin key), and
      // submits the Soroban invocation, then registers the campaign with the
      // backend. Every value below is real; failures surface specific errors.
      const response = await fetch('/api/campaigns/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle,
          goalAmount,
          campaignDurationDays: duration,
          acceptedAssets: acceptedAssets.map((code) => ({ code })),
          minDonationAmount: 0.001,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        data?: { campaignId?: string; txHash?: string; contractId?: string; network?: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Campaign deployment failed');
      }

      const { campaignId, txHash, contractId, network: deployedNetwork } = payload?.data ?? {};

      if (!campaignId || !txHash) {
        throw new Error('Deployment returned incomplete data');
      }

      setDeployState({
        status: 'success',
        message: 'Campaign deployed successfully!',
        campaignId,
        txHash,
        contractId,
        network: deployedNetwork,
      });

      // Redirect after 3 seconds
      setTimeout(() => {
        onSuccess(campaignId);
      }, 3000);
    } catch (err) {
      setDeployState({
        status: 'error',
        error:
          err instanceof Error ? err.message : 'Failed to deploy campaign',
      });
    }
  };

  const handleRetry = () => {
    setDeployState({ status: 'idle' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show success screen
  if (deployState.status === 'success') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Campaign Deployed Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            Your campaign has been secured on the Stellar blockchain.
          </p>

          {/* Success Details */}
          <div className="bg-green-50 rounded-lg p-6 border border-green-200 text-left space-y-4 max-w-lg mx-auto mb-6">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">Campaign ID</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-white px-3 py-2 rounded border flex-1 text-left">
                  {deployState.campaignId}
                </code>
                <button
                  onClick={() => copyToClipboard(deployState.campaignId || '')}
                  className="p-2 hover:bg-green-100 rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">
                Transaction Hash
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-white px-3 py-2 rounded border flex-1 text-left truncate">
                  {deployState.txHash}
                </code>
                <a
                  href={explorerUrl(deployState.txHash || '', deployState.network || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-green-100 rounded transition-colors"
                  title="View on Stellar Expert"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
                <button
                  onClick={() => copyToClipboard(deployState.txHash || '')}
                  className="p-2 hover:bg-green-100 rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {deployState.contractId && (
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Contract</p>
                <code className="text-sm font-mono bg-white px-3 py-2 rounded border flex-1 text-left break-all block">
                  {deployState.contractId}
                </code>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">Network</p>
              <p className="text-sm font-medium text-gray-900">{deployState.network || network}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Redirecting to campaign page in 3 seconds...
          </p>
        </div>
      </div>
    );
  }

  // Show error screen
  if (deployState.status === 'error') {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">
                Deployment Failed
              </h3>
              <p className="text-sm text-red-800 mb-4">{deployState.error}</p>
              <details className="text-xs text-red-700">
                <summary className="cursor-pointer font-medium">
                  Technical Details
                </summary>
                <p className="mt-2 p-2 bg-red-100 rounded font-mono">
                  {deployState.error}
                </p>
              </details>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Troubleshooting:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Ensure the deployment is configured (contract id, admin key, Soroban RPC)</li>
              <li>Make sure the admin account is funded on the target network</li>
              <li>Check that you are signed in so the campaign can be registered</li>
              <li>Try again if the Soroban RPC was temporarily unavailable</li>
            </ul>
          </p>
        </div>

        <div className="flex justify-between pt-6">
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={handleRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show deploying screen
  const isDeploying = deployState.status === 'deploying';

  if (isDeploying) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Deploying Campaign
          </h2>
          <p className="text-gray-600">
            Submitting the signed transaction to the Soroban RPC and registering
            the campaign with the backend...
          </p>

          {/* Progress indicators */}
          <div className="mt-8 max-w-md mx-auto space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                ✓
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Validation</p>
                <p className="text-xs text-gray-500">Campaign data verified</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold animate-pulse">
                <Loader className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">
                  On-chain Deployment
                </p>
                <p className="text-xs text-gray-500">
                  Building, signing, and submitting to Soroban...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                3
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">
                  Backend Registration
                </p>
                <p className="text-xs text-gray-500">
                  Registering the campaign with OrbitChain-API...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show idle/initial state
  const isIdle = deployState.status === 'idle';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Deploy Campaign
        </h2>
        <p className="text-gray-600">
          Review the deployment parameters and deploy your campaign on the
          Stellar blockchain. The transaction is signed with the platform
          admin key and submitted to the configured Soroban RPC.
        </p>
      </div>

      {/* Deployment Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
        {/* Campaign Details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Campaign Details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Campaign Name</p>
              <p className="font-medium text-gray-900">{campaignTitle}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Funding Goal</p>
              <p className="font-medium text-gray-900">
                {goalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Campaign Duration</p>
              <p className="font-medium text-gray-900">{duration} days</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Accepted Assets</p>
              <p className="font-medium text-gray-900">
                {acceptedAssets.join(', ')}
              </p>
            </div>
          </div>
        </div>

        {/* Contract Parameters */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Smart Contract Parameters
          </h3>
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Network</p>
              <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {network}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Contract Type</p>
              <p className="text-sm font-medium text-gray-900">
                Crowdfunding Campaign
              </p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Soroban Runtime</p>
              <p className="text-sm font-medium text-gray-900">Enabled</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Verification</p>
              <p className="text-sm font-medium text-gray-900">
                Admin-approved after submission
              </p>
            </div>
          </div>
        </div>

        {/* Network Fees */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Estimated Network Fees</h3>
          <div className="space-y-2 bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Operation Fee</p>
              <p className="text-sm font-medium text-gray-900">
                {CONTRACT_PARAMETERS.ESTIMATED_OPERATION_FEE} XLM
              </p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">Storage Fee (estimated)</p>
              <p className="text-sm font-medium text-gray-900">
                {CONTRACT_PARAMETERS.ESTIMATED_STORAGE_FEE} XLM
              </p>
            </div>
            <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between items-center">
              <p className="text-sm font-semibold text-gray-900">Total Estimated</p>
              <p className="text-lg font-bold text-blue-600">
                {CONTRACT_PARAMETERS.TOTAL_ESTIMATED_FEE} XLM
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            💡 Fees may vary slightly based on network conditions. You'll see
            the exact amount before signing.
          </p>
        </div>

        {/* Important Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            <strong>⚠️ Important:</strong> Once deployed, campaign details
            cannot be modified. Please verify all information before proceeding.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-4 pt-6 border-t">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex items-center gap-2"
          disabled={!isIdle}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          onClick={handleDeploy}
          disabled={!isIdle}
          className={`flex items-center gap-2 ${
            isIdle
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-400 text-white cursor-not-allowed'
          }`}
        >
          {isIdle && (
            <>
              🚀 Deploy Campaign
            </>
          )}
          {!isIdle && (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Deploying...
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
