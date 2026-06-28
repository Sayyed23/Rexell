"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { soulboundIdentityAbi, soulboundIdentityAddress } from "@/blockchain/abi/soulbound-abi";
import { tokencUSDAbi, tokencUSDContractAddress } from "@/blockchain/cUSD/TokenCusd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, ShieldX, UserPlus, Coins, Clock, Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { celoSepolia } from "@/lib/celoSepolia";
import { parseEther } from "viem";
import { logAppActivity } from "@/lib/activityLogger";

// Inline Dialog Component
const CustomDialog = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-gray-100 transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                </button>
                {children}
            </div>
        </div>
    );
};

export function KYCFlow({ onVerified }: { onVerified?: () => void }) {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isOpen, setIsOpen] = useState(false);
    const [statusData, setStatusData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Action States
    const [voucheeAddress, setVoucheeAddress] = useState("");
    const [vouching, setVouching] = useState(false);
    
    const [stakeAmount, setStakeAmount] = useState("");
    const [staking, setStaking] = useState(false);
    
    const [minting, setMinting] = useState(false);

    // Fetch Anti-Sybil status from Oracle backend
    const fetchStatus = async () => {
        if (!address) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/identity/status?user_address=${address}`);
            if (res.ok) {
                const data = await res.json();
                setStatusData(data);
                if (data.score >= 70 && onVerified) {
                    onVerified();
                }
            } else {
                console.error("Failed to fetch Anti-Sybil status");
            }
        } catch (err) {
            console.error("Error fetching Anti-Sybil status:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected && address) {
            fetchStatus();
        }
    }, [isConnected, address]);

    // Request new Soulbound Identity
    const handleMintIdentity = async () => {
        if (!address) return;
        setMinting(true);
        try {
            // 1. Fetch EIP-712 signatures from oracle
            toast.info("Requesting verification signatures from oracle...");
            const res = await fetch("http://localhost:5000/api/identity/request-signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_address: address }),
            });
            if (!res.ok) {
                throw new Error("Oracle signatures request failed.");
            }
            const data = await res.json();
            const { riskMultiplier, timestamp, signatures } = data;

            // Base Stake = 25 cUSD
            const baseStakeWei = 25n * 10n**18n;
            const requiredStakeWei = (baseStakeWei * BigInt(riskMultiplier)) / 100n;

            // 2. Approve cUSD if necessary
            toast.info(`Approving cUSD staking (${Number(requiredStakeWei) / 1e18} cUSD)...`);
            
            // Check allowance first
            let allowance = 0n;
            if (publicClient) {
                allowance = await publicClient.readContract({
                    address: tokencUSDContractAddress as `0x${string}`,
                    abi: tokencUSDAbi,
                    functionName: "allowance",
                    args: [address as `0x${string}`, soulboundIdentityAddress as `0x${string}`],
                });
            }

            if (allowance < requiredStakeWei) {
                const approveHash = await writeContractAsync({
                    address: tokencUSDContractAddress as `0x${string}`,
                    abi: tokencUSDAbi,
                    functionName: "approve",
                    args: [soulboundIdentityAddress as `0x${string}`, requiredStakeWei],
                });
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                } else {
                    await new Promise(resolve => setTimeout(resolve, 4000));
                }
            }

            // 3. Call requestIdentity with EIP-712 signatures
            toast.info("Minting Soulbound Identity RID NFT...");
            const mintHash = await writeContractAsync({
                address: soulboundIdentityAddress as `0x${string}`,
                abi: soulboundIdentityAbi,
                functionName: "requestIdentity",
                args: [BigInt(riskMultiplier), BigInt(timestamp), signatures],
            });
            
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: mintHash });
            }
            toast.success("Soulbound Identity RID NFT issued!");
            await logAppActivity(address, "MINT_IDENTITY", mintHash, {
                riskMultiplier: Number(riskMultiplier),
                stakeAmount: Number(requiredStakeWei) / 1e18
            });
            fetchStatus();
        } catch (err: any) {
            console.error(err);
            toast.error(`Minting failed: ${err.message || String(err)}`);
        } finally {
            setMinting(false);
        }
    };

    // Vouch for someone
    const handleVouch = async () => {
        if (!voucheeAddress) {
            toast.error("Please enter a vouchee address");
            return;
        }
        setVouching(true);
        try {
            toast.info(`Vouching for ${voucheeAddress.substring(0, 6)}... (Locks 15% stake)`);
            const hash = await writeContractAsync({
                address: soulboundIdentityAddress as `0x${string}`,
                abi: soulboundIdentityAbi,
                functionName: "vouch",
                args: [voucheeAddress as `0x${string}`],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }
            toast.success("Vouch registered successfully!");
            await logAppActivity(address || "", "VOUCH", hash, {
                vouchee: voucheeAddress
            });
            setVoucheeAddress("");
            fetchStatus();
        } catch (err: any) {
            console.error(err);
            toast.error(`Vouching failed: ${err.message || String(err)}`);
        } finally {
            setVouching(false);
        }
    };

    // Top up stake
    const handleTopUp = async () => {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        setStaking(true);
        try {
            const amountWei = parseEther(stakeAmount);
            toast.info(`Approving cUSD top-up of ${stakeAmount} cUSD...`);
            
            const approveHash = await writeContractAsync({
                address: tokencUSDContractAddress as `0x${string}`,
                abi: tokencUSDAbi,
                functionName: "approve",
                args: [soulboundIdentityAddress as `0x${string}`, amountWei],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
            } else {
                await new Promise(resolve => setTimeout(resolve, 4000));
            }

            toast.info("Locking additional collateral...");
            const stakeHash = await writeContractAsync({
                address: soulboundIdentityAddress as `0x${string}`,
                abi: soulboundIdentityAbi,
                functionName: "topUpStake",
                args: [amountWei],
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: stakeHash });
            }
            toast.success("Stake topped up successfully!");
            await logAppActivity(address || "", "TOPUP_STAKE", stakeHash, {
                amount: parseFloat(stakeAmount)
            });
            setStakeAmount("");
            fetchStatus();
        } catch (err: any) {
            console.error(err);
            toast.error(`Staking failed: ${err.message || String(err)}`);
        } finally {
            setStaking(false);
        }
    };

    const hasNoRID = statusData?.details?.stake_amount_cusd === 0 && statusData?.details?.vouches_count === 0;

    return (
        <>
            <Button 
                onClick={() => setIsOpen(true)}
                className={`gap-2 font-medium shadow-sm transition-all duration-200 ${
                    statusData?.score >= 70 
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200" 
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
            >
                {statusData?.score >= 70 ? (
                    <>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Score: {statusData?.score} (Trusted)</span>
                    </>
                ) : (
                    <>
                        <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
                        <span>Score: {statusData?.score || 0} (Needs Boost)</span>
                    </>
                )}
            </Button>

            <CustomDialog open={isOpen} onClose={() => setIsOpen(false)}>
                <div className="flex flex-col items-center text-center pb-4 border-b">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                        statusData?.score >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                        {statusData?.score >= 70 ? (
                            <ShieldCheck className="w-8 h-8" />
                        ) : (
                            <ShieldAlert className="w-8 h-8" />
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Anti-Sybil Identity Profile</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Rexell uses decentralized Sybil-resistance scores to authorize market listings and purchases.
                    </p>
                </div>

                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        <span className="text-sm text-gray-500">Querying identity score...</span>
                    </div>
                ) : (
                    <div className="space-y-6 py-4 overflow-y-auto max-h-[70vh]">
                        {/* 1. Score Display */}
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                            <div>
                                <span className="text-sm text-gray-500 block">Composite Trust Score</span>
                                <span className={`text-3xl font-extrabold ${
                                    statusData?.score >= 70 ? "text-emerald-600" : "text-amber-600"
                                }`}>
                                    {statusData?.score || 0} / 100
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm text-gray-500 block">Status</span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    statusData?.score >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                    {statusData?.score >= 70 ? "Authorized" : "Below 70 Threshold"}
                                </span>
                            </div>
                        </div>

                        {/* 2. Cooldown Alert */}
                        {statusData?.in_cooldown && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800">
                                <Clock className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm">Cluster Cooldown Active</h4>
                                    <p className="text-xs text-red-700 mt-1">
                                        Your wallet shares funding trails with other recently active wallets. A mandatory 14-day cooldown is active ({statusData.cooldown_days_remaining} days remaining). Staking and vouching boosts are locked during this cooldown period.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 3. Detailed Component Breakdown */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-gray-900">Reputation Component Breakdown</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <Card className="p-3 bg-gray-50/50">
                                    <span className="text-gray-500 block">Base Web3 Reputation</span>
                                    <span className="font-bold text-gray-800">{statusData?.base_score || 0} pts</span>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Age: {statusData?.details?.wallet_age_days || 0} days | Tx: {statusData?.details?.tx_count || 0}
                                    </div>
                                </Card>
                                <Card className="p-3 bg-gray-50/50">
                                    <span className="text-gray-500 block">Social Vouch Boost</span>
                                    <span className="font-bold text-blue-600">+{statusData?.vouch_boost || 0} pts</span>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Vouchees: {statusData?.details?.vouches_count || 0} active
                                    </div>
                                </Card>
                                <Card className="p-3 bg-gray-50/50 col-span-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-gray-500 block">On-chain Locked Collateral</span>
                                            <span className="font-bold text-amber-600">+{statusData?.stake_boost || 0} pts</span>
                                        </div>
                                        <span className="font-mono text-sm font-semibold">{statusData?.details?.stake_amount_cusd || 0} cUSD</span>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* 4. Actions Ladder */}
                        {!statusData?.in_cooldown && (
                            <div className="border-t pt-4 space-y-4">
                                <h3 className="font-semibold text-sm text-gray-900">Boost Your Score</h3>
                                
                                {hasNoRID && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-start gap-3 text-blue-800">
                                            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold text-sm">Issue Soulbound RID Identity</h4>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    You don&apos;t have a Soulbound RID NFT yet. Issue one to unlock vouching and collateral staking.
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={handleMintIdentity} 
                                            disabled={minting}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {minting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Mint Soulbound Identity (RID)"}
                                        </Button>
                                    </div>
                                )}

                                {!hasNoRID && (
                                    <>
                                        {/* Action: Top-up Stake */}
                                        <div className="space-y-2 border p-3 rounded-xl bg-gray-50/50">
                                            <div className="flex items-center gap-2 text-gray-800 font-semibold text-xs">
                                                <Coins className="w-4 h-4 text-amber-600" />
                                                <span>Method 1: Top-up Stake (Self-Serve)</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="number" 
                                                    placeholder="Amount (cUSD)" 
                                                    value={stakeAmount}
                                                    onChange={(e) => setStakeAmount(e.target.value)}
                                                    className="bg-white"
                                                />
                                                <Button 
                                                    onClick={handleTopUp} 
                                                    disabled={staking || !stakeAmount}
                                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                                >
                                                    {staking ? <Loader2 className="animate-spin w-4 h-4" /> : "Stake"}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-gray-500">Locks additional cUSD collateral. Each 25 cUSD locked adds 30 score points.</p>
                                        </div>

                                        {/* Action: Vouch */}
                                        <div className="space-y-2 border p-3 rounded-xl bg-gray-50/50">
                                            <div className="flex items-center gap-2 text-gray-800 font-semibold text-xs">
                                                <UserPlus className="w-4 h-4 text-blue-600" />
                                                <span>Method 2: Vouch for Friend (Social Link)</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="text" 
                                                    placeholder="Friend's address (0x...)" 
                                                    value={voucheeAddress}
                                                    onChange={(e) => setVoucheeAddress(e.target.value)}
                                                    className="bg-white font-mono text-xs"
                                                />
                                                <Button 
                                                    onClick={handleVouch} 
                                                    disabled={vouching || !voucheeAddress}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    {vouching ? <Loader2 className="animate-spin w-4 h-4" /> : "Vouch"}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-gray-500">Vouch for a new user. Locks 15% of your stake and instantly boots their score.</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CustomDialog>
        </>
    );
}
