import React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "../ui/card";

export default function CreateShotCard({ onClick, disabled = false }) {
  return (
    <Card
      className={`h-full min-h-[160px] border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-primary/70 hover:text-primary"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <Plus className="h-6 w-6" />
        </div>
        <CardContent className="flex flex-col items-center gap-1 p-0 text-center">
          <span className="text-base font-semibold">Create shot</span>
          <span className="text-sm text-slate-500">
            Open the shot builder to assign talent, products, and notes.
          </span>
        </CardContent>
      </button>
    </Card>
  );
}
