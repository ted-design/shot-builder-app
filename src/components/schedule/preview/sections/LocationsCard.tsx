import React from "react";
import { MapPin } from "lucide-react";
import type { CallSheetLocation } from "../../types";

interface LocationsCardProps {
  locations: CallSheetLocation[];
  notes?: string;
}

export function LocationsCard({ locations, notes }: LocationsCardProps) {
  const pairs: [CallSheetLocation, CallSheetLocation?][] = [];
  for (let i = 0; i < locations.length; i += 2) {
    pairs.push([locations[i], locations[i + 1]]);
  }

  return (
    <div className="mx-4 my-4 border-2 border-[var(--cs-primary)] rounded-lg overflow-hidden">
      {pairs.map(([left, right], index) => (
        <div key={index} className="flex">
          <div className="flex-1 p-4 border-r border-gray-200">
            <h4 className="font-semibold border-b border-gray-400 pb-1 mb-2">
              {left.type}
            </h4>
            {left.name && <p className="text-sm">{left.name}</p>}
            {left.address && <p className="text-sm text-gray-600">{left.address}</p>}
          </div>

          <div className="flex items-center justify-center w-16 border-r border-gray-200">
            <MapPin className="w-6 h-6 text-gray-600" />
          </div>

          <div className="flex-1 p-4">
            {right ? (
              <>
                <h4 className="font-semibold border-b border-gray-400 pb-1 mb-2">
                  {right.type}
                </h4>
                {right.name && <p className="text-sm">{right.name}</p>}
                {right.address && <p className="text-sm text-gray-600">{right.address}</p>}
              </>
            ) : (
              <div className="h-full" />
            )}
          </div>
        </div>
      ))}

      {notes && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-sm italic text-gray-500">{notes || "Notes Placeholder"}</p>
        </div>
      )}
    </div>
  );
}

