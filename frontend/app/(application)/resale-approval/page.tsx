"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import ResaleApprovalDashboard from "@/components/ResaleApprovalDashboard";

export default function ResaleApprovalPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("pending");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render anything on the server to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-100">
      <div className="hidden sm:block">
        <Header />
      </div>
      
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">Resale Approval Dashboard</h1>
        
        {!isConnected ? (
          <div className="flex h-screen items-center justify-center">
            <p className="text-lg text-gray-600">Please connect your wallet</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "pending"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Pending Requests
                </button>
                <button
                  onClick={() => setActiveTab("approved")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "approved"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Approved Resales
                </button>
                <button
                  onClick={() => setActiveTab("rejected")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "rejected"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Rejected Requests
                </button>
              </nav>
            </div>
            
            <ResaleApprovalDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        )}
      </div>
    </main>
  );
}