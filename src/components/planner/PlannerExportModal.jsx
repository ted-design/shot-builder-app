import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Document,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  Circle,
  pdf,
} from "@react-pdf/renderer";
import { Button } from "../ui/button";
import { toast } from "../../lib/toast";
import { resolveImageSourceToDataUrl } from "../../lib/pdfImageCollector";
import {
  calculateLayout,
  distributeCardsAcrossPages,
  getCardPosition,
  getLayoutSummary,
  DENSITY_PRESETS,
} from "../../lib/pdfLayoutCalculator";
import { processImageForPDF, getOptimalImageDimensions } from "../../lib/pdfImageProcessor";
import { getPrimaryAttachment } from "../../lib/imageHelpers";
import { FileDown, X, ExternalLink, Loader2 } from "lucide-react";
import PlannerSheetSectionManager from "./PlannerSheetSectionManager";
import ExportSectionPanel from "../export/ExportSectionPanel";
import ExportEditorShell from "../export/ExportEditorShell";
import LightweightExportPreview from "../export/LightweightExportPreview";
import InlinePdfPreview from "../export/InlinePdfPreview";
import { stripHtml } from "../../lib/stripHtml";
import { getShotNotesPreview } from "../../lib/shotNotes";
import { getExportDescriptionText } from "../../lib/shotDescription";
import {
  getDefaultSectionConfig,
  exportSettingsToSectionConfig,
  sectionConfigToExportSettings,
  getVisibleFieldKeys,
  SECTION_TYPES,
  getVisibleSections,
} from "../../lib/plannerSheetSections";
import useImageExportWorker from "../../hooks/useImageExportWorker";
import ExportProgressModal from "../export/ExportProgressModal";
import { legacyOptionsToDocumentState } from "../../lib/documentModel";
import { buildPdfInputs, logPdfInputs } from "../../lib/pdfInputs";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1f2937",
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryHeading: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
    paddingVertical: 4,
  },
  tableHeader: {
    fontSize: 10,
    fontWeight: 600,
    color: "#475569",
  },
  tableCell: {
    fontSize: 10,
    color: "#1f2937",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
    borderBottomStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tableDataCell: {
    fontSize: 9,
    color: "#1f2937",
    paddingHorizontal: 4,
  },
  tableImageCell: {
    width: 50,
    height: 50,
    marginRight: 8,
    flexShrink: 0,
  },
  tableImage: {
    width: 50,
    height: 50,
    objectFit: "cover",
    borderRadius: 2,
  },
  // ============================================================================
  // ShotBlock Layout Styles (stacked block design for table mode)
  // ============================================================================
  shotBlock: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    borderBottomStyle: "solid",
  },
  shotBlockImageContainer: {
    width: 44,
    height: 44,
    marginRight: 10,
    flexShrink: 0,
  },
  shotBlockImage: {
    width: 44,
    height: 44,
    objectFit: "cover",
    borderRadius: 3,
  },
  shotBlockContent: {
    flex: 1,
    flexShrink: 1,
  },
  shotBlockPrimary: {
    marginBottom: 4,
  },
  shotBlockName: {
    fontSize: 11,
    fontWeight: 600,
    color: "#1e293b",
    lineHeight: 1.25,
  },
  shotBlockDescription: {
    fontSize: 9,
    color: "#64748b",
    lineHeight: 1.3,
    marginTop: 1,
  },
  shotBlockMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "#f8fafc",
    borderRadius: 2,
  },
  shotBlockMetaItem: {
    fontSize: 7.5,
    color: "#64748b",
    lineHeight: 1.2,
  },
  shotBlockMetaSeparator: {
    fontSize: 7,
    color: "#cbd5e1",
    marginHorizontal: 3,
  },
  // Products displayed as separate semantic group with subtle pill treatment
  shotBlockProducts: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  shotBlockProductItem: {
    fontSize: 7.5,
    color: "#334155",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    lineHeight: 1.2,
  },
  shotBlockProductMore: {
    fontSize: 7,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  shotBlockNotes: {
    marginTop: 5,
    paddingTop: 3,
    paddingBottom: 2,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0",
    borderLeftStyle: "solid",
  },
  shotBlockNotesText: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.35,
  },
  laneSection: {
    marginBottom: 18,
  },
  laneHeading: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
  },
  shotCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  shotImage: {
    width: 100,
    height: 100,
    objectFit: "cover",
    borderRadius: 4,
    marginBottom: 6,
  },
  galleryShotImage: {
    width: "100%",
    height: 160,
    objectFit: "cover",
    borderRadius: 4,
    marginBottom: 8,
  },
  shotTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#111827",
    marginTop: 6,
    marginBottom: 6,
  },
  shotNumberBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#0f172a",
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  listColumn: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listLeftColumn: {
    flexBasis: "55%",
    paddingRight: 10,
  },
  listRightColumn: {
    flexBasis: "45%",
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    borderLeftStyle: "solid",
  },
  listColumnFull: {
    flexBasis: "100%",
    paddingRight: 0,
    paddingLeft: 0,
    borderLeftWidth: 0,
  },
  listDetailItem: {
    marginBottom: 4,
  },
  listDetailLabel: {
    fontSize: 9,
  },
  listDetailValue: {
    fontSize: 9,
  },
  listDetailBullet: {
    fontSize: 9,
  },
  detailStack: {
    marginTop: 6,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  detailIconWrapper: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  detailIcon: {
    width: 14,
    height: 14,
  },
  detailContent: {
    flexGrow: 1,
    flexShrink: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 10,
    color: "#1f2937",
    lineHeight: 1.35,
    flexShrink: 1,
  },
  detailEmpty: {
    fontSize: 10,
    color: "#94a3b8",
  },
  detailList: {
    marginTop: 2,
  },
  detailBullet: {
    fontSize: 10,
    marginRight: 4,
    lineHeight: 1.35,
  },
  detailListLine: {
    fontSize: 10,
    color: "#1f2937",
    lineHeight: 1.35,
    marginBottom: 2,
    flexShrink: 1,
  },
  galleryShotNumber: {
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  galleryShotTitle: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: 4,
  },
  galleryShotTitleCompact: {
    fontSize: 10,
  },
  galleryDetailStack: {
    marginTop: 4,
  },
  galleryDetailItem: {
    marginBottom: 4,
  },
  galleryDetailLabel: {
    fontSize: 8,
  },
  galleryDetailValue: {
    fontSize: 8.5,
  },
  galleryDetailBullet: {
    fontSize: 8.5,
  },
  galleryDetailLabelCompact: {
    fontSize: 7.5,
  },
  galleryDetailValueCompact: {
    fontSize: 8,
  },
  galleryDetailBulletCompact: {
    fontSize: 8,
  },
  galleryNotesContainer: {
    marginTop: 4,
    padding: 5,
  },
  notesContainer: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  notesParagraph: {
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  notesHeading: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    color: "#0f172a",
  },
  notesHeadingSmall: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
    color: "#0f172a",
  },
  notesList: {
    marginBottom: 4,
    marginTop: 2,
  },
  notesListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  notesListBullet: {
    fontSize: 10,
    marginRight: 4,
    lineHeight: 1.3,
  },
  notesCodeBlock: {
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    padding: 6,
    marginBottom: 4,
  },
  notesCodeText: {
    fontSize: 10,
    fontFamily: "Courier",
    color: "#0f172a",
    lineHeight: 1.4,
  },
  notesCodeInline: {
    fontFamily: "Courier",
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    paddingLeft: 3,
    paddingRight: 3,
    paddingTop: 1,
    paddingBottom: 1,
  },
  notesQuote: {
    borderLeftWidth: 2,
    borderLeftColor: "#cbd5f5",
    borderLeftStyle: "solid",
    paddingLeft: 8,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  notesQuoteText: {
    fontSize: 10,
    color: "#1e293b",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  notesLink: {
    color: "#2563eb",
    textDecoration: "underline",
  },
  // ============================================================================
  // Gallery V2 Editorial Layout Styles
  // Denser, more scannable card design without repetitive labels
  // ============================================================================
  galleryV2Title: {
    fontSize: 11,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 3,
    lineHeight: 1.3,
  },
  galleryV2TitleCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  galleryV2Description: {
    fontSize: 8.5,
    color: "#64748b",
    marginBottom: 5,
    lineHeight: 1.35,
  },
  galleryV2DescriptionCompact: {
    fontSize: 8,
    marginBottom: 4,
  },
  galleryV2MetaStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "#f8fafc",
    borderRadius: 2,
  },
  galleryV2MetaItem: {
    fontSize: 8,
    color: "#64748b",
  },
  galleryV2MetaItemCompact: {
    fontSize: 7.5,
  },
  galleryV2MetaSeparator: {
    fontSize: 7,
    color: "#cbd5e1",
    marginHorizontal: 4,
  },
  galleryV2MetaSeparatorCompact: {
    marginHorizontal: 3,
  },
  galleryV2Products: {
    marginBottom: 4,
    marginTop: 1,
  },
  galleryV2ProductItem: {
    fontSize: 8,
    color: "#334155",
    lineHeight: 1.3,
    marginBottom: 2,
  },
  galleryV2ProductItemCompact: {
    fontSize: 7.5,
  },
  galleryV2ProductBullet: {
    fontSize: 6,
    color: "#94a3b8",
  },
  galleryV2ProductMore: {
    fontSize: 7.5,
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 1,
  },
  galleryV2Notes: {
    marginTop: 4,
    paddingTop: 3,
    paddingHorizontal: 5,
    paddingBottom: 3,
    paddingLeft: 6,
    backgroundColor: "#f8fafc",
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0",
    borderLeftStyle: "solid",
    borderRadius: 2,
  },
  galleryV2NotesCompact: {
    paddingTop: 2,
    paddingHorizontal: 3,
    paddingBottom: 2,
  },
  galleryV2NotesText: {
    fontSize: 7.5,
    color: "#64748b",
    lineHeight: 1.3,
  },
  galleryV2NotesTextCompact: {
    fontSize: 7,
  },
  galleryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
});

const fieldOptions = [
  { key: "shotNumber", label: "Shot number" },
  { key: "name", label: "Shot title" },
  { key: "type", label: "Description" },
  { key: "date", label: "Date" },
  { key: "location", label: "Location" },
  { key: "talent", label: "Talent" },
  { key: "products", label: "Products" },
  { key: "notes", label: "Notes" },
  { key: "image", label: "Image" },
];

const UNASSIGNED_TALENT_FILTER_VALUE = "__planner_unassigned__";

const cssEscape = (value) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/"/g, '\"');
};

/**
 * Prepare lanes data for PDF export by fetching and processing images
 *
 * This function fetches images directly from shot data URLs rather than relying
 * on DOM elements, which solves lazy-loading race conditions.
 *
 * @param {Array} lanes - Array of lane objects with shots
 * @param {Object} options - Processing options
 * @param {boolean} options.includeImages - Whether to include images in export
 * @param {string} options.density - Image quality preset ('compact', 'standard', 'detailed')
 * @param {boolean} options.inlineImages - Whether to inline images as data URLs
 * @param {Function} options.onProgress - Progress callback (loaded, total)
 */
