"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity, Sparkles, Loader2 } from "lucide-react";

interface DemandPoint {
  day: number;
  expectedSales: number;
}

interface DemandForecastResult {
  eventId: string;
  horizonDays: number;
  avgDailyDemand: number;
  points: DemandPoint[];
  trend: "up" | "down" | "flat";
  basis: string;
}

interface AIDemandForecastProps {
  eventId: string; // EVT_XXX format
}

/**
 * Premium AI Demand Forecast widget for event organizers.
 * Fetches predictive analytics from the LSTM forecasting engine via Next.js api proxy.
 * Styled with visual excellence, crisp geometric elements (rounded-sm), custom pure CSS
 * bar charts, and fully respects the Purple Ban by using deep slate and emerald/amber accents.
 */
export function AIDemandForecast({ eventId }: AIDemandForecastProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemandForecastResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!eventId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const resp = await fetch("/api/ai/forecast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "demand", eventId, horizonDays: 7 }),
        });
        if (!resp.ok) throw new Error("demand forecast failed");
        const json = (await resp.json()) as DemandForecastResult;
        if (active) setData(json);
      } catch (err) {
        console.error("AI demand fetch error:", err);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [eventId]);

  if (failed) return null; // Graceful degradation: hide if offline or errored

  if (loading) {
    return (
      <div className="border border-slate-800 bg-slate-900/50 p-6 rounded-sm space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
          <div className="h-4 w-32 bg-slate-800 rounded-sm"></div>
        </div>
        <div className="h-10 bg-slate-800 rounded-sm w-1/2"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded-sm w-3/4"></div>
          <div className="h-24 bg-slate-800 rounded-sm"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Find max sales to scale chart bars correctly
  const maxSales = Math.max(...data.points.map((p) => p.expectedSales), 1);

  return (
    <div className="border-2 border-slate-800 bg-slate-900 text-slate-100 p-6 shadow-xl rounded-sm transition-all duration-300">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-200">
            AI Demand Forecast
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          MODEL: {data.basis === "lstm" ? "LSTM_FORECASTER" : "HIST_BASELINE"}
        </span>
      </div>

      <div className="space-y-6">
        {/* Top metrics grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 border border-slate-800 rounded-sm">
            <span className="text-[10px] text-slate-500 font-mono block">
              AVG DAILY DEMAND:
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">
              {data.avgDailyDemand.toFixed(1)}
              <span className="text-xs text-slate-400 font-normal ml-1">tix</span>
            </span>
          </div>

          <div className="bg-slate-950 p-4 border border-slate-800 rounded-sm">
            <span className="text-[10px] text-slate-500 font-mono block">
              FORECAST TREND:
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {data.trend === "up" && (
                <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded-sm">
                  <TrendingUp className="h-4 w-4" /> TRENDING_UP
                </span>
              )}
              {data.trend === "down" && (
                <span className="flex items-center gap-1 text-amber-500 font-mono font-bold text-xs bg-amber-500/10 px-2 py-1 rounded-sm">
                  <TrendingDown className="h-4 w-4" /> COOLING_DOWN
                </span>
              )}
              {data.trend === "flat" && (
                <span className="flex items-center gap-1 text-slate-400 font-mono font-bold text-xs bg-slate-800 px-2 py-1 rounded-sm">
                  <Activity className="h-4 w-4" /> STABLE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Narrative */}
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          {data.trend === "up" &&
            "Primary ticket availability is causing robust spillover interest into secondary listings. Expect solid pricing flexibility."}
          {data.trend === "down" &&
            "Resale velocity is expected to cool mildly over the next 7 days. Price adjustments closer to face value are advised."}
          {data.trend === "flat" &&
            "Secondary market interest remains balanced. Stable listing volumes with predictable sales rates are forecasted."}
        </p>

        {/* Pure CSS/Tailwind Bar Chart */}
        <div className="bg-slate-950 p-4 border border-slate-800 rounded-sm">
          <h4 className="text-[10px] text-slate-500 font-mono mb-4 uppercase tracking-wider">
            Projected Daily Resale Volume (7 Days)
          </h4>
          <div className="flex items-end justify-between h-28 pt-2 px-2 gap-2">
            {data.points.map((p) => {
              const heightPct = `${Math.max(10, (p.expectedSales / maxSales) * 100)}%`;
              return (
                <div
                  key={p.day}
                  className="flex flex-col items-center flex-1 group"
                >
                  <div className="relative w-full flex flex-col justify-end h-20">
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 border border-slate-700 text-emerald-400 text-[10px] font-mono py-0.5 px-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-md">
                      {p.expectedSales.toFixed(1)} / day
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: heightPct }}
                      className="w-full bg-slate-800 border-t border-emerald-500/50 group-hover:bg-emerald-500/30 group-hover:border-emerald-400 transition-all duration-300 rounded-t-sm"
                    ></div>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-2">
                    D{p.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
