"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ForecastResult {
    suggestedPrice: number;
    low: number;
    high: number;
    expectedMarkupPct: number;
    confidence: number;
    basis: string;
    currency: string;
}

interface Props {
    eventId: string;
    originalPrice: number; // in cUSD (human units)
    maxPrice?: number; // optional cap (cUSD) from the contract
    onApply: (price: string) => void;
}

/**
 * AI-suggested resale price band, powered by the LSTM forecaster in the
 * ai-insights service. Degrades silently if the service is unavailable so the
 * resale flow is never blocked.
 */
export function ResalePriceSuggestion({ eventId, originalPrice, maxPrice, onApply }: Props) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ForecastResult | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        if (!originalPrice || originalPrice <= 0) {
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const resp = await fetch("/api/ai/forecast", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId, originalPrice }),
                });
                if (!resp.ok) throw new Error("forecast failed");
                const json = (await resp.json()) as ForecastResult;
                if (active) setData(json);
            } catch {
                if (active) setFailed(true);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [eventId, originalPrice]);

    if (failed) return null; // graceful: no suggestion shown

    const clamp = (v: number) => (maxPrice && maxPrice > 0 ? Math.min(v, maxPrice) : v);

    return (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-purple-800 font-medium text-sm">
                <Sparkles className="h-4 w-4" />
                AI Suggested Resale Price
            </div>

            {loading ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-purple-700">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing resale history…
                </div>
            ) : data ? (
                <div className="mt-2 space-y-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-purple-900">
                            {clamp(data.suggestedPrice).toFixed(2)} {data.currency}
                        </span>
                        <span className="text-xs text-purple-600">
                            range {clamp(data.low).toFixed(2)}–{clamp(data.high).toFixed(2)}
                        </span>
                    </div>
                    <p className="text-xs text-purple-700">
                        Expected markup {data.expectedMarkupPct.toFixed(1)}% · confidence{" "}
                        {(data.confidence * 100).toFixed(0)}% ·{" "}
                        {data.basis === "lstm" ? "LSTM model" : "historical baseline"}
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-purple-300 text-purple-800 hover:bg-purple-100"
                        onClick={() => onApply(clamp(data.suggestedPrice).toFixed(2))}
                    >
                        Use suggested price
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
