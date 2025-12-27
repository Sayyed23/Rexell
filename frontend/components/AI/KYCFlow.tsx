"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { soulboundIdentityAbi, soulboundIdentityAddress } from "@/blockchain/abi/soulbound-abi";
import { Button } from "@/components/ui/button";
import { CheckCircle, ShieldCheck, Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { celoSepolia } from "@/lib/celoSepolia";

// Inline Dialog Component
const CustomDialog = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative z-50 bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
                    <X className="h-4 w-4" />
                </button>
                {children}
            </div>
        </div>
    );
};

// Inline Progress Component
const CustomProgress = ({ value }: { value: number }) => (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
            className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
            style={{ width: `${value}%` }}
        />
    </div>
);

export function KYCFlow({ onVerified }: { onVerified?: () => void }) {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0); // 0: Start, 1: Upload, 2: Face Scan, 3: Processing, 4: Success
    const [progress, setProgress] = useState(0);

    // Check if already verified
    const { data: isVerified } = useReadContract({
        address: soulboundIdentityAddress as `0x${string}`,
        abi: soulboundIdentityAbi,
        functionName: "hasValidIdentity",
        args: [address as `0x${string}`],
        query: {
            enabled: isConnected && !!soulboundIdentityAddress,
        },
        chainId: celoSepolia.id,
    });

    const startVerification = () => {
        setStep(1);
    };

    const handleUpload = () => {
        // Mock upload delay
        setTimeout(() => setStep(2), 1500);
    };

    const handleFaceScan = () => {
        // Mock scan delay and processing
        setStep(3);
        let p = 0;
        const interval = setInterval(() => {
            p += 10;
            setProgress(p);
            if (p >= 100) {
                clearInterval(interval);
                submitVerification();
            }
        }, 300);
    };

    const submitVerification = async () => {
        try {
            // In a real app, this would call a backend API which verifies the data and mints the SBT.
            // For this demo, we assume the user is the owner/admin or we rely on a manual trigger.

            const hash = await writeContractAsync({
                address: soulboundIdentityAddress as `0x${string}`,
                abi: soulboundIdentityAbi,
                functionName: "mintIdentity",
                args: [address as `0x${string}`, BigInt(95)], // High score
            });

            if (hash) {
                setStep(4);
                toast.success("Identity Verified successfully!");
                if (onVerified) onVerified();
            }
        } catch (error: any) {
            console.error("Verification failed:", error);
            toast.error("Verification failed: " + (error.message || "Unknown error"));
            setStep(0); // Reset
        }
    };

    if (isVerified) {
        return (
            <Button variant="outline" className="gap-2 border-green-500 text-green-600 cursor-default bg-green-50">
                <ShieldCheck className="w-4 h-4" /> verified Seller
            </Button>
        );
    }

    return (
        <>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setIsOpen(true)}>
                <ShieldCheck className="w-4 h-4" /> Verify Identity
            </Button>

            <CustomDialog open={isOpen} onClose={() => setIsOpen(false)}>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Identity Verification</h2>
                    <p className="text-sm text-muted-foreground">
                        To sell tickets, you must complete AI-powered identity verification.
                    </p>
                </div>

                {step === 0 && (
                    <div className="space-y-4 py-4">
                        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                            <ShieldCheck className="w-6 h-6 text-blue-600 mt-1" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Why verify?</h4>
                                <p className="text-sm text-blue-700">Rexell uses AI to prevent fraud and scalping. Your identity is secured on-chain as a Soulbound Token.</p>
                            </div>
                        </div>
                        <Button onClick={startVerification} className="w-full">Start Verification</Button>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-4 py-4 text-center">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors" onClick={handleUpload}>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Click to upload Government ID</p>
                        </div>
                        <Button onClick={handleUpload} className="w-full">Upload & Continue</Button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 py-4 text-center">
                        <div className="bg-black rounded-xl h-48 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-50 bg-[url('https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
                            <div className="z-10 text-white flex flex-col items-center">
                                <Camera className="w-12 h-12 mb-2 animate-pulse" />
                                <p>Position your face...</p>
                            </div>
                        </div>
                        <Button onClick={handleFaceScan} className="w-full">Capture & Verify</Button>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 py-8">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Analyzing Biometrics...</span>
                                <span>{progress}%</span>
                            </div>
                            <CustomProgress value={progress} />
                        </div>
                        <p className="text-center text-sm text-gray-500">Checking against global fraud database...</p>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-4 py-4 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-green-800">Verification Successful!</h3>
                        <p className="text-gray-600">You have been issued a Soulbound Identity Token.</p>
                        <Button onClick={() => setIsOpen(false)} className="w-full mt-4">Return to Marketplace</Button>
                    </div>
                )}
            </CustomDialog>
        </>
    );
}
