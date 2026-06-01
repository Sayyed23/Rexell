"use client";

import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";

interface WarningModalProps {
  isOpen: boolean;
  riskLevel: string; // HIGH, MEDIUM, LOW
  dominantRisk: string;
  confidenceScore: number;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Premium, security-focused verification alert modal shown when the AI risk pipeline
 * issues an EnforcementAction.WARNING. Halts purchasing flows to demand explicit human
 * confirmation (FR-5.3.4). Built with sharp geometric borders and high-contrast styling
 * to respect the Purple Ban and evoke high-tech security trust.
 */
export function WarningModal({
  isOpen,
  riskLevel,
  dominantRisk,
  confidenceScore,
  reason,
  onConfirm,
  onCancel,
}: WarningModalProps) {
  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md border-2 border-amber-500 bg-slate-900 text-slate-100 p-6 shadow-2xl rounded-sm transition-all duration-300 transform scale-100"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-amber-500/10 text-amber-500">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-50 uppercase">
                AI Transaction Advisory
              </h2>
              <p className="text-xs text-amber-500 font-mono tracking-wider">
                RISK LEVEL: {riskLevel}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            aria-label="Close advisory"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3 bg-amber-500/5 border-l-2 border-amber-500 p-3 rounded-sm">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">
              Our automated anti-scalping models flagged transaction anomalies. Please verify details before proceeding.
            </p>
          </div>

          {/* Metrics Panel */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 border border-slate-800 rounded-sm font-mono text-xs">
            <div>
              <span className="text-slate-500 block">RISK FACTOR:</span>
              <span className="text-slate-200 font-semibold uppercase">{dominantRisk}</span>
            </div>
            <div>
              <span className="text-slate-500 block">AI CONFIDENCE:</span>
              <span className="text-slate-200 font-semibold">
                {(confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="col-span-2 border-t border-slate-800 pt-2 mt-1">
              <span className="text-slate-500 block">DETECTION SUMMARY:</span>
              <span className="text-slate-300 text-[11px] font-sans leading-normal block mt-1">
                {reason}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            By confirming below, you verify that this request is a legitimate purchase for personal attendance and adheres to the Rexell Resale Rules.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 border border-slate-700 bg-transparent text-slate-300 text-sm font-semibold rounded-sm hover:bg-slate-800 hover:text-slate-100 transition-all active:scale-95 uppercase tracking-wider font-mono"
          >
            Cancel Purchase
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-slate-950 text-sm font-bold rounded-sm hover:bg-amber-400 transition-all active:scale-95 uppercase tracking-wider font-mono shadow-lg shadow-amber-500/20"
          >
            Proceed Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
