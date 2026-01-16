import React from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import SortableDayStreamBlock from "./SortableDayStreamBlock";
import { cn } from "../../../lib/utils";

/**
 * DayStreamSwimlane
 * 
 * Represents a single track column within a timeline segment.
 * Acts as a Droppable zone for entries.
 */
export default function DayStreamSwimlane({
    track,
    entries = [],
    onEditEntry,
    onAddEntry,
    onUpdateEntry
}) {
    // Use track ID as the droppable container ID
    const { setNodeRef, isOver } = useDroppable({
        id: track.id,
        data: { type: "track", trackId: track.id }
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col min-w-[140px] flex-1 border-r border-dashed border-slate-200 last:border-0 relative transition-colors",
                isOver ? "bg-blue-50/50" : "bg-slate-50/30"
            )}
        >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur text-[10px] text-slate-400 uppercase font-bold py-1 px-2 border-b border-slate-100 text-center">
                {track.name}
            </div>

            {/* Sortable Context for Items */}
            <SortableContext
                items={entries.map(e => e.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col gap-2 p-2 min-h-[100px]">
                    {entries.map((entry) => (
                        <SortableDayStreamBlock
                            key={entry.id}
                            entry={entry}
                            tracks={[track]}
                            onEdit={() => onEditEntry(entry)}
                            onUpdateEntry={onUpdateEntry}
                        />
                    ))}

                    {/* Add Button at bottom */}
                    <button
                        onClick={() => onAddEntry?.(track.id)}
                        className="mt-2 py-2 rounded border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors text-xs flex justify-center items-center"
                    >
                        + Add
                    </button>
                </div>
            </SortableContext>
        </div>
    );
}
