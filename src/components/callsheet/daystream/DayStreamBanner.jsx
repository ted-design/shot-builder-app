import React from "react";
import { cn } from "../../../lib/utils";

/**
 * DayStreamBanner
 * 
 * Represents a shared event that applies to the whole day (Call, Lunch, Wrap).
 * Acts as a visual section break.
 */
export default function DayStreamBanner({ entry, onEdit }) {
    const isWrap = entry.resolvedTitle?.toLowerCase().includes("wrap");
    const isMeal = entry.resolvedTitle?.toLowerCase().includes("lunch") || entry.resolvedTitle?.toLowerCase().includes("break");

    return (
        <div
            onClick={onEdit}
            className={cn(
                "relative flex items-center py-4 my-2 cursor-pointer group rounded-lg transition-colors",
                "hover:bg-slate-50"
            )}
        >
            {/* Time Pill */}
            <div className="w-20 pr-4 flex justify-end">
                <div className={cn(
                    "px-2 py-1 rounded text-xs font-bold font-mono border",
                    isWrap ? "bg-slate-900 text-white border-slate-900" :
                        isMeal ? "bg-amber-100 text-amber-800 border-amber-200" :
                            "bg-indigo-50 text-indigo-700 border-indigo-100"
                )}>
                    {entry.startTime}
                </div>
            </div>

            {/* Horizontal Line Connector */}
            <div className="h-px bg-slate-200 flex-1 relative top-px group-hover:bg-slate-300 transition-colors" />

            {/* Title */}
            <div className="px-4 text-sm font-bold uppercase tracking-wide text-slate-700 whitespace-nowrap">
                {entry.resolvedTitle}
            </div>

            {/* Right Connector */}
            <div className="h-px bg-slate-200 flex-[0.2] relative top-px group-hover:bg-slate-300 transition-colors" />

            {/* Duration Label */}
            <div className="pl-3 text-xs text-slate-400 font-medium">
                {entry.duration}m
            </div>
        </div>
    );
}
