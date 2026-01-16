import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DayStreamBlock from "./DayStreamBlock";

/**
 * SortableDayStreamBlock
 * 
 * Wrapper component that makes a DayStreamBlock draggable.
 */
export default function SortableDayStreamBlock(props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.entry.id, data: { ...props.entry } });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        touchAction: "none",
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <DayStreamBlock {...props} />
        </div>
    );
}
