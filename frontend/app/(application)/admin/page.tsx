"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Header } from "@/components/header";
import KycOracleTab from "@/components/Admin/KycOracleTab";
import GlobalConfigsTab from "@/components/Admin/GlobalConfigsTab";
import TreasuryTab from "@/components/Admin/TreasuryTab";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { celoSepolia } from "@/lib/celoSepolia";

const HARDCODED_ADMIN = "0xE282B88468E0554477a7580956c1f65939B623D8";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("kyc");
  const [isClient, setIsClient] = useState(false);

  // Read contract owner address from the contract ('mine' variable)
  const { data: contractOwner } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "mine",
    chainId: celoSepolia.id,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Avoid hydration mismatch
  if (!isClient) return null;

  const userAddressLower = address?.toLowerCase();
  const ownerAddressLower = (contractOwner as string)?.toLowerCase();
  
  // Authorize if connected user is deployer or the designated admin wallet
  const isAdmin =
    userAddressLower === HARDCODED_ADMIN.toLowerCase() ||
    userAddressLower === "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" ||
    (ownerAddressLower && userAddressLower === ownerAddressLower);

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 pb-20">
      {/* Premium Desktop Header */}
      <div className="hidden sm:block">
        <Header />
      </div>

      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">System Admin Dashboard</h1>
        </div>

        {!isConnected ? (
          <CardContainer>
            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Wallet Disconnected</h2>
            <p className="text-gray-500 text-sm text-center max-w-sm mb-4">
              Please connect your administrative Web3 wallet to authorize platform management features.
            </p>
          </CardContainer>
        ) : !isAdmin ? (
          <CardContainer>
            <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-500 text-sm text-center max-w-md mb-4">
              Your connected address <b>{address}</b> is not authorized as the contract owner or platform administrator.
            </p>
            <p className="text-xs text-gray-400">
              Required: <b>{HARDCODED_ADMIN}</b> or Owner: <b>{contractOwner as string}</b>
            </p>
          </CardContainer>
        ) : (
          <div className="space-y-6">
            {/* Custom Tab Routing Navigation */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-6 sm:space-x-8">
                <button
                  onClick={() => setActiveTab("kyc")}
                  className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                    activeTab === "kyc"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  KYC Oracle SBT
                </button>
                <button
                  onClick={() => setActiveTab("configs")}
                  className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                    activeTab === "configs"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Platform settings
                </button>
                <button
                  onClick={() => setActiveTab("treasury")}
                  className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                    activeTab === "treasury"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Platform treasury
                </button>
              </nav>
            </div>

            {/* Render selected configuration tab */}
            <div className="transition-all duration-200">
              {activeTab === "kyc" && <KycOracleTab />}
              {activeTab === "configs" && <GlobalConfigsTab />}
              {activeTab === "treasury" && <TreasuryTab />}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-xl shadow-md min-h-[300px]">
      {children}
    </div>
  );
}
