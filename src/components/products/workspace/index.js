/**
 * Product Workspace Components
 *
 * Design system for product workspace sections:
 * - WorkspaceContext: Shared state (activeSection, selectedColorwayId)
 * - WorkspaceRail: Left navigation rail
 * - SectionHeader: Consistent section header pattern
 * - ScopeContextBar: Product vs Colorway scope indicator
 * - WorkspaceEmptyState: Placeholder for coming-soon sections
 * - SamplesWorkspace: Sample tracking section
 * - ColorwaysWorkspace: Colorway management section
 */

// Context
export { WorkspaceContext, useWorkspace, WORKSPACE_SECTIONS } from "./WorkspaceContext";

// Navigation
export { default as WorkspaceRail } from "./WorkspaceRail";

// Common patterns
export { default as SectionHeader } from "./SectionHeader";
export { default as ScopeContextBar, ScopeContextPill } from "./ScopeContextBar";
export { default as WorkspaceEmptyState, WorkspaceTableEmpty } from "./WorkspaceEmptyState";

// Bento dashboard
export { default as BentoCard, SubMetricPill } from "./BentoCard";
export {
  computeSampleMetrics,
  computeColorwayMetrics,
  computeAssetMetrics,
  computeActivityMetrics,
  SECTION_DESCRIPTIONS,
} from "./overviewHelpers";

// Section components
export { default as SamplesSection } from "./SamplesWorkspace";
export { default as ColorwaysSection, ColorwayTile, ColorwayCockpit } from "./ColorwaysWorkspace";
export { SAMPLE_STATUSES, SampleStatusBadge, SampleSummaryChip } from "./SamplesWorkspace";
