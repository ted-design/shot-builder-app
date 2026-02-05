import { useMemo } from "react";

import { getShotHeroImage } from "../../../lib/shotHeroImage";

export default function ShotHeroImage({ shot }) {
  const hero = useMemo(() => getShotHeroImage(shot), [shot]);
  if (!hero?.src) return null;

  return (
    <section className="space-y-2" data-section="shot-hero-image">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Reference image
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 overflow-hidden">
        <img
          src={hero.src}
          alt="Shot reference"
          className="w-full max-h-[460px] object-contain"
          loading="lazy"
        />
      </div>
    </section>
  );
}

