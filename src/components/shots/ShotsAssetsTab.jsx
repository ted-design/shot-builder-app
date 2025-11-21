import React from "react";
import { useProjectScope } from "../../context/ProjectScopeContext";
import ScopedTalentList from "./ScopedTalentList";
import ScopedLocationList from "./ScopedLocationList";

export default function ShotsAssetsTab() {
  const { currentProjectId } = useProjectScope();
  const scope = { type: "project", projectId: currentProjectId };
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-8">
      <ScopedTalentList scope={scope} />
      <ScopedLocationList scope={scope} />
    </div>
  );
}
