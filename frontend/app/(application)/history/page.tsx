"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { celoSepolia } from "@/lib/celoSepolia";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Activity, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Ticket, 
  ShieldCheck, 
  ShieldAlert,
  Coins, 
  CheckCircle,
  Tag,
  ArrowRightLeft,
  Eye
} from "lucide-react";
import Link from "next/link";

const HARDCODED_ADMIN = "0xE282B88468E0554477a7580956c1f65939B623D8";

interface ActivityLog {
  id: number;
  user_address: string;
  action: string;
  tx_hash: string | null;
  details: any;
  timestamp: string;
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);

  const { data: contractOwner } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "mine",
    chainId: celoSepolia.id,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const userAddressLower = address?.toLowerCase();
  const ownerAddressLower = (contractOwner as string)?.toLowerCase();
  const isAdmin =
    userAddressLower === HARDCODED_ADMIN.toLowerCase() ||
    userAddressLower === "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" ||
    (ownerAddressLower && userAddressLower === ownerAddressLower);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const oracleUrl = process.env.NEXT_PUBLIC_IDENTITY_ORACLE_URL || "https://identity-oracle-180777648897.us-central1.run.app";
      const response = await fetch(`${oracleUrl}/api/activity/history`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Auto-refresh every 6 seconds
    const interval = setInterval(() => fetchLogs(true), 6000);
    return () => clearInterval(interval);
  }, []);

  // Filter logs based on search and action filters
  useEffect(() => {
    let result = logs;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          log.user_address.toLowerCase().includes(term) ||
          log.action.toLowerCase().includes(term) ||
          (log.tx_hash && log.tx_hash.toLowerCase().includes(term))
      );
    }

    if (filterAction !== "ALL") {
      result = result.filter((log) => log.action === filterAction);
    }

    setFilteredLogs(result);
  }, [searchTerm, filterAction, logs]);

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "MINT_IDENTITY":
        return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0 flex gap-1 items-center"><ShieldCheck className="w-3.5 h-3.5" /> Mint ID</Badge>;
      case "VOUCH":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 flex gap-1 items-center"><CheckCircle className="w-3.5 h-3.5" /> Vouch</Badge>;
      case "TOPUP_STAKE":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 flex gap-1 items-center"><Coins className="w-3.5 h-3.5" /> Stake Top-up</Badge>;
      case "BUY_TICKET":
        return <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-0 flex gap-1 items-center"><Ticket className="w-3.5 h-3.5" /> Buy Ticket</Badge>;
      case "LIST_RESALE":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 flex gap-1 items-center"><Tag className="w-3.5 h-3.5" /> List Resale</Badge>;
      case "BUY_RESALE":
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0 flex gap-1 items-center"><ArrowRightLeft className="w-3.5 h-3.5" /> Buy Resale</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getActionDetailsText = (log: ActivityLog) => {
    const details = log.details || {};
    switch (log.action.toUpperCase()) {
      case "MINT_IDENTITY":
        return `Minted identity with risk multiplier ${details.riskMultiplier || 100}% and stake ${details.stakeAmount || 0} cUSD`;
      case "VOUCH":
        return `Vouched for ${details.vouchee ? `${details.vouchee.substring(0, 6)}...${details.vouchee.substring(38)}` : "unknown address"}`;
      case "TOPUP_STAKE":
        return `Topped up collateral stake by ${details.amount || 0} cUSD`;
      case "BUY_TICKET":
        return `Bought ${details.quantity || 1} tickets for Event #${details.eventId} (${details.eventName || "General Admission"})`;
      case "LIST_RESALE":
        return `Listed Ticket #${details.tokenId} for resale at ${details.priceCusd || 0} cUSD`;
      case "BUY_RESALE":
        return `Purchased resale Ticket #${details.tokenId} for ${details.priceCusd || 0} cUSD`;
      default:
        return details.message || JSON.stringify(details);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " " + date.toLocaleDateString();
  };

  if (!isClient) return null;

  if (!isConnected || !isAdmin) {
    return (
      <main className="px-4 min-h-screen bg-slate-50/50 pb-16">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="container mx-auto py-8 max-w-2xl">
          <Card className="border-red-200 bg-white">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Unauthorized Access</h3>
              <p className="text-gray-500 text-center max-w-md">
                {!isConnected
                  ? "Please connect your administrative Web3 wallet to view activity logs."
                  : `Your connected address ${address} is not authorized to view this page. Only platform administrators can access activity logs.`}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 min-h-screen bg-slate-50/50 pb-16">
      <div className="hidden sm:block">
        <Header />
      </div>
      <div className="container mx-auto py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
              <Activity className="w-8 h-8 text-slate-800 animate-pulse" /> SQL Server Activity Logs
            </h1>
            <p className="text-gray-600 mt-1">Real-time audit log of all off-chain user actions, anti-sybil vouches, and purchases.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              fetchLogs();
            }}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Logs
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by user address, action, or transaction hash..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {["ALL", "MINT_IDENTITY", "VOUCH", "TOPUP_STAKE", "BUY_TICKET", "LIST_RESALE", "BUY_RESALE"].map((act) => (
              <Button
                key={act}
                variant={filterAction === act ? "default" : "outline"}
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                onClick={() => setFilterAction(act)}
                data-state={filterAction === act ? "active" : "inactive"}
              >
                {act === "ALL" ? "All" : act.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-20 bg-white rounded-xl" />
              </Card>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="border-dashed bg-white">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Activity className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No Activity Logs Found</h3>
              <p className="text-gray-500 text-center max-w-md">
                No logs match your filters. Perform transactions or interactions inside the app to populate this SQL Server registry.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="overflow-hidden hover:shadow-md transition-all duration-300 border-slate-100 bg-white">
                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getActionBadge(log.action)}
                      <span className="text-xs text-gray-400 font-medium">#{log.id}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        User: {formatAddress(log.user_address)}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {getActionDetailsText(log)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                    {log.tx_hash && (
                      <Button variant="outline" size="sm" asChild className="h-9 px-3">
                        <a
                          href={`https://sepolia.celoscan.io/tx/${log.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Explorer <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    {log.action.toUpperCase() === "BUY_TICKET" && log.details?.eventId && (
                      <Button variant="default" size="sm" asChild className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white">
                        <Link href={`/history/${log.details.tokenId || 0}`} className="flex items-center gap-1.5 text-xs">
                          Ticket Hist <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