const prepareLanesForPdf = async (lanes, { includeImages, density = 'standard', inlineImages = false, onProgress }) => {
  const list = Array.isArray(lanes) ? lanes : [];
  const shotImageMap = new Map();

  // Get optimal image dimensions for the density
  const imageDimensions = getOptimalImageDimensions(density);

  if (includeImages && inlineImages) {
    // Collect all shots that need images
    const imagesToFetch = [];
    list.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        if (!shot?.id || !shot?.image) return;

        // Get crop data from primary attachment or fallback to legacy
        let cropPosition = { x: 50, y: 50 };
        const primaryAttachment = getPrimaryAttachment(shot.attachments);
        if (primaryAttachment?.cropData) {
          cropPosition = {
            x: primaryAttachment.cropData.x || 50,
            y: primaryAttachment.cropData.y || 50,
          };
        } else if (shot.referenceImageCrop) {
          cropPosition = shot.referenceImageCrop;
        }

        imagesToFetch.push({
          shotId: String(shot.id),
          source: shot.image,
          cropPosition,
        });
      });
    });

    // Fetch and process all images in parallel directly from URLs (not DOM)
    let loaded = 0;
    const total = imagesToFetch.length;

    const fetchPromises = imagesToFetch.map(async (item) => {
      try {
        // Resolve image source to data URL
        const { dataUrl } = await resolveImageSourceToDataUrl(item.source);

        if (dataUrl) {
          try {
            // Process with cropping
            const croppedDataUrl = await processImageForPDF(dataUrl, {
              cropPosition: item.cropPosition,
              targetWidth: imageDimensions.width,
              targetHeight: imageDimensions.height,
            });
            shotImageMap.set(item.shotId, croppedDataUrl);
          } catch (cropError) {
            console.warn("[Planner] Failed to crop image, using original", cropError);
            shotImageMap.set(item.shotId, dataUrl);
          }
        }
      } catch (error) {
        console.warn("[Planner] Failed to fetch image for PDF", {
          shotId: item.shotId,
          source: item.source,
          error,
        });
      } finally {
        loaded++;
        if (onProgress) {
          onProgress(loaded, total);
        }
      }
    });

    await Promise.allSettled(fetchPromises);
  }

  // Build prepared lanes with resolved image data
  const prepared = list.map((lane) => {
    const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
    const shots = laneShots.map((shot) => {
      const preparedShot = { ...shot };

      if (!includeImages) {
        preparedShot.image = null;
        return preparedShot;
      }

      // Fast path: do not inline images, just pass URLs/paths through to PDF renderer
      if (!inlineImages) {
        return preparedShot;
      }

      const shotId = shot?.id ? String(shot.id) : null;
      if (shotId && shotImageMap.has(shotId)) {
        preparedShot.image = shotImageMap.get(shotId);
      } else {
        // Image was not successfully loaded
        preparedShot.image = null;
      }

      return preparedShot;
    });
    return { ...lane, shots };
  });

  return prepared;
};

const ICON_COLOR = "#475569";
const ICON_STROKE_WIDTH = 1.5;

const PdfIconCalendar = ({ style }) => (
  <Svg viewBox="0 0 24 24" style={style}>
    <Rect
      x={3}
      y={5}
      width={18}
      height={16}
      rx={2}
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
    />
    <Path d="M3 9h18" stroke={ICON_COLOR} strokeWidth={ICON_STROKE_WIDTH} />
    <Path d="M8 3v4" stroke={ICON_COLOR} strokeWidth={ICON_STROKE_WIDTH} />
    <Path d="M16 3v4" stroke={ICON_COLOR} strokeWidth={ICON_STROKE_WIDTH} />
  </Svg>
);

const PdfIconPackage = ({ style }) => (
  <Svg viewBox="0 0 24 24" style={style}>
    <Rect
      x={3}
      y={6}
      width={18}
      height={12}
      rx={2}
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
    />
    <Path d="M3 10h18" stroke={ICON_COLOR} strokeWidth={ICON_STROKE_WIDTH} />
    <Path d="M12 6v12" stroke={ICON_COLOR} strokeWidth={ICON_STROKE_WIDTH} />
  </Svg>
);

const PdfIconTalent = ({ style }) => (
  <Svg viewBox="0 0 24 24" style={style}>
    <Circle
      cx={12}
      cy={8}
      r={3}
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
    />
    <Path
      d="M6 19c0-3 2.7-5 6-5s6 2 6 5"
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);

const PdfIconLocation = ({ style }) => (
  <Svg viewBox="0 0 24 24" style={style}>
    <Path
      d="M12 21s7-5.25 7-11a7 7 0 1 0-14 0c0 5.75 7 11 7 11z"
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
    />
    <Circle
      cx={12}
      cy={10}
      r={2.5}
      stroke={ICON_COLOR}
      strokeWidth={ICON_STROKE_WIDTH}
      fill="none"
    />
  </Svg>
);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "pre",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
]);

/**
 * PlannerPdfDocument
 *
 * PDF Document Component that renders the planner export.
 * Uses the document composition model (src/lib/documentModel.ts) to ensure
 * each section renders exactly once at the appropriate document level:
 *
 * Document Structure:
 * ┌─────────────────────────────────────┐
 * │ DocumentHeader                      │  ← Rendered ONCE at document start
 * │   - title, subtitle, timestamp      │
 * ├─────────────────────────────────────┤
 * │ GlobalSummaries                     │  ← Rendered ONCE after header
 * │   - laneSummary (if enabled)        │
 * │   - talentSummary (if enabled)      │
 * ├─────────────────────────────────────┤
 * │ TableHeader (table layout only)     │  ← Rendered ONCE before lanes
 * ├─────────────────────────────────────┤
 * │ LaneSection (repeated per lane)     │
 * │   - laneHeading                     │
 * │   ├── ShotBlock (repeated)          │
 * │   └── ...                           │
 * └─────────────────────────────────────┘
 */
const PlannerPdfDocument = React.memo(({ lanes, laneSummary, talentSummary, options }) => {
  // ============================================================================
  // Convert legacy options to document composition model
  // This ensures consistent structure and enables future model-based features
  // ============================================================================
  const documentState = legacyOptionsToDocumentState(options);

  // Extract document-level settings from the composed model
  const { header: headerState, summaries: summariesState, shots: shotsState } = documentState;

  // Orientation and layout from document model
  const orientation = headerState.orientation;
  const layout = shotsState.layoutMode;
  const densityId = shotsState.density;

  // Gallery columns with bounds checking
  const galleryColumns =
    layout === "gallery"
      ? Math.min(6, Math.max(1, shotsState.galleryColumns))
      : 1;
  const columnWidth = `${(100 / galleryColumns).toFixed(4)}%`;

  // Field visibility from section states (preserves flex values)
  const visibleFields = options.fields || {};
  const customLabels = options.customLabels || {};

  // DEV-only: warn if images are enabled but zero shots have image data
  if (process.env.NODE_ENV === 'development' && visibleFields.image) {
    const allShots = (lanes || []).flatMap(l => l.shots || []);
    const shotsWithImages = allShots.filter(s => s?.image && s.image !== '__PREVIEW_PLACEHOLDER__');
    if (allShots.length > 0 && shotsWithImages.length === 0) {
      console.warn(
        '[PlannerPdfDocument] fields.image=true but 0/' + allShots.length +
        ' shots have image data (mode: pdf)'
      );
    }
  }

  // Use sectionStates from options if available (includes flex values), otherwise fallback
  const sectionStates = options.sectionStates || exportSettingsToSectionConfig(visibleFields);

  // ============================================================================
  // Global Summaries: Render ONCE at document level (not per lane)
  // The document model ensures these are document-level, not lane-level
  // ============================================================================
  const showLaneSummary = summariesState.laneSummary.visible && laneSummary?.lanes?.length;
  const showTalentSummary = summariesState.talentSummary.visible && talentSummary?.rows?.length;
  const talentLanes = Array.isArray(talentSummary?.lanes) ? talentSummary.lanes : [];
  const talentRows = Array.isArray(talentSummary?.rows) ? talentSummary.rows : [];
  const exportLanes = Array.isArray(lanes) ? lanes : [];

  // Calculate layout using new density-based system with orientation support
  const allShots = exportLanes.flatMap(lane => lane.shots || []);
  const layoutConfig = layout === "gallery" ? calculateLayout(densityId, allShots.length, orientation) : null;
  const densityPreset = layoutConfig?.preset;

  // Image style with density-specific height
  const shotImageStyle = layout === "gallery"
    ? [styles.galleryShotImage, densityPreset && { height: densityPreset.imageHeight }].filter(Boolean)
    : styles.shotImage;

  const ensureStringList = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item == null) return "";
        return String(item);
      })
      .filter(Boolean);
  };

  const normaliseShotNumber = (value) => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  };

  const extractStyleOverrides = (node) => {
    const overrides = [];
    if (!node || typeof node.nodeName !== "string") return overrides;
    const tag = node.nodeName.toLowerCase();

    if (tag === "strong" || tag === "b") overrides.push({ fontWeight: 700 });
    if (tag === "em" || tag === "i") overrides.push({ fontStyle: "italic" });
    if (tag === "u") overrides.push({ textDecoration: "underline" });
    if (tag === "s") overrides.push({ textDecoration: "line-through" });
    if (tag === "code") overrides.push(styles.notesCodeInline);
    if (tag === "a") overrides.push(styles.notesLink);

    const styleAttr =
      typeof node.getAttribute === "function" ? node.getAttribute("style") : null;
    if (styleAttr) {
      styleAttr.split(";").forEach((segment) => {
        const [rawProp, rawValue] = segment.split(":");
        if (!rawProp || !rawValue) return;
        const prop = rawProp.trim().toLowerCase();
        const value = rawValue.trim();
        if (!value) return;
        if (prop === "color") {
          overrides.push({ color: value });
          return;
        }
        if (prop === "font-weight") {
          const weight = Number.parseInt(value, 10);
          if (value === "bold" || (Number.isFinite(weight) && weight >= 600)) {
            overrides.push({ fontWeight: 700 });
          }
          return;
        }
        if (prop === "font-style" && value === "italic") {
          overrides.push({ fontStyle: "italic" });
          return;
        }
        if (prop === "text-decoration") {
          const tokens = value.split(/\s+/).filter(Boolean);
          if (tokens.length) {
            overrides.push({ textDecoration: tokens.join(" ") });
          }
        }
      });
    }

    return overrides;
  };

  const renderInlineNodes = (nodes, keyPrefix, styleStack = []) => {
    const fragments = [];
    nodes.forEach((child, index) => {
      if (!child) return;
      if (child.nodeType === TEXT_NODE) {
        const rawContent = child.textContent ?? "";
        const normalised = rawContent.replace(/\s+/g, " ");
        if (!normalised.trim()) {
          if (normalised.length) {
            fragments.push(" ");
          }
          return;
        }
        fragments.push(
          <Text key={`${keyPrefix}-text-${index}`} style={[styles.notesText, ...styleStack]}>
            {normalised}
          </Text>
        );
        return;
      }

      if (child.nodeType !== ELEMENT_NODE) return;
      const tag = child.nodeName.toLowerCase();
      if (BLOCK_TAGS.has(tag)) return;
      if (tag === "br") {
        fragments.push("\n");
        return;
      }

      const nextStack = [...styleStack, ...extractStyleOverrides(child)];
      const childNodes = renderInlineNodes(
        Array.from(child.childNodes || []),
        `${keyPrefix}-${tag}-${index}`,
        nextStack
      );

      if (childNodes.length) {
        fragments.push(
          <Text key={`${keyPrefix}-${tag}-${index}`} style={[styles.notesText, ...nextStack]}>
            {childNodes}
          </Text>
        );
      }
    });
    return fragments;
  };

  const renderListItem = (itemNode, ordered, keyPrefix, index) => {
    const inlineChildren = [];
    const blockChildren = [];

    Array.from(itemNode.childNodes || []).forEach((child) => {
      if (!child) return;
      if (child.nodeType === TEXT_NODE) {
        if ((child.textContent || "").trim()) inlineChildren.push(child);
        return;
      }
      if (child.nodeType !== ELEMENT_NODE) return;
      const childTag = child.nodeName.toLowerCase();
      if (childTag === "p" || childTag === "div" || childTag === "ul" || childTag === "ol" || childTag === "pre" || childTag === "blockquote") {
        blockChildren.push(child);
      } else {
        inlineChildren.push(child);
      }
    });

    const inlineContent = inlineChildren.length
      ? (
          <Text style={styles.notesText}>
            {renderInlineNodes(inlineChildren, `${keyPrefix}-inline-${index}`)}
          </Text>
        )
      : null;

    return (
      <View key={`${keyPrefix}-item-${index}`} style={styles.notesListItem} wrap={false}>
        <Text style={styles.notesListBullet}>{ordered ? `${index + 1}.` : "•"}</Text>
        <View style={{ flex: 1 }}>
          {inlineContent}
          {blockChildren.map((child, childIndex) =>
            renderNode(child, `${keyPrefix}-block-${index}-${childIndex}`)
          )}
        </View>
      </View>
    );
  };

  const renderList = (node, ordered, keyPrefix) => {
    const items = Array.from(node.childNodes || []).filter(
      (child) => child?.nodeType === ELEMENT_NODE && child.nodeName?.toLowerCase() === "li"
    );
    if (!items.length) return null;
    return (
      <View key={keyPrefix} style={styles.notesList} wrap={false}>
        {items.map((item, index) => renderListItem(item, ordered, keyPrefix, index))}
      </View>
    );
  };

  const renderNode = (node, keyPrefix) => {
    if (!node) return null;
    if (node.nodeType === TEXT_NODE) {
      const textContent = (node.textContent || "").replace(/\s+/g, " ");
      if (!textContent.trim()) return null;
      return (
        <View key={`${keyPrefix}-text`} style={styles.notesParagraph} wrap={false}>
          <Text style={styles.notesText}>{textContent}</Text>
        </View>
      );
    }

    if (node.nodeType !== ELEMENT_NODE) return null;
    const tag = node.nodeName.toLowerCase();

    if (tag === "p" || tag === "div") {
      const inlineChildren = renderInlineNodes(
        Array.from(node.childNodes || []),
        `${keyPrefix}-${tag}`
      );
      if (!inlineChildren.length) return null;
      return (
        <View key={`${keyPrefix}-${tag}`} style={styles.notesParagraph} wrap={false}>
          <Text style={styles.notesText}>{inlineChildren}</Text>
        </View>
      );
    }

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const inlineChildren = renderInlineNodes(
        Array.from(node.childNodes || []),
        `${keyPrefix}-${tag}`
      );
      if (!inlineChildren.length) return null;
      const headingStyle = tag === "h1" ? styles.notesHeading : styles.notesHeadingSmall;
      return (
        <View key={`${keyPrefix}-${tag}`} style={styles.notesParagraph} wrap={false}>
          <Text style={headingStyle}>{inlineChildren}</Text>
        </View>
      );
    }

    if (tag === "ul") {
      return renderList(node, false, `${keyPrefix}-ul`);
    }

    if (tag === "ol") {
      return renderList(node, true, `${keyPrefix}-ol`);
    }

    if (tag === "pre") {
      const codeText = node.textContent || "";
      if (!codeText.trim()) return null;
      return (
        <View key={`${keyPrefix}-pre`} style={styles.notesCodeBlock} wrap={false}>
          <Text style={styles.notesCodeText}>{codeText.replace(/\s+$/g, "")}</Text>
        </View>
      );
    }

    if (tag === "blockquote") {
      const inlineChildren = renderInlineNodes(
        Array.from(node.childNodes || []),
        `${keyPrefix}-blockquote`
      );
      if (!inlineChildren.length) return null;
      return (
        <View key={`${keyPrefix}-blockquote`} style={styles.notesQuote} wrap={false}>
          <Text style={styles.notesQuoteText}>{inlineChildren}</Text>
        </View>
      );
    }

    if (tag === "hr") {
      return (
        <View
          key={`${keyPrefix}-hr`}
          style={{
            height: 1,
            backgroundColor: "#e2e8f0",
            marginTop: 6,
            marginBottom: 6,
          }}
          wrap={false}
        />
      );
    }

    const fallbackChildren = renderInlineNodes(
      Array.from(node.childNodes || []),
      `${keyPrefix}-${tag}`
    );
    if (!fallbackChildren.length) return null;
    return (
      <View key={`${keyPrefix}-${tag}`} style={styles.notesParagraph} wrap={false}>
        <Text style={styles.notesText}>{fallbackChildren}</Text>
      </View>
    );
  };

  const renderBlockNodes = (nodes, keyPrefix) => {
    const content = [];
    nodes.forEach((node, index) => {
      const rendered = renderNode(node, `${keyPrefix}-${index}`);
      if (Array.isArray(rendered)) {
        content.push(...rendered);
      } else if (rendered != null) {
        content.push(rendered);
      }
    });
    return content;
  };

  const buildNotesContent = (notesText, keyPrefix, containerStyle) => {
    // Notes should already be sanitized by buildPlannerExportLanes (via stripHtml),
    // but we apply defensive sanitization here to catch any remaining HTML fragments.
    if (!notesText) return null;

    // Defensive sanitization: strip any remaining HTML tags or malformed fragments
    // This catches edge cases like corrupted data or bypassed sanitization
    const sanitized = notesText
      .replace(/<[^>]*>/g, ' ')                                    // Standard HTML tags
      .replace(/\b(ul|ol|li|p|div|span|br|strong|em|b|i|u|s|a|h[1-6])>/gi, ' ') // Malformed tags like "ul>"
      // Decode common HTML entities instead of stripping them
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))  // Numeric entities
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));  // Hex entities

    // Normalize whitespace while preserving intentional line breaks
    const normalized = sanitized
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!normalized) return null;

    // Split by line breaks and render each line
    const lines = normalized.split('\n').filter(line => line.trim());

    if (lines.length === 0) return null;

    return (
      <View
        key={`${keyPrefix}-notes`}
        style={[styles.notesContainer, containerStyle]}
        wrap={false}
      >
        {lines.map((line, index) => (
          <Text key={`${keyPrefix}-line-${index}`} style={styles.notesText}>
            {line}
          </Text>
        ))}
      </View>
    );
  };

  const renderDetailItem = (item, index) => {
    const IconComponent = item.icon;
    const isListValue = Array.isArray(item.value);
    const hasListItems = isListValue && item.value.length > 0;
    const displayValue = !isListValue ? item.value : null;
    const containerStyle = [styles.detailItem];
    const appendStyle = (target, extra) => {
      if (!extra) return;
      if (Array.isArray(extra)) {
        extra.filter(Boolean).forEach((entry) => appendStyle(target, entry));
        return;
      }
      target.push(extra);
    };
    const resolveStyle = (base, extra) => {
      if (!extra) return base;
      if (Array.isArray(extra)) {
        const filtered = extra.filter(Boolean);
        return filtered.length ? [base, ...filtered] : base;
      }
      return [base, extra];
    };

    appendStyle(containerStyle, item.containerStyle);
    const labelStyle = resolveStyle(styles.detailLabel, item.labelStyle);
    const valueStyle = resolveStyle(styles.detailValue, item.valueStyle);
    const bulletStyle = resolveStyle(styles.detailBullet, item.bulletStyle);
    const listStyle = resolveStyle(styles.detailList, item.listStyle);
    const listLineStyle = resolveStyle(styles.detailListLine, item.valueStyle);

    return (
      <View key={item.key || index} style={containerStyle}>
        {IconComponent ? (
          <View style={styles.detailIconWrapper}>
            <IconComponent style={styles.detailIcon} />
          </View>
        ) : null}
        <View style={styles.detailContent}>
          <Text style={labelStyle}>{item.label}</Text>
          {isListValue ? (
            hasListItems ? (
              <View style={listStyle}>
                {item.value.map((entry, entryIndex) => (
                  <Text
                    key={`${item.key || index}-entry-${entryIndex}`}
                    style={listLineStyle}
                  >
                    <Text style={bulletStyle}>• </Text>
                    <Text style={valueStyle}>{entry}</Text>
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.detailEmpty}>–</Text>
            )
          ) : displayValue ? (
            <Text style={valueStyle}>{displayValue}</Text>
          ) : (
            <Text style={styles.detailEmpty}>–</Text>
          )}
        </View>
      </View>
    );
  };

  // Process columns for table view - consolidates Shot Number + Title into "Shot"
  // and Date + Location into "Date/Loc"
  const getTableColumnLayout = (sectionStates) => {
    const visibleSections = getVisibleSections(sectionStates);
    const columnSections = visibleSections.filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE);

    // Track which sections we've processed
    const processed = new Set();
    const consolidatedColumns = [];

    // Check visibility for combined columns
    const showShotNumber = sectionStates[SECTION_TYPES.SHOT_NUMBER]?.visible !== false;
    const showShotName = sectionStates[SECTION_TYPES.SHOT_NAME]?.visible !== false;
    const showDate = sectionStates[SECTION_TYPES.DATE]?.visible !== false;
    const showLocation = sectionStates[SECTION_TYPES.LOCATION]?.visible !== false;

    for (const section of columnSections) {
      if (processed.has(section.id)) continue;

      // Consolidate Shot Number + Shot Name into "Shot" column
      if (section.id === SECTION_TYPES.SHOT_NUMBER || section.id === SECTION_TYPES.SHOT_NAME) {
        if (!processed.has('SHOT_COMBINED') && (showShotNumber || showShotName)) {
          processed.add('SHOT_COMBINED');
          processed.add(SECTION_TYPES.SHOT_NUMBER);
          processed.add(SECTION_TYPES.SHOT_NAME);
          consolidatedColumns.push({
            id: 'SHOT_COMBINED',
            label: 'Shot',
            flex: (showShotNumber ? (sectionStates[SECTION_TYPES.SHOT_NUMBER]?.flex ?? 0.8) : 0) +
                  (showShotName ? (sectionStates[SECTION_TYPES.SHOT_NAME]?.flex ?? 2) : 0),
            isCombined: true,
            showNumber: showShotNumber,
            showTitle: showShotName,
          });
        }
        continue;
      }

      // Consolidate Date + Location into "Date/Loc" column
      if (section.id === SECTION_TYPES.DATE || section.id === SECTION_TYPES.LOCATION) {
        if (!processed.has('DATE_LOC_COMBINED') && (showDate || showLocation)) {
          processed.add('DATE_LOC_COMBINED');
          processed.add(SECTION_TYPES.DATE);
          processed.add(SECTION_TYPES.LOCATION);
          consolidatedColumns.push({
            id: 'DATE_LOC_COMBINED',
            label: 'Date/Loc',
            flex: (showDate ? (sectionStates[SECTION_TYPES.DATE]?.flex ?? 1) : 0) +
                  (showLocation ? (sectionStates[SECTION_TYPES.LOCATION]?.flex ?? 1.5) : 0),
            isCombined: true,
            showDate: showDate,
            showLocation: showLocation,
          });
        }
        continue;
      }

      // Regular columns pass through
      processed.add(section.id);
      consolidatedColumns.push({
        id: section.id,
        label: section.label,
        flex: sectionStates[section.id]?.flex ?? section.flex ?? 1,
        isCombined: false,
        section: section,
      });
    }

    return consolidatedColumns;
  };

  // Render table header row with column labels
  const renderTableHeaderRow = (sectionStates, customLabels = {}) => {
    // Canonical gate: use options.fields.image, NOT sectionStates/visibleSections
    const showImage = Boolean(visibleFields.image);

    // Get consolidated column layout
    const columns = getTableColumnLayout(sectionStates);
    const totalFlex = columns.reduce((sum, col) => sum + col.flex, 0);

    return (
      <View style={styles.tableHeaderRow} wrap={false}>
        {showImage && (
          <View style={[styles.tableImageCell, { marginRight: 8 }]}>
            <Text style={styles.tableHeaderCell}>{customLabels[SECTION_TYPES.IMAGE] || 'IMAGE'}</Text>
          </View>
        )}
        {columns.map(column => {
          const width = `${((column.flex / totalFlex) * 100).toFixed(2)}%`;
          // For combined columns, use fixed label; for regular, allow custom labels
          const label = column.isCombined
            ? column.label
            : (customLabels[column.id] || column.label);

          return (
            <View key={column.id} style={{ width, flexShrink: 0 }}>
              <Text style={styles.tableHeaderCell}>{label.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Render a shot as a table row
  const renderTableRow = (shot, _lane, index, sectionStates) => {
    // Canonical gate: use options.fields.image, NOT sectionStates/visibleSections
    const showImage = Boolean(visibleFields.image);
    const shotKey = shot?.id || index;

    // Get consolidated column layout (same as header)
    const columns = getTableColumnLayout(sectionStates);
    const totalFlex = columns.reduce((sum, col) => sum + col.flex, 0);

    // Render cell content based on column type
    const renderCellContent = (column) => {
      // Handle combined Shot column (number + title)
      if (column.id === 'SHOT_COMBINED') {
        const lines = [];
        if (column.showNumber && shot.shotNumber) {
          lines.push(shot.shotNumber);
        }
        if (column.showTitle) {
          lines.push(shot.name || 'Untitled Shot');
        }
        return lines.length > 0 ? lines.join('\n') : '-';
      }

      // Handle combined Date/Location column
      if (column.id === 'DATE_LOC_COMBINED') {
        const lines = [];
        if (column.showDate && shot.date) {
          lines.push(shot.date);
        }
        if (column.showLocation && shot.location) {
          lines.push(shot.location);
        }
        return lines.length > 0 ? lines.join('\n') : '-';
      }

      // Regular columns
      switch (column.id) {
        case SECTION_TYPES.SHOT_TYPE:
          // Use centralized description resolver with safe fallback logic
          // See src/lib/shotDescription.js for precedence rules
          return getExportDescriptionText(shot, { products: shot?.products }) || "-";

        case SECTION_TYPES.TALENT: {
          const talentList = ensureStringList(shot?.talent);
          return talentList.length > 0 ? talentList.join(', ') : '-';
        }

        case SECTION_TYPES.PRODUCTS: {
          // Each product on its own line
          const productList = ensureStringList(shot?.products);
          return productList.length > 0 ? productList.join('\n') : '-';
        }

        case SECTION_TYPES.NOTES: {
          // Notes are already sanitized by buildPlannerExportLanes (via stripHtml)
          // Just use the pre-sanitized value directly
          return getShotNotesPreview(shot) || "-";
        }

        default:
          return '-';
      }
    };

    return (
      <View key={shotKey} style={styles.tableDataRow} wrap={false}>
        {showImage && (
          <View style={styles.tableImageCell}>
            {shot?.image && shot.image !== '__PREVIEW_PLACEHOLDER__' ? (
              <Image src={shot.image} style={styles.tableImage} />
            ) : (
              <View style={{ width: 50, height: 50, backgroundColor: '#e2e8f0', borderRadius: 2, justifyContent: 'center', alignItems: 'center' }}>
                {shot?._hasImage && <Text style={{ fontSize: 6, color: '#94a3b8' }}>IMG</Text>}
              </View>
            )}
          </View>
        )}
        {columns.map(column => {
          const width = `${((column.flex / totalFlex) * 100).toFixed(2)}%`;

          return (
            <View key={column.id} style={{ width, flexShrink: 0 }}>
              <Text style={styles.tableDataCell}>{renderCellContent(column)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ============================================================================
  // ShotBlock Renderer - Stacked layout for dense, scannable shot rows
  // Replaces column-based table rows with a hierarchical block structure:
  //   A) PRIMARY LINE: Shot name (dominant) + description (subline)
  //   B) SECONDARY METADATA: Compact strip with date/loc, talent, products
  //   C) NOTES: Full-width block when present
  //   D) IMAGE: Small thumbnail left-aligned when present
  // ============================================================================
  const renderShotBlock = (shot, _lane, index, sectionStates) => {
    const visibleSections = getVisibleSections(sectionStates);
    // Canonical gate: use options.fields.image, NOT sectionStates/visibleSections
    const showImage = Boolean(visibleFields.image);
    const showShotNumber = visibleSections.some(s => s.id === SECTION_TYPES.SHOT_NUMBER);
    const showShotName = visibleSections.some(s => s.id === SECTION_TYPES.SHOT_NAME);
    const showShotType = visibleSections.some(s => s.id === SECTION_TYPES.SHOT_TYPE);
    const showDate = visibleSections.some(s => s.id === SECTION_TYPES.DATE);
    const showLocation = visibleSections.some(s => s.id === SECTION_TYPES.LOCATION);
    const showTalent = visibleSections.some(s => s.id === SECTION_TYPES.TALENT);
    const showProducts = visibleSections.some(s => s.id === SECTION_TYPES.PRODUCTS);
    const showNotes = visibleSections.some(s => s.id === SECTION_TYPES.NOTES);

    const shotKey = shot?.id || index;
    const shotNumber = normaliseShotNumber(shot?.shotNumber);
    const talentList = ensureStringList(shot?.talent);
    const productList = ensureStringList(shot?.products);

    // Build primary line: shot name with optional shot number prefix
    const shotName = shot?.name || '';
    const displayName = showShotNumber && shotNumber
      ? `${shotNumber} · ${shotName || 'Untitled Shot'}`
      : shotName || (showShotName ? 'Untitled Shot' : '');

    // Build description using centralized resolver with safe fallback logic
    // See src/lib/shotDescription.js for precedence rules and suppression checks
    const description = showShotType ? getExportDescriptionText(shot, { products: productList }) : '';

    // Build metadata items (compact strip below name/description)
    // Products are rendered separately for better visual hierarchy
    const metaItems = [];

    // Date/Location combined
    if (showDate && shot?.date) {
      metaItems.push({ key: 'date', value: shot.date });
    }
    if (showLocation && shot?.location) {
      metaItems.push({ key: 'location', value: shot.location });
    }

    // Talent - comma-separated
    if (showTalent && talentList.length > 0) {
      metaItems.push({ key: 'talent', value: talentList.join(', ') });
    }

    // Products - displayed as separate semantic group with pill treatment
    const MAX_PRODUCTS_SHOWN = 3;
    const hasProducts = showProducts && productList.length > 0;
    const productsToShow = hasProducts ? productList.slice(0, MAX_PRODUCTS_SHOWN) : [];
    const remainingProducts = hasProducts ? productList.length - MAX_PRODUCTS_SHOWN : 0;

    // Notes (full width when present)
    const notesText = showNotes ? getShotNotesPreview(shot) : '';

    // Check if image is real (not a placeholder flag)
    const hasRealImage = showImage && shot?.image && shot.image !== '__PREVIEW_PLACEHOLDER__';

    return (
      <View key={shotKey} style={styles.shotBlock} wrap={false}>
        {/* Optional small thumbnail - only renders when real image exists */}
        {showImage && hasRealImage && (
          <View style={styles.shotBlockImageContainer}>
            <Image src={shot.image} style={styles.shotBlockImage} />
          </View>
        )}

        {/* Content area */}
        <View style={styles.shotBlockContent}>
          {/* Primary Line: Name + Description */}
          {(displayName || description) && (
            <View style={styles.shotBlockPrimary}>
              {displayName ? (
                <Text style={styles.shotBlockName}>{displayName}</Text>
              ) : null}
              {description ? (
                <Text style={styles.shotBlockDescription}>{description}</Text>
              ) : null}
            </View>
          )}

          {/* Secondary Metadata Strip (location, talent, date) */}
          {metaItems.length > 0 && (
            <View style={styles.shotBlockMeta}>
              {metaItems.map((item, idx) => (
                <React.Fragment key={item.key}>
                  {idx > 0 && (
                    <Text style={styles.shotBlockMetaSeparator}>·</Text>
                  )}
                  <Text style={styles.shotBlockMetaItem}>{item.value}</Text>
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Products - Separate semantic group with pill treatment */}
          {hasProducts && (
            <View style={styles.shotBlockProducts}>
              {productsToShow.map((product, idx) => (
                <Text key={`product-${idx}`} style={styles.shotBlockProductItem}>
                  {product}
                </Text>
              ))}
              {remainingProducts > 0 && (
                <Text style={styles.shotBlockProductMore}>+{remainingProducts} more</Text>
              )}
            </View>
          )}

          {/* Notes - Full Width with left rail */}
          {notesText ? (
            <View style={styles.shotBlockNotes}>
              <Text style={styles.shotBlockNotesText}>{notesText}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderShotCard = (shot, _lane, index) => {
    const shotNumber = normaliseShotNumber(shot?.shotNumber);
    const talentList = ensureStringList(shot?.talent);
    const productList = ensureStringList(shot?.products);
    const cardStyle = [styles.shotCard];
    const isGallery = layout === "gallery";
    const hasShotNumber = visibleFields.shotNumber && shotNumber;
    const hasImage = Boolean(visibleFields.image && shot?.image);
    const shotTitle = visibleFields.name && shot?.name ? shot.name : null;
    const shotKey = shot?.id || index;

    if (isGallery && layoutConfig) {
      const position = getCardPosition(index, layoutConfig);
      const cardDimensions = layoutConfig.cardWidth;
      const widthPercent = ((cardDimensions / 540) * 100).toFixed(4) + '%'; // 540 is usable area width

      cardStyle.push({
        width: widthPercent,
        maxWidth: widthPercent,
        flexBasis: widthPercent,
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: position.marginBottom,
        marginRight: position.marginRight,
        padding: densityPreset?.cardPadding || 10,
      });
    }

    const makeItem = (item, overrides = {}) => (item ? { ...item, ...overrides } : null);
    const productLabel = productList.length === 1 ? "Product" : "Products";

    const productItemBase = visibleFields.products
      ? { key: "products", icon: PdfIconPackage, label: productLabel, value: productList }
      : null;
    const locationItemBase = visibleFields.location
      ? { key: "location", icon: PdfIconLocation, label: "Location", value: shot?.location || null }
      : null;
    const talentItemBase = visibleFields.talent
      ? {
          key: "talent",
          icon: PdfIconTalent,
          label: "Talent",
          value: talentList.length ? talentList.join(", ") : null,
        }
      : null;
    const dateItemBase = visibleFields.date
      ? { key: "date", icon: PdfIconCalendar, label: "Date", value: shot?.date || null }
      : null;
    // Legacy shotType field is suppressed as a labeled item in card/list layout.
    // Description content flows through ShotBlock layout when using table mode.

    const notesContent = visibleFields.notes
      ? buildNotesContent(getShotNotesPreview(shot), `${shotKey}`, isGallery ? styles.galleryNotesContainer : null)
      : null;

    if (!isGallery) {
      const leftItems = [
        makeItem(locationItemBase, {
          containerStyle: styles.listDetailItem,
          labelStyle: styles.listDetailLabel,
          valueStyle: styles.listDetailValue,
        }),
        makeItem(talentItemBase, {
          containerStyle: styles.listDetailItem,
          labelStyle: styles.listDetailLabel,
          valueStyle: styles.listDetailValue,
        }),
      ].filter(Boolean);

      const rightItems = [
        makeItem(productItemBase, {
          containerStyle: styles.listDetailItem,
          labelStyle: styles.listDetailLabel,
          valueStyle: styles.listDetailValue,
          bulletStyle: styles.listDetailBullet,
        }),
        makeItem(dateItemBase, {
          containerStyle: styles.listDetailItem,
          labelStyle: styles.listDetailLabel,
          valueStyle: styles.listDetailValue,
        }),
      ].filter(Boolean);

      const hasRightContent = hasShotNumber || rightItems.length > 0;
      const leftColumnStyles = [styles.listColumn, styles.listLeftColumn];
      const rightColumnStyles = [styles.listColumn, styles.listRightColumn];

      if (!hasRightContent) {
        leftColumnStyles.push(styles.listColumnFull);
      }

      // Check if image is a real image or a preview placeholder
      const hasRealImage = hasImage && shot.image !== '__PREVIEW_PLACEHOLDER__';

      return (
        <View key={shotKey} style={cardStyle} wrap={false}>
          <View style={styles.listRow}>
            <View style={leftColumnStyles}>
              {/* Image: only render when real image exists */}
              {hasRealImage ? (
                <Image src={shot.image} style={shotImageStyle} />
              ) : null}
              {shotTitle ? <Text style={styles.shotTitle}>{shotTitle}</Text> : null}
              {leftItems.map((item, itemIndex) => renderDetailItem(item, itemIndex))}
            </View>
            {hasRightContent ? (
              <View style={rightColumnStyles}>
                {hasShotNumber ? <Text style={styles.shotNumberBadge}>{shotNumber}</Text> : null}
                {rightItems.map((item, itemIndex) => renderDetailItem(item, itemIndex))}
              </View>
            ) : null}
          </View>
          {notesContent}
        </View>
      );
    }

    // ========================================================================
    // Gallery V2 Editorial Layout
    // Hierarchy: Title → Description → Meta Strip → Products → Notes
    // No field labels; denser, more scannable design
    // ========================================================================

    const effectiveColumns = layoutConfig?.columns || galleryColumns;
    const isCompact = effectiveColumns >= 3;

    // Title styles
    const titleStyle = [styles.galleryV2Title];
    if (isCompact) titleStyle.push(styles.galleryV2TitleCompact);

    // Get description using centralized resolver
    const descriptionText = getExportDescriptionText(shot, { products: productList });
    const descriptionStyle = [styles.galleryV2Description];
    if (isCompact) descriptionStyle.push(styles.galleryV2DescriptionCompact);

    // Build meta strip items (location · talent · date)
    const metaItems = [];
    if (visibleFields.location && shot?.location) {
      metaItems.push({ key: 'location', value: shot.location });
    }
    if (visibleFields.talent && talentList.length > 0) {
      metaItems.push({ key: 'talent', value: talentList.join(', ') });
    }
    if (visibleFields.date && shot?.date) {
      metaItems.push({ key: 'date', value: shot.date });
    }

    const metaItemStyle = [styles.galleryV2MetaItem];
    const metaSepStyle = [styles.galleryV2MetaSeparator];
    if (isCompact) {
      metaItemStyle.push(styles.galleryV2MetaItemCompact);
      metaSepStyle.push(styles.galleryV2MetaSeparatorCompact);
    }

    // Products: cap at 2 items with "+N more"
    const MAX_PRODUCTS_SHOWN = 2;
    const showProducts = visibleFields.products && productList.length > 0;
    const productsToShow = showProducts ? productList.slice(0, MAX_PRODUCTS_SHOWN) : [];
    const remainingProducts = showProducts ? productList.length - MAX_PRODUCTS_SHOWN : 0;
    const productItemStyle = [styles.galleryV2ProductItem];
    if (isCompact) productItemStyle.push(styles.galleryV2ProductItemCompact);

    // Notes: deterministic truncation at 120 chars (consistent across all densities)
    const GALLERY_NOTES_MAX_CHARS = 120;
    const rawNotes = visibleFields.notes ? getShotNotesPreview(shot) : '';
    const truncatedNotes = rawNotes.length > GALLERY_NOTES_MAX_CHARS
      ? rawNotes.slice(0, GALLERY_NOTES_MAX_CHARS).trim() + '…'
      : rawNotes;
    const notesStyle = [styles.galleryV2Notes];
    const notesTextStyle = [styles.galleryV2NotesText];
    if (isCompact) {
      notesStyle.push(styles.galleryV2NotesCompact);
      notesTextStyle.push(styles.galleryV2NotesTextCompact);
    }

    // Check if image is a real image or a preview placeholder for gallery
    const hasRealGalleryImage = hasImage && shot.image !== '__PREVIEW_PLACEHOLDER__';

    return (
      <View key={shotKey} style={cardStyle} wrap={false}>
        {/* Shot Number Badge */}
        {hasShotNumber ? (
          <Text style={[styles.shotNumberBadge, styles.galleryShotNumber]}>{shotNumber}</Text>
        ) : null}

        {/* Image: only render when real image exists; omit placeholder to avoid "broken CMS" feel */}
        {hasRealGalleryImage ? (
          <Image src={shot.image} style={shotImageStyle} />
        ) : null}

        {/* Title */}
        {shotTitle ? <Text style={titleStyle}>{shotTitle}</Text> : null}

        {/* Description (via centralized resolver) */}
        {descriptionText ? <Text style={descriptionStyle}>{descriptionText}</Text> : null}

        {/* Meta Strip: Location · Talent · Date */}
        {metaItems.length > 0 ? (
          <View style={styles.galleryV2MetaStrip}>
            {metaItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {idx > 0 ? <Text style={metaSepStyle}>·</Text> : null}
                <Text style={metaItemStyle}>{item.value}</Text>
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {/* Products (capped at 2 + "+N more") */}
        {showProducts ? (
          <View style={styles.galleryV2Products}>
            {productsToShow.map((product, idx) => (
              <Text key={`product-${idx}`} style={productItemStyle}>
                <Text style={styles.galleryV2ProductBullet}>• </Text>
                {product}
              </Text>
            ))}
            {remainingProducts > 0 ? (
              <Text style={styles.galleryV2ProductMore}>+{remainingProducts} more</Text>
            ) : null}
          </View>
        ) : null}

        {/* Notes (truncated callout) */}
        {truncatedNotes ? (
          <View style={notesStyle}>
            <Text style={notesTextStyle}>{truncatedNotes}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderSummaryTable = (headers, rows) => (
    <View style={styles.summarySection} wrap={false}>
      <View style={[styles.tableRow, { borderBottomWidth: 2 }]}>
        {headers.map((header, index) => (
          <View key={header.key || index} style={{ flex: header.flex || 1 }}>
            <Text style={styles.tableHeader}>{header.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={row.key || rowIndex} style={styles.tableRow}>
          {headers.map((header, index) => (
            <View key={header.key || index} style={{ flex: header.flex || 1 }}>
              <Text style={styles.tableCell}>{row[header.key]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  // ============================================================================
  // PDF Document Rendering
  // Structure follows the document composition model exactly:
  // 1. DocumentHeader (title, subtitle, timestamp) - ONCE
  // 2. GlobalSummaries (lane summary, talent summary) - ONCE
  // 3. LaneSections (repeated per lane with shot content)
  // ============================================================================
  return (
    <Document>
      <Page size="LETTER" orientation={orientation} style={styles.page}>
        {/* ================================================================
            DOCUMENT HEADER - Rendered exactly ONCE at document start
            Uses headerState from document composition model
            ================================================================ */}
        <View style={styles.header} wrap={false}>
          {headerState.title ? <Text style={styles.title}>{headerState.title}</Text> : null}
          {headerState.subtitle ? <Text style={styles.subtitle}>{headerState.subtitle}</Text> : null}
        </View>

        {/* ================================================================
            GLOBAL SUMMARIES - Rendered exactly ONCE after header
            These are document-level summaries, NOT repeated per lane
            ================================================================ */}
        {showLaneSummary
          ? renderSummaryTable(
              [
                { key: "name", label: "Lane", flex: 2 },
                { key: "shots", label: "Shots", flex: 1 },
              ],
              laneSummary.lanes.map((lane) => ({
                key: lane.id,
                name: lane.name,
                shots: String(lane.shotCount ?? 0),
              }))
            )
          : null}
        {showTalentSummary
          ? renderSummaryTable(
              [
                { key: "name", label: "Talent", flex: 2 },
                { key: "total", label: "Total", flex: 1 },
                ...talentLanes.map((lane) => ({
                  key: lane.id,
                  label: lane.name,
                  flex: 1,
                })),
              ],
              talentRows.map((row) => ({
                key: row.id,
                name: row.name,
                total: String(row.total ?? 0),
                ...Object.fromEntries(
                  talentLanes.map((lane) => [lane.id, String(row.byLane?.[lane.id] ?? 0)])
                ),
              }))
            )
          : null}

        {/* ================================================================
            LANE SECTIONS - Repeated for each lane
            Each lane contains its shots (no header/summary repetition)
            Table layout uses ShotBlock (stacked design for dense readability)
            Gallery layout uses shotCards
            ================================================================ */}
        {exportLanes.map((lane, laneIndex) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shotCards = laneShots.map((shot, index) => renderShotCard(shot, lane, index));
          // Use ShotBlock layout for table mode (stacked, dense, scannable)
          const shotBlocks = laneShots.map((shot, index) => renderShotBlock(shot, lane, index, sectionStates));
          return (
            <View key={lane.id} style={styles.laneSection}>
              <Text style={styles.laneHeading}>
                {lane.name} ({laneShots.length} shots)
              </Text>
              {laneShots.length === 0 ? (
                <Text style={styles.tableCell}>No shots in this lane.</Text>
              ) : layout === "gallery" ? (
                <View style={styles.galleryContainer}>{shotCards}</View>
              ) : (
                <View>{shotBlocks}</View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
});

// Display name for debugging
PlannerPdfDocument.displayName = 'PlannerPdfDocument';

const escapeCsv = (value) => {
  if (value == null) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const PlannerExportModal = ({ open, onClose, lanes, defaultVisibleFields, isLoading, projectName }) => {
  // ============================================================================
  // New Preset-Driven State (ExportEditorShell)
  // ============================================================================
  // The resolved config from ExportEditorShell drives both preview and export
  const [resolvedConfig, setResolvedConfig] = useState(null);
  const [legacyOptionsFromPreset, setLegacyOptionsFromPreset] = useState(null);

  // Handler for config changes from ExportEditorShell
  const handlePresetConfigChange = useCallback((config, legacyOpts) => {
    setResolvedConfig(config);
    setLegacyOptionsFromPreset(legacyOpts);
  }, []);

  // ============================================================================
  // Canonical Derived Options (Single Source of Truth)
  // ============================================================================
  // This memoized object is computed directly from the preset config.
  // Preview, PDF export, and CSV export all consume this same object,
  // eliminating sync issues and ensuring visual consistency.
  //
  // Dependencies are stable primitives and nested objects from legacyOptionsFromPreset.
  // The memo only recomputes when actual config values change.
  // ============================================================================

  // ============================================================================
  // Legacy State (kept for backward compatibility, driven by preset config)
  // ============================================================================
  const [title, setTitle] = useState("Planner export");
  const [subtitle, setSubtitle] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [layoutMode, setLayoutMode] = useState("table");
  const [density, setDensity] = useState("standard");
  const [galleryColumns, setGalleryColumns] = useState("3");
  const [fallbackToProductImages, setFallbackToProductImages] = useState(true);
  const [inlineImages, setInlineImages] = useState(true);

  // Initialize section states first
  const [sectionStates, setSectionStates] = useState(() => getDefaultSectionConfig());

  // Custom labels for table headers (allows user to shorten labels for better fit)
  const [customLabels, setCustomLabels] = useState({});

  // Initialize fields from section states
  const [fields, setFields] = useState(() => getVisibleFieldKeys(getDefaultSectionConfig()));
  const [includeLaneSummary, setIncludeLaneSummary] = useState(true);
  const [includeTalentSummary, setIncludeTalentSummary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [imageLoadProgress, setImageLoadProgress] = useState({ loaded: 0, total: 0 });
  const [laneFilterMode, setLaneFilterMode] = useState("all");
  const [selectedLaneIds, setSelectedLaneIds] = useState([]);
  const [selectedTalentNames, setSelectedTalentNames] = useState([]);
  const [dateFilterMode, setDateFilterMode] = useState("any");
  const [selectedDate, setSelectedDate] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // On-demand PDF preview state (lightweight HTML preview by default)
  const [isGeneratingPdfPreview, setIsGeneratingPdfPreview] = useState(false);

  // High-fidelity inline PDF preview toggle (default OFF — keeps LightweightExportPreview)
  const [highFidelityPreview, setHighFidelityPreview] = useState(false);
  const [highFidelityWasAutoDisabled, setHighFidelityWasAutoDisabled] = useState(false);

  // Section expansion state for ExportSectionPanel (legacy UI, no longer user-facing)
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    summaries: true,
    shots: true,
  });

  // Resizable divider state (no longer needed with ExportEditorShell's built-in layout)
  const [dividerPosition, setDividerPosition] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // ============================================================================
  // Derived Legacy Options (CANONICAL SOURCE OF TRUTH)
  // ============================================================================
  // This is the single memoized object that preview, PDF export, and CSV export
  // all consume. It's computed directly from legacyOptionsFromPreset (when available)
  // with fallback to legacy state variables for edge cases.
  //
  // Benefits:
  // - Single source of truth eliminates sync bugs
  // - Preview always matches export (trust invariant maintained)
  // - Memoization with explicit dependencies prevents unnecessary re-renders
  // ============================================================================
  const derivedLegacyOptions = useMemo(() => {
    // When preset config is available, use it directly as the canonical source
    if (legacyOptionsFromPreset) {
      return {
        title: legacyOptionsFromPreset.title || projectName || "Planner export",
        subtitle: legacyOptionsFromPreset.subtitle || "",
        orientation: legacyOptionsFromPreset.orientation || "portrait",
        layout: legacyOptionsFromPreset.layout || "table",
        density: legacyOptionsFromPreset.density || "standard",
        galleryColumns: Number(legacyOptionsFromPreset.galleryColumns) || 3,
        fields: {
          shotNumber: legacyOptionsFromPreset.fields?.shotNumber ?? true,
          name: legacyOptionsFromPreset.fields?.shotName ?? true,
          type: legacyOptionsFromPreset.fields?.shotType ?? true,
          date: legacyOptionsFromPreset.fields?.date ?? true,
          location: legacyOptionsFromPreset.fields?.location ?? true,
          talent: legacyOptionsFromPreset.fields?.talent ?? true,
          products: legacyOptionsFromPreset.fields?.products ?? true,
          notes: legacyOptionsFromPreset.fields?.notes ?? true,
          image: legacyOptionsFromPreset.fields?.image ?? false,
        },
        sectionStates, // Keep section states for column widths
        customLabels,
        includeLaneSummary: legacyOptionsFromPreset.includeLaneSummary ?? true,
        includeTalentSummary: legacyOptionsFromPreset.includeTalentSummary ?? true,
        includeImages: legacyOptionsFromPreset.includeImages ?? false,
        fallbackToProductImages: legacyOptionsFromPreset.fallbackToProductImages ?? true,
        inlineImages: legacyOptionsFromPreset.inlineImages ?? true,
      };
    }

    // Fallback to legacy state variables (for backward compatibility)
    const resolvedGalleryColumnsValue = (() => {
      const parsed = Number.parseInt(galleryColumns, 10);
      if (Number.isNaN(parsed)) return 1;
      return Math.min(6, Math.max(1, parsed));
    })();

    return {
      title,
      subtitle,
      orientation,
      layout: layoutMode,
      density,
      galleryColumns: resolvedGalleryColumnsValue,
      fields,
      sectionStates,
      customLabels,
      includeLaneSummary,
      includeTalentSummary,
      includeImages: fields.image,
      fallbackToProductImages,
      inlineImages,
    };
  }, [
    // Preset config (primary source)
    legacyOptionsFromPreset,
    projectName,
    // Legacy state (fallback)
    title,
    subtitle,
    orientation,
    layoutMode,
    density,
    galleryColumns,
    fields,
    sectionStates,
    customLabels,
    includeLaneSummary,
    includeTalentSummary,
    fallbackToProductImages,
    inlineImages,
  ]);

  // ============================================================================
  // Sync legacy state from preset config when it changes
  // DEPRECATED: This sync is kept for backward compatibility but derivedLegacyOptions
  // is now the canonical source. This sync ensures legacy UI components still work.
  // STABILITY FIX: Only update state when values actually changed to prevent
  // render loops and excessive PDF regeneration
  // ============================================================================
  const prevLegacyOptionsRef = useRef(null);

  useEffect(() => {
    if (!legacyOptionsFromPreset) return;

    // Skip if the options haven't meaningfully changed (prevents ping-pong)
    const prev = prevLegacyOptionsRef.current;
    if (prev) {
      // Fast equality check on key fields that trigger re-renders
      const sameTitle = (legacyOptionsFromPreset.title || projectName || "Planner export") === title;
      const sameSubtitle = (legacyOptionsFromPreset.subtitle || "") === subtitle;
      const sameOrientation = (legacyOptionsFromPreset.orientation || "portrait") === orientation;
      const sameLayout = (legacyOptionsFromPreset.layout || "table") === layoutMode;
      const sameDensity = (legacyOptionsFromPreset.density || "standard") === density;
      const sameColumns = String(legacyOptionsFromPreset.galleryColumns || 3) === galleryColumns;
      const sameLaneSummary = (legacyOptionsFromPreset.includeLaneSummary ?? true) === includeLaneSummary;
      const sameTalentSummary = (legacyOptionsFromPreset.includeTalentSummary ?? true) === includeTalentSummary;

      // Check if all values are the same - skip update entirely
      if (sameTitle && sameSubtitle && sameOrientation && sameLayout &&
          sameDensity && sameColumns && sameLaneSummary && sameTalentSummary) {
        // Fields check only if basic props match
        if (legacyOptionsFromPreset.fields && prev.fields) {
          const fieldsMatch =
            (legacyOptionsFromPreset.fields.shotNumber ?? true) === (prev.fields.shotNumber ?? true) &&
            (legacyOptionsFromPreset.fields.shotName ?? true) === (prev.fields.shotName ?? true) &&
            (legacyOptionsFromPreset.fields.shotType ?? true) === (prev.fields.shotType ?? true) &&
            (legacyOptionsFromPreset.fields.date ?? true) === (prev.fields.date ?? true) &&
            (legacyOptionsFromPreset.fields.location ?? true) === (prev.fields.location ?? true) &&
            (legacyOptionsFromPreset.fields.talent ?? true) === (prev.fields.talent ?? true) &&
            (legacyOptionsFromPreset.fields.products ?? true) === (prev.fields.products ?? true) &&
            (legacyOptionsFromPreset.fields.notes ?? true) === (prev.fields.notes ?? true) &&
            (legacyOptionsFromPreset.fields.image ?? true) === (prev.fields.image ?? true);
          if (fieldsMatch) {
            return; // No changes - skip all state updates
          }
        }
      }
    }

    // Store current for next comparison
    prevLegacyOptionsRef.current = legacyOptionsFromPreset;

    // Batch state updates - only update values that actually changed
    const newTitle = legacyOptionsFromPreset.title || projectName || "Planner export";
    const newSubtitle = legacyOptionsFromPreset.subtitle || "";
    const newOrientation = legacyOptionsFromPreset.orientation || "portrait";
    const newLayout = legacyOptionsFromPreset.layout || "table";
    const newDensity = legacyOptionsFromPreset.density || "standard";
    const newColumns = String(legacyOptionsFromPreset.galleryColumns || 3);
    const newLaneSummary = legacyOptionsFromPreset.includeLaneSummary ?? true;
    const newTalentSummary = legacyOptionsFromPreset.includeTalentSummary ?? true;

    // Update only changed values to minimize re-renders
    if (newTitle !== title) setTitle(newTitle);
    if (newSubtitle !== subtitle) setSubtitle(newSubtitle);
    if (newOrientation !== orientation) setOrientation(newOrientation);
    if (newLayout !== layoutMode) setLayoutMode(newLayout);
    if (newDensity !== density) setDensity(newDensity);
    if (newColumns !== galleryColumns) setGalleryColumns(newColumns);
    if (newLaneSummary !== includeLaneSummary) setIncludeLaneSummary(newLaneSummary);
    if (newTalentSummary !== includeTalentSummary) setIncludeTalentSummary(newTalentSummary);

    // Map and update fields only if they changed
    if (legacyOptionsFromPreset.fields) {
      const mappedFields = {
        shotNumber: legacyOptionsFromPreset.fields.shotNumber ?? true,
        name: legacyOptionsFromPreset.fields.shotName ?? true,
        type: legacyOptionsFromPreset.fields.shotType ?? true,
        date: legacyOptionsFromPreset.fields.date ?? true,
        location: legacyOptionsFromPreset.fields.location ?? true,
        talent: legacyOptionsFromPreset.fields.talent ?? true,
        products: legacyOptionsFromPreset.fields.products ?? true,
        notes: legacyOptionsFromPreset.fields.notes ?? true,
        image: legacyOptionsFromPreset.fields.image ?? true,
      };
      // Only update fields if at least one value differs
      const fieldsChanged = Object.keys(mappedFields).some(key => mappedFields[key] !== fields[key]);
      if (fieldsChanged) {
        setFields(mappedFields);
      }
    }
  }, [legacyOptionsFromPreset, projectName, title, subtitle, orientation, layoutMode, density, galleryColumns, includeLaneSummary, includeTalentSummary, fields]);

  const laneOptions = useMemo(() => {
    if (!Array.isArray(lanes)) return [];
    return lanes.map((lane) => ({
      id: lane.id,
      name: lane.name || "Untitled lane",
    }));
  }, [lanes]);

  const talentOptions = useMemo(() => {
    const collected = new Map();
    let hasUnassigned = false;
    if (Array.isArray(lanes)) {
      lanes.forEach((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        laneShots.forEach((shot) => {
          const talents = Array.isArray(shot.talent) ? shot.talent : [];
          const trimmed = talents.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean);
          if (!trimmed.length) {
            hasUnassigned = true;
            return;
          }
          trimmed.forEach((name) => {
            if (!collected.has(name)) {
              collected.set(name, { value: name, label: name });
            }
          });
        });
      });
    }
    const entries = Array.from(collected.values()).sort((a, b) => a.label.localeCompare(b.label));
    if (hasUnassigned) {
      entries.push({ value: UNASSIGNED_TALENT_FILTER_VALUE, label: "Unassigned" });
    }
    return entries;
  }, [lanes]);

  const availableDates = useMemo(() => {
    const values = new Set();
    if (Array.isArray(lanes)) {
      lanes.forEach((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        laneShots.forEach((shot) => {
          if (shot?.date) {
            values.add(shot.date);
          }
        });
      });
    }
    return Array.from(values).sort();
  }, [lanes]);

  const resolvedGalleryColumns = useMemo(() => {
    const parsed = Number.parseInt(galleryColumns, 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.min(6, Math.max(1, parsed));
  }, [galleryColumns]);

  /**
   * Handle mouse move for resizing divider
   */
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;

      // Constrain between 20% and 80%
      const clampedPosition = Math.min(Math.max(newPosition, 20), 80);
      setDividerPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    // Auto-populate title with project name, fallback to "Planner export"
    setTitle(projectName || "Planner export");
    setSubtitle(`Generated ${now.toLocaleString()}`);
    setOrientation("portrait");
    setLayoutMode("table");
    setGalleryColumns("3");
    setIncludeLaneSummary(true);
    setIncludeTalentSummary(true);
    setLaneFilterMode("all");
    setSelectedLaneIds(laneOptions.map((lane) => lane.id));
    setSelectedTalentNames([]);
    setDateFilterMode("any");
    setSelectedDate("");

    const initialFields = {
      shotNumber: true,
      name: true,
      type: true,
      date: true,
      location: defaultVisibleFields?.location ?? true,
      talent: defaultVisibleFields?.talent ?? true,
      products: defaultVisibleFields?.products ?? true,
      notes: defaultVisibleFields?.notes ?? true,
      image: false,
    };

    setFields(initialFields);

    // Initialize section states from fields
    setSectionStates(exportSettingsToSectionConfig(initialFields));

    setGenerationStage("");
  }, [open, defaultVisibleFields, laneOptions, projectName]);

  // Sync fields with section states
  useEffect(() => {
    const visibleFields = getVisibleFieldKeys(sectionStates);
    setFields(visibleFields);
  }, [sectionStates]);

  const selectedLaneIdSet = useMemo(() => new Set(selectedLaneIds), [selectedLaneIds]);

  const filteredLanes = useMemo(() => {
    if (!Array.isArray(lanes)) return [];
    const limitToSelected = laneFilterMode === "selected";
    const includeUnassigned = selectedTalentNames.includes(UNASSIGNED_TALENT_FILTER_VALUE);
    const explicitTalent = selectedTalentNames.filter((value) => value !== UNASSIGNED_TALENT_FILTER_VALUE);
    const talentSet = new Set(explicitTalent);
    const hasTalentFilter = talentSet.size > 0 || includeUnassigned;
    const usingSpecificDate = dateFilterMode === "specific" && selectedDate;

    return lanes
      .filter((lane) => !limitToSelected || selectedLaneIdSet.has(lane.id))
      .map((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        const filteredShots = laneShots
          .filter((shot) => {
            const shotTalent = Array.isArray(shot.talent) ? shot.talent : [];
            const trimmedTalent = shotTalent
              .map((name) => (typeof name === "string" ? name.trim() : ""))
              .filter(Boolean);

            if (hasTalentFilter) {
              const matchesExplicit = trimmedTalent.some((name) => talentSet.has(name));
              const matchesUnassigned = includeUnassigned && trimmedTalent.length === 0;
              if (!matchesExplicit && !matchesUnassigned) {
                return false;
              }
            }

            if (usingSpecificDate && shot.date !== selectedDate) {
              return false;
            }

            return true;
          })
          // The image should already be set by buildPlannerExportLanes
          // Just return the shots as-is
          ;

        return {
          ...lane,
          shots: filteredShots,
        };
      });
  }, [
    lanes,
    laneFilterMode,
    selectedLaneIdSet,
    selectedTalentNames,
    dateFilterMode,
    selectedDate,
  ]);

  const hasShots = useMemo(
    () =>
      Array.isArray(filteredLanes) &&
      filteredLanes.some((lane) => Array.isArray(lane.shots) && lane.shots.length > 0),
    [filteredLanes]
  );

  // Canonical image flag: derivedLegacyOptions.fields.image is the ONLY source of truth.
  // Do NOT use the legacy `fields` state variable here — it can lag behind the preset config.
  const canonicalIncludeImages = Boolean(derivedLegacyOptions.fields.image);
  const canonicalFallback = Boolean(derivedLegacyOptions.fallbackToProductImages);
  const lanesWithImageFallback = useMemo(() => {
    if (!canonicalIncludeImages) return filteredLanes;
    return filteredLanes.map((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      const shots = laneShots.map((shot) => {
        if (shot?.image) return shot;
        if (!canonicalFallback) return shot;
        const fallback =
          Array.isArray(shot.productImages) && shot.productImages.length
            ? shot.productImages.find(Boolean)
            : null;
        if (!fallback) return shot;
        return { ...shot, image: fallback };
      });
      return { ...lane, shots };
    });
  }, [filteredLanes, canonicalIncludeImages, canonicalFallback]);

  // ============================================================================
  // Auto-disable high-fidelity preview when export config changes
  // Prevents runaway PDF regeneration by falling back to lightweight preview.
  // Uses a snapshot ref to detect actual changes (avoids render loops).
  // ============================================================================
  const hfConfigSnapshotRef = useRef(null);

  useEffect(() => {
    // Build a lightweight fingerprint of config that affects PDF output
    const laneFingerprint = lanesWithImageFallback.map(
      (l) => `${l.id || ''}:${Array.isArray(l.shots) ? l.shots.length : 0}`
    ).join(',');
    const configFingerprint = JSON.stringify({
      title: derivedLegacyOptions.title,
      subtitle: derivedLegacyOptions.subtitle,
      orientation: derivedLegacyOptions.orientation,
      layout: derivedLegacyOptions.layout,
      density: derivedLegacyOptions.density,
      galleryColumns: derivedLegacyOptions.galleryColumns,
      fields: derivedLegacyOptions.fields,
      includeLaneSummary: derivedLegacyOptions.includeLaneSummary,
      includeTalentSummary: derivedLegacyOptions.includeTalentSummary,
      includeImages: derivedLegacyOptions.includeImages,
      fallbackToProductImages: derivedLegacyOptions.fallbackToProductImages,
      lanes: laneFingerprint,
    });

    const prev = hfConfigSnapshotRef.current;
    hfConfigSnapshotRef.current = configFingerprint;

    // On first capture (prev === null) or when HF is off, just record — don't trigger
    if (prev === null || !highFidelityPreview) return;

    // Config changed while high fidelity is on → auto-disable
    if (prev !== configFingerprint) {
      setHighFidelityPreview(false);
      setHighFidelityWasAutoDisabled(true);
    }
  }, [derivedLegacyOptions, lanesWithImageFallback, highFidelityPreview]);

  // Image processing for PDF export - only runs when user clicks Download
  // This is the key change: images are NOT processed during preview
  const {
    processImagesForExport,
    cancelProcessing,
    resetProgress,
    progress: exportProgress,
    isProcessing: isExportingWithImages,
  } = useImageExportWorker();

  // State for showing export progress modal
  const [showExportProgress, setShowExportProgress] = useState(false);

  // Flatten all shots from filtered lanes for preview
  const filteredShots = useMemo(() => {
    if (!Array.isArray(lanesWithImageFallback)) return [];
    return lanesWithImageFallback.flatMap(lane => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      return laneShots.map(shot => ({
        ...shot,
        laneName: lane.name,
      }));
    });
  }, [lanesWithImageFallback]);

  const derivedLaneSummary = useMemo(() => {
    const summaries = Array.isArray(lanesWithImageFallback)
      ? lanesWithImageFallback.map((lane) => ({
          id: lane.id,
          name: lane.name || "Untitled lane",
          shotCount: Array.isArray(lane.shots) ? lane.shots.length : 0,
        }))
      : [];
    const totalShots = summaries.reduce((acc, lane) => acc + lane.shotCount, 0);
    return { totalShots, lanes: summaries };
  }, [lanesWithImageFallback]);

  const derivedTalentSummary = useMemo(() => {
    const laneOrder = Array.isArray(lanesWithImageFallback) ? lanesWithImageFallback : [];
    const baseByLane = laneOrder.reduce((acc, lane) => ({ ...acc, [lane.id]: 0 }), {});
    const tally = new Map();

    const ensureTalent = (id, name) => {
      if (!tally.has(id)) {
        tally.set(id, {
          id,
          name,
          total: 0,
          byLane: { ...baseByLane },
        });
      }
      return tally.get(id);
    };

    ensureTalent(UNASSIGNED_TALENT_FILTER_VALUE, "Unassigned");

    laneOrder.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        const shotTalent = Array.isArray(shot.talent) ? shot.talent : [];
        const trimmedTalent = shotTalent
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter(Boolean);

        if (!trimmedTalent.length) {
          const unassigned = ensureTalent(UNASSIGNED_TALENT_FILTER_VALUE, "Unassigned");
          unassigned.total += 1;
          unassigned.byLane[lane.id] = (unassigned.byLane[lane.id] || 0) + 1;
          return;
        }

        const seen = new Set();
        trimmedTalent.forEach((name) => {
          const key = name || "Unnamed talent";
          if (seen.has(key)) return;
          seen.add(key);
          const entry = ensureTalent(key, name || "Unnamed talent");
          entry.total += 1;
          entry.byLane[lane.id] = (entry.byLane[lane.id] || 0) + 1;
        });
      });
    });

    const rows = Array.from(tally.values()).sort((a, b) => {
      if (a.id === UNASSIGNED_TALENT_FILTER_VALUE) return 1;
      if (b.id === UNASSIGNED_TALENT_FILTER_VALUE) return -1;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });

    return {
      lanes: laneOrder.map((lane) => ({ id: lane.id, name: lane.name || "Untitled lane" })),
      rows,
    };
  }, [lanesWithImageFallback]);

  // ============================================================================
  // DEPRECATED: selectedOptions is replaced by derivedLegacyOptions
  // Kept for backward compatibility but no longer used as primary pipeline.
  // Preview, PDF export, and CSV export now all use derivedLegacyOptions.
  // TODO: Remove in future cleanup once confirmed stable.
  // ============================================================================
  const selectedOptions = useMemo(
    () => ({
      title,
      subtitle,
      orientation,
      layout: layoutMode,
      density,
      galleryColumns: resolvedGalleryColumns,
      fields,
      sectionStates, // Pass full section states including flex values for column widths
      customLabels,
      includeLaneSummary,
      includeTalentSummary,
    }),
    [
      title,
      subtitle,
      orientation,
      layoutMode,
      density,
      resolvedGalleryColumns,
      fields,
      sectionStates,
      customLabels,
      includeLaneSummary,
      includeTalentSummary,
    ]
  );

  // NOTE: The inline preview is rendered by LightweightExportPreview (HTML-based),
  // which receives lanesWithImageFallback and derivedLegacyOptions directly.
  // No additional lane preprocessing is needed here — LightweightExportPreview
  // resolves image URLs asynchronously via useResolvedImageUrl.

  const handleToggleLane = useCallback((laneId) => {
    setSelectedLaneIds((previous) => {
      if (previous.includes(laneId)) {
        return previous.filter((id) => id !== laneId);
      }
      return [...previous, laneId];
    });
  }, []);

  const handleToggleTalent = useCallback((talentValue) => {
    setSelectedTalentNames((previous) => {
      if (previous.includes(talentValue)) {
        return previous.filter((value) => value !== talentValue);
      }
      return [...previous, talentValue];
    });
  }, []);

  const handleSelectAllLanes = useCallback(() => {
    setSelectedLaneIds(laneOptions.map((lane) => lane.id));
  }, [laneOptions]);

  const clearTalentFilters = useCallback(() => setSelectedTalentNames([]), []);

  const handleSectionToggle = useCallback((sectionId, isExpanded) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: isExpanded,
    }));
  }, []);

  const handleIncludeImagesChange = useCallback((include) => {
    setSectionStates(prev => ({
      ...prev,
      [SECTION_TYPES.IMAGE]: {
        ...prev[SECTION_TYPES.IMAGE],
        visible: include,
      },
    }));
  }, []);

  // ============================================================================
  // Canonical PDF inputs — SINGLE source of truth for both handlers
  // Both "Open PDF preview" and "Export PDF" MUST call this and use its output.
  // ============================================================================
  const getPdfInputs = useCallback(() => {
    return buildPdfInputs({
      options: derivedLegacyOptions,
      lanes: lanesWithImageFallback,
      laneSummary: derivedLaneSummary,
      talentSummary: derivedTalentSummary,
    });
  }, [derivedLegacyOptions, lanesWithImageFallback, derivedLaneSummary, derivedTalentSummary]);

  // Handler for opening PDF preview in a new tab (on-demand, not automatic)
  // Images are resolved to base64 before PDF generation — same contract as Export PDF.
  const handleOpenPdfPreview = useCallback(async () => {
    if (!hasShots) {
      toast.error("No shots to preview.");
      return;
    }

    try {
      setIsGeneratingPdfPreview(true);

      // Use canonical inputs — same object as Export PDF
      const { options, lanes, laneSummary: ls, talentSummary: ts, meta } = getPdfInputs();

      // DEV-only: log inputs to prove parity with Export PDF
      logPdfInputs('open-preview', meta, options);

      // Resolve images to base64 (same path as Export PDF)
      let preparedLanes = lanes;
      if (meta.imagesEnabled) {
        const { imageDataMap } = await processImagesForExport(
          lanes,
          options.density || 'standard',
          Boolean(options.fallbackToProductImages)
        );

        preparedLanes = lanes.map((lane) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shots = laneShots.map((shot) => {
            const shotId = shot?.id ? String(shot.id) : null;
            const base64 = shotId ? imageDataMap.get(shotId) : null;
            return { ...shot, image: base64 || null };
          });
          return { ...lane, shots };
        });

        if (process.env.NODE_ENV === 'development') {
          const firstTwo = preparedLanes.flatMap(l => l.shots || []).filter(s => s.image).slice(0, 2);
          console.log('[IMAGE-CONTRACT] open-preview first 2 src prefixes:', firstTwo.map(s => s.image?.substring(0, 30)));
        }
      }

      // Generate PDF blob with resolved images
      const blob = await pdf(
        <PlannerPdfDocument
          lanes={preparedLanes}
          laneSummary={ls}
          talentSummary={ts}
          options={options}
        />
      ).toBlob();

      // Open in new tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up the blob URL after a delay (allow time for tab to load)
      setTimeout(() => URL.revokeObjectURL(url), 30000);

    } catch (error) {
      console.error('PDF preview generation failed:', error);
      toast.error('Failed to generate PDF preview. Please try again.');
    } finally {
      setIsGeneratingPdfPreview(false);
    }
  }, [hasShots, getPdfInputs, processImagesForExport]);

  const isLaneSelectionMode = laneFilterMode === "selected";

  const handleDownloadPdf = useCallback(async () => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }

    // Use canonical inputs — same object as Open PDF Preview
    const { options, lanes, laneSummary: ls, talentSummary: ts, meta } = getPdfInputs();

    // DEV-only: log inputs to prove parity with Open PDF Preview
    logPdfInputs('export-pdf', meta, options);

    const shouldIncludeImages = meta.imagesEnabled;
    const shouldInlineImages = options.inlineImages;
    const exportDensity = options.density;
    const exportFallbackToProductImages = options.fallbackToProductImages;
    const exportTitle = options.title;

    try {
      setIsGenerating(true);
      let preparedLanes;

      // If images are enabled and we're inlining, enhance lanes with base64 data
      // This is an enhancement on top of the canonical lanes (which have URLs).
      if (shouldIncludeImages && shouldInlineImages) {
        // Show progress modal for image processing
        setShowExportProgress(true);
        resetProgress();

        // Process images using Web Worker (off main thread)
        // Use the canonical lanes (which already have fallback images applied)
        const { imageDataMap, successCount, failedCount } = await processImagesForExport(
          lanes,
          exportDensity,
          exportFallbackToProductImages
        );

        if (failedCount > 0 && successCount === 0) {
          toast.error("Failed to load any images. Try exporting without images.");
          setShowExportProgress(false);
          setIsGenerating(false);
          return;
        }

        if (failedCount > 0) {
          toast.warning(`${failedCount} images failed to load and will be skipped.`);
        }

        // Replace URL images with processed base64 data
        preparedLanes = lanes.map((lane) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shots = laneShots.map((shot) => {
            const preparedShot = { ...shot };
            const shotId = shot?.id ? String(shot.id) : null;
            if (shotId && imageDataMap.has(shotId)) {
              preparedShot.image = imageDataMap.get(shotId);
            } else {
              preparedShot.image = null;
            }
            return preparedShot;
          });
          return { ...lane, shots };
        });
      } else {
        // Images OFF or not inlined: use canonical lanes as-is
        // (buildPdfInputs already stripped images when disabled)
        preparedLanes = lanes;
      }

      if (process.env.NODE_ENV === 'development') {
        const firstTwo = preparedLanes.flatMap(l => l.shots || []).filter(s => s.image).slice(0, 2);
        console.log('[IMAGE-CONTRACT] export-pdf first 2 src prefixes:', firstTwo.map(s => s.image?.substring(0, 30)));
      }

      // Generate PDF (this is fast since images are already processed)
      setGenerationStage("Rendering PDF…");
      const blob = await pdf(
        <PlannerPdfDocument
          lanes={preparedLanes}
          laneSummary={ls}
          talentSummary={ts}
          options={options}
        />
      ).toBlob();

      // Download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `${exportTitle || "planner-export"}.pdf`;
      link.download = filename.replace(/\s+/g, "-");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF export saved");
      setShowExportProgress(false);
      onClose?.();
    } catch (error) {
      console.error("[Planner] Failed to export PDF", error);
      toast.error("Unable to generate PDF export");
      setShowExportProgress(false);
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  }, [
    hasShots,
    getPdfInputs,
    onClose,
    processImagesForExport,
    resetProgress,
  ]);

  const handleDownloadCsv = useCallback(() => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }

    // Use derivedLegacyOptions as single source of truth (same as PDF and preview)
    const csvFields = derivedLegacyOptions.fields;
    const csvTitle = derivedLegacyOptions.title;

    const headers = ["Lane"];
    if (csvFields.shotNumber) headers.push("Shot number");
    if (csvFields.name) headers.push("Shot title");
    if (csvFields.type) headers.push("Description");
    if (csvFields.date) headers.push("Date");
    if (csvFields.location) headers.push("Location");
    if (csvFields.talent) headers.push("Talent");
    if (csvFields.products) headers.push("Products");
    if (csvFields.notes) headers.push("Notes");
    if (csvFields.image) headers.push("Image");

    const rows = [];
    lanesWithImageFallback.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        const row = [lane.name];
        if (csvFields.shotNumber) row.push(shot.shotNumber || "");
        if (csvFields.name) row.push(shot.name || "");
        // Use centralized description resolver with safe fallback logic
        if (csvFields.type) row.push(getExportDescriptionText(shot, { products: shot.products }));
        if (csvFields.date) row.push(shot.date || "");
        if (csvFields.location) row.push(shot.location || "");
        if (csvFields.talent) row.push(shot.talent.join(", "));
        if (csvFields.products) row.push(shot.products.join(", "));
        if (csvFields.notes) row.push(getShotNotesPreview(shot));
        if (csvFields.image) row.push(shot.image || "");
        rows.push(row.map(escapeCsv).join(","));
      });
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `${csvTitle || "planner-export"}.csv`;
    link.download = filename.replace(/\s+/g, "-");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV export saved");
    onClose?.();
  }, [derivedLegacyOptions, hasShots, lanesWithImageFallback, onClose]);

  // Don't render if not open
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Export Planner Sheet
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {title || "Planner Export"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleDownloadCsv} disabled={!hasShots || isLoading || isGenerating} className="gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
            <FileDown className="w-4 h-4" />
            Export CSV
          </Button>

          <Button
            onClick={handleDownloadPdf}
            disabled={!hasShots || isLoading || isGenerating}
            className="gap-2"
          >
            <FileDown className="w-4 h-4" />
            {isGenerating ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

        {/* Main Content Area - ExportEditorShell with integrated preview */}
        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
          {/* ExportEditorShell - Canonical preset-driven export UI */}
          <div className="flex-1 flex flex-col min-h-0">
            <ExportEditorShell
              projectName={projectName}
              initialDocumentType="internalPlanning"
              onConfigChange={handlePresetConfigChange}
            previewSlot={
              <div className="h-full flex flex-col">
                {/* Preview header with toggle and Open PDF button */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Preview
                    </span>
                    {/* High-fidelity toggle */}
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">High fidelity (PDF)</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={highFidelityPreview}
                        onClick={() => {
                          setHighFidelityPreview((v) => !v);
                          setHighFidelityWasAutoDisabled(false);
                        }}
                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          highFidelityPreview ? 'bg-slate-700' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            highFidelityPreview ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </label>
                    {/* Auto-disabled notice */}
                    {highFidelityWasAutoDisabled && !highFidelityPreview && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                        Paused (settings changed)
                        <button
                          type="button"
                          onClick={() => {
                            setHighFidelityWasAutoDisabled(false);
                            setHighFidelityPreview(true);
                          }}
                          className="underline hover:text-amber-700 dark:hover:text-amber-300 font-medium"
                        >
                          Re-enable
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenPdfPreview}
                    disabled={isGeneratingPdfPreview || !hasShots}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPdfPreview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open PDF preview
                      </>
                    )}
                  </button>
                </div>
                {/* Preview content: lightweight HTML or high-fidelity PDF iframe */}
                <div className="flex-1 min-h-0 overflow-auto">
                  {highFidelityPreview ? (
                    <InlinePdfPreview
                      enabled={highFidelityPreview}
                      getPdfInputs={getPdfInputs}
                      processImagesForExport={processImagesForExport}
                      PlannerPdfDocument={PlannerPdfDocument}
                      pdfRenderer={pdf}
                      totalShots={derivedLaneSummary.totalShots}
                      layout={derivedLegacyOptions.layout || 'gallery'}
                    />
                  ) : (
                    <LightweightExportPreview
                      lanes={lanesWithImageFallback}
                      options={derivedLegacyOptions}
                    />
                  )}
                </div>
              </div>
            }
            actionsSlot={
              <div className="flex items-center justify-between">
                {/* Filter Summary */}
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {laneFilterMode === "selected" && (
                    <span>{selectedLaneIds.length} lane{selectedLaneIds.length !== 1 ? 's' : ''} selected</span>
                  )}
                  {selectedTalentNames.length > 0 && (
                    <span className="ml-2">• {selectedTalentNames.length} talent filter{selectedTalentNames.length !== 1 ? 's' : ''}</span>
                  )}
                  {dateFilterMode === "specific" && selectedDate && (
                    <span className="ml-2">• Date: {selectedDate}</span>
                  )}
                </div>
                {/* Filters Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(prev => !prev)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>
            }
            />
          </div>

          {/* Slide-out Filter Panel (hidden by default) */}
          {showFilters && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filter Shots</h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose which lanes, talent, and dates to include.
                </p>

                {/* Lanes Filter */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lanes</span>
                  <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="planner-export-lane-filter"
                        value="all"
                        checked={laneFilterMode === "all"}
                        onChange={() => setLaneFilterMode("all")}
                        className="border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                      All lanes
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="planner-export-lane-filter"
                        value="selected"
                        checked={laneFilterMode === "selected"}
                        onChange={() => {
                          setLaneFilterMode("selected");
                          if (selectedLaneIds.length === 0) {
                            handleSelectAllLanes();
                          }
                        }}
                        className="border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                      Specific lanes
                    </label>
                  </div>
                  {isLaneSelectionMode && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        {laneOptions.map((lane) => (
                          <label key={lane.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={selectedLaneIdSet.has(lane.id)}
                              onChange={() => handleToggleLane(lane.id)}
                              className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                            />
                            {lane.name}
                          </label>
                        ))}
                      </div>
                      {laneOptions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            className="text-primary dark:text-blue-400 hover:underline"
                            onClick={handleSelectAllLanes}
                          >
                            Select all
                          </button>
                          <span>•</span>
                          <span>{selectedLaneIds.length} selected</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Talent Filter */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Talent</span>
                  {talentOptions.length > 0 ? (
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {talentOptions.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedTalentNames.includes(option.value)}
                            onChange={() => handleToggleTalent(option.value)}
                            className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No talent assignments yet.</p>
                  )}
                  {selectedTalentNames.length > 0 && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-primary dark:text-blue-400 hover:underline"
                      onClick={clearTalentFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {/* Dates Filter */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dates</span>
                  <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="planner-export-date-filter"
                        value="any"
                        checked={dateFilterMode === "any"}
                        onChange={() => {
                          setDateFilterMode("any");
                          setSelectedDate("");
                        }}
                        className="border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                      Any date
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="planner-export-date-filter"
                        value="specific"
                        checked={dateFilterMode === "specific"}
                        onChange={() => {
                          setDateFilterMode("specific");
                          if (!selectedDate && availableDates.length) {
                            setSelectedDate(availableDates[0]);
                          }
                        }}
                        className="border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                      Specific date
                    </label>
                  </div>
                  {dateFilterMode === "specific" && (
                    <div className="mt-2">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) => setSelectedDate(event.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Progress Modal - shown during image processing */}
        <ExportProgressModal
          open={showExportProgress}
          progress={exportProgress}
          onCancel={() => {
            cancelProcessing();
            setShowExportProgress(false);
            setIsGenerating(false);
          }}
        />
      </div>
  );
};

export { prepareLanesForPdf };
export default PlannerExportModal;
