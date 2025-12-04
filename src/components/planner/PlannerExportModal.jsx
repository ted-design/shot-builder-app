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
import { FileDown, Eye, X, GripVertical } from "lucide-react";
import PlannerSheetSectionManager from "./PlannerSheetSectionManager";
import PdfPagePreview from "../export/PdfPagePreview";
import {
  getDefaultSectionConfig,
  exportSettingsToSectionConfig,
  sectionConfigToExportSettings,
  getVisibleFieldKeys,
  SECTION_TYPES,
  getVisibleSections,
} from "../../lib/plannerSheetSections";
import useImagePreloader from "../../hooks/useImagePreloader";
import ExportImageStatus from "../export/ExportImageStatus";

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
  galleryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
});

const fieldOptions = [
  { key: "shotNumber", label: "Shot number" },
  { key: "name", label: "Shot title" },
  { key: "type", label: "Shot type" },
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

const PlannerPdfDocument = React.memo(({ lanes, laneSummary, talentSummary, options }) => {
  const orientation = options.orientation === "landscape" ? "landscape" : "portrait";
  const layout = options.layout === "gallery" ? "gallery" : "table"; // treat non-gallery as table
  const densityId = options.density || "standard";
  const parsedColumns = Number.parseInt(options.galleryColumns, 10);
  const galleryColumns =
    layout === "gallery"
      ? Math.min(6, Math.max(1, Number.isNaN(parsedColumns) ? 3 : parsedColumns))
      : 1;
  const columnWidth = `${(100 / galleryColumns).toFixed(4)}%`;
  const visibleFields = options.fields || {};
  const customLabels = options.customLabels || {};

  // Use sectionStates from options if available (includes flex values), otherwise fallback
  const sectionStates = options.sectionStates || exportSettingsToSectionConfig(visibleFields);

  const showLaneSummary = options.includeLaneSummary && laneSummary?.lanes?.length;
  const showTalentSummary = options.includeTalentSummary && talentSummary?.rows?.length;
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

  const buildNotesContent = (html, keyPrefix, containerStyle) => {
    if (!html) return null;
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!plain) return null;
      return (
        <View
          key={`${keyPrefix}-notes`}
          style={[styles.notesContainer, containerStyle]}
          wrap={false}
        >
          <Text style={styles.notesText}>{plain}</Text>
        </View>
      );
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const content = renderBlockNodes(Array.from(doc.body.childNodes || []), keyPrefix);
    if (!content.length) return null;
    return (
      <View
        key={`${keyPrefix}-notes`}
        style={[styles.notesContainer, containerStyle]}
        wrap={false}
      >
        {content}
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
    const visibleSections = getVisibleSections(sectionStates);
    const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);

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
    const visibleSections = getVisibleSections(sectionStates);
    const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);
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
          return shot.type || '-';

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
          // Simple text rendering for table (strip HTML)
          const notesText = shot.notes
            ? shot.notes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '';
          return notesText || '-';
        }

        default:
          return '-';
      }
    };

    return (
      <View key={shotKey} style={styles.tableDataRow} wrap={false}>
        {showImage && (
          <View style={styles.tableImageCell}>
            {shot?.image ? (
              <Image src={shot.image} style={styles.tableImage} />
            ) : (
              <View style={{ width: 50, height: 50, backgroundColor: '#f1f5f9', borderRadius: 2 }} />
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
    const typeItemBase = visibleFields.type
      ? { key: "type", icon: null, label: "Shot Type", value: shot?.type || null }
      : null;

    const notesContent = visibleFields.notes
      ? buildNotesContent(shot?.notes, `${shotKey}`, isGallery ? styles.galleryNotesContainer : null)
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
        makeItem(typeItemBase, {
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

      return (
        <View key={shotKey} style={cardStyle} wrap={false}>
          <View style={styles.listRow}>
            <View style={leftColumnStyles}>
              {hasImage ? <Image src={shot.image} style={shotImageStyle} /> : null}
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

    const galleryItems = [
      makeItem(locationItemBase, {
        containerStyle: styles.galleryDetailItem,
        labelStyle: styles.galleryDetailLabel,
        valueStyle: styles.galleryDetailValue,
      }),
      makeItem(talentItemBase, {
        containerStyle: styles.galleryDetailItem,
        labelStyle: styles.galleryDetailLabel,
        valueStyle: styles.galleryDetailValue,
      }),
      makeItem(productItemBase, {
        containerStyle: styles.galleryDetailItem,
        labelStyle: styles.galleryDetailLabel,
        valueStyle: styles.galleryDetailValue,
        bulletStyle: styles.galleryDetailBullet,
      }),
      makeItem(dateItemBase, {
        containerStyle: styles.galleryDetailItem,
        labelStyle: styles.galleryDetailLabel,
        valueStyle: styles.galleryDetailValue,
      }),
      makeItem(typeItemBase, {
        containerStyle: styles.galleryDetailItem,
        labelStyle: styles.galleryDetailLabel,
        valueStyle: styles.galleryDetailValue,
      }),
    ].filter(Boolean);

    const titleStyle = [styles.shotTitle, styles.galleryShotTitle];
    const effectiveColumns = layoutConfig?.columns || galleryColumns;
    if (effectiveColumns >= 3) {
      titleStyle.push(styles.galleryShotTitleCompact);
    }

    const galleryLabelStyle = effectiveColumns >= 3 ? styles.galleryDetailLabelCompact : null;
    const galleryValueStyle = effectiveColumns >= 3 ? styles.galleryDetailValueCompact : null;
    const galleryBulletStyle = effectiveColumns >= 3 ? styles.galleryDetailBulletCompact : null;

    const galleryItemsWithSizing = galleryItems.map((item) =>
      makeItem(item, {
        labelStyle: item.labelStyle
          ? [item.labelStyle, galleryLabelStyle].filter(Boolean)
          : galleryLabelStyle,
        valueStyle: item.valueStyle
          ? [item.valueStyle, galleryValueStyle].filter(Boolean)
          : galleryValueStyle,
        bulletStyle: item.bulletStyle
          ? [item.bulletStyle, galleryBulletStyle].filter(Boolean)
          : galleryBulletStyle,
      })
    );

    return (
      <View key={shotKey} style={cardStyle} wrap={false}>
        {hasShotNumber ? (
          <Text style={[styles.shotNumberBadge, styles.galleryShotNumber]}>{shotNumber}</Text>
        ) : null}
        {hasImage ? <Image src={shot.image} style={shotImageStyle} /> : null}
        {shotTitle ? <Text style={titleStyle}>{shotTitle}</Text> : null}
        {galleryItemsWithSizing.length ? (
          <View style={[styles.detailStack, styles.galleryDetailStack]}>
            {galleryItemsWithSizing.map((item, itemIndex) => renderDetailItem(item, itemIndex))}
          </View>
        ) : null}
        {notesContent}
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

  return (
    <Document>
      <Page size="LETTER" orientation={orientation} style={styles.page}>
        <View style={styles.header} wrap={false}>
          {options.title ? <Text style={styles.title}>{options.title}</Text> : null}
          {options.subtitle ? <Text style={styles.subtitle}>{options.subtitle}</Text> : null}
        </View>
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
        {layout === "table" && exportLanes.some(lane => Array.isArray(lane.shots) && lane.shots.length > 0) && (
          renderTableHeaderRow(sectionStates, customLabels)
        )}
        {exportLanes.map((lane, laneIndex) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shotCards = laneShots.map((shot, index) => renderShotCard(shot, lane, index));
          const tableRows = laneShots.map((shot, index) => renderTableRow(shot, lane, index, sectionStates));
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
                <View>{tableRows}</View>
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

  // Resizable divider state
  const [dividerPosition, setDividerPosition] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

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
          .map((shot) => {
            // Debug: Log what image field already exists from buildPlannerExportLanes
            if (shot.image) {
              console.log('[PlannerExportModal] Shot already has image:', shot.image);
            } else {
              const primaryAttachment = getPrimaryAttachment(shot.attachments);
              console.log('[PlannerExportModal] Shot missing image:', {
                shotName: shot.name,
                hasAttachments: !!shot.attachments?.length,
                hasPrimaryAttachment: !!primaryAttachment,
                hasReferenceImagePath: !!shot.referenceImagePath,
                hasImageUrl: !!shot.imageUrl,
              });
            }

            // The image should already be set by buildPlannerExportLanes
            // Just return the shot as-is
            return shot;
          });

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

  const includeImages = Boolean(fields.image);
  const lanesWithImageFallback = useMemo(() => {
    if (!includeImages) return filteredLanes;
    return filteredLanes.map((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      const shots = laneShots.map((shot) => {
        if (shot?.image) return shot;
        if (!fallbackToProductImages) return shot;
        const fallback =
          Array.isArray(shot.productImages) && shot.productImages.length
            ? shot.productImages.find(Boolean)
            : null;
        if (!fallback) return shot;
        return { ...shot, image: fallback };
      });
      return { ...lane, shots };
    });
  }, [filteredLanes, includeImages, fallbackToProductImages]);

  // Image preloading for reliable PDF export
  const {
    isLoading: isPreloadingImages,
    progress: imageProgress,
    isReadyForExport: imagesReadyForExport,
    failedImages,
    retryImage,
    skipImage,
    skipAllFailed,
    retryAllFailed,
    getImageDataMap,
  } = useImagePreloader(
    lanesWithImageFallback,
    includeImages && inlineImages, // Only preload if both images are enabled and we're inlining
    fallbackToProductImages,
    { density, enabled: open } // Only preload when modal is open
  );

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

  // Prepare lanes for preview with preloaded images
  const previewLanes = useMemo(() => {
    const shouldIncludeImages = Boolean(fields.image);
    if (!shouldIncludeImages || !inlineImages) {
      // No images or not inlining - strip images for preview
      return lanesWithImageFallback.map((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        const shots = laneShots.map((shot) => ({ ...shot, image: null }));
        return { ...lane, shots };
      });
    }

    // Use preloaded images
    const imageDataMap = getImageDataMap();
    return lanesWithImageFallback.map((lane) => {
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
  }, [lanesWithImageFallback, fields.image, inlineImages, getImageDataMap]);

  // Debounced preview document to prevent excessive PDF regeneration
  // while user is actively changing settings
  const [debouncedPreviewInputs, setDebouncedPreviewInputs] = useState(null);
  const previewDebounceRef = useRef(null);

  // Debounce the preview inputs (500ms delay) to prevent UI blocking
  // during rapid setting changes - async usePDF hook handles the rest
  useEffect(() => {
    if (!hasShots || !open) {
      setDebouncedPreviewInputs(null);
      return;
    }

    // Clear previous timeout
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    // Set new timeout - 500ms gives user time to finish interactions
    previewDebounceRef.current = setTimeout(() => {
      setDebouncedPreviewInputs({
        lanes: previewLanes,
        laneSummary: derivedLaneSummary,
        talentSummary: derivedTalentSummary,
        options: selectedOptions,
      });
    }, 500);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [hasShots, open, previewLanes, derivedLaneSummary, derivedTalentSummary, selectedOptions]);

  // Create PDF document element for preview using debounced inputs
  const previewDocument = useMemo(() => {
    if (!debouncedPreviewInputs) return null;
    return (
      <PlannerPdfDocument
        lanes={debouncedPreviewInputs.lanes}
        laneSummary={debouncedPreviewInputs.laneSummary}
        talentSummary={debouncedPreviewInputs.talentSummary}
        options={debouncedPreviewInputs.options}
      />
    );
  }, [debouncedPreviewInputs]);

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

  const isLaneSelectionMode = laneFilterMode === "selected";

  const handleDownloadPdf = useCallback(async () => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }
    try {
      setIsGenerating(true);
      const shouldIncludeImages = Boolean(fields.image);
      setGenerationStage("Preparing export…");

      // Use preloaded images if inlining, otherwise fall back to original logic
      let preparedLanes;
      if (shouldIncludeImages && inlineImages) {
        // Use already-preloaded images from the hook
        const imageDataMap = getImageDataMap();
        preparedLanes = lanesWithImageFallback.map((lane) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shots = laneShots.map((shot) => {
            const preparedShot = { ...shot };
            const shotId = shot?.id ? String(shot.id) : null;
            if (shotId && imageDataMap.has(shotId)) {
              preparedShot.image = imageDataMap.get(shotId);
            } else {
              // Image was not successfully loaded or was skipped
              preparedShot.image = null;
            }
            return preparedShot;
          });
          return { ...lane, shots };
        });
      } else if (shouldIncludeImages && !inlineImages) {
        // Pass through URLs for non-inlined images (legacy behavior)
        preparedLanes = lanesWithImageFallback;
      } else {
        // No images - strip them out
        preparedLanes = lanesWithImageFallback.map((lane) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shots = laneShots.map((shot) => ({ ...shot, image: null }));
          return { ...lane, shots };
        });
      }

      setGenerationStage("Rendering PDF…");
      const blob = await pdf(
        <PlannerPdfDocument
          lanes={preparedLanes}
          laneSummary={derivedLaneSummary}
          talentSummary={derivedTalentSummary}
          options={selectedOptions}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `${title || "planner-export"}.pdf`;
      link.download = filename.replace(/\s+/g, "-");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF export saved");
      onClose?.();
    } catch (error) {
      console.error("[Planner] Failed to export PDF", error);
      toast.error("Unable to generate PDF export");
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  }, [
    hasShots,
    lanesWithImageFallback,
    derivedLaneSummary,
    derivedTalentSummary,
    selectedOptions,
    title,
    onClose,
    fields.image,
    inlineImages,
    getImageDataMap,
  ]);

  const handleDownloadCsv = useCallback(() => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }
    const headers = ["Lane"];
    if (fields.shotNumber) headers.push("Shot number");
    if (fields.name) headers.push("Shot title");
    if (fields.type) headers.push("Shot type");
    if (fields.date) headers.push("Date");
    if (fields.location) headers.push("Location");
    if (fields.talent) headers.push("Talent");
    if (fields.products) headers.push("Products");
    if (fields.notes) headers.push("Notes");
    if (fields.image) headers.push("Image");

    const rows = [];
    lanesWithImageFallback.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        const row = [lane.name];
        if (fields.shotNumber) row.push(shot.shotNumber || "");
        if (fields.name) row.push(shot.name || "");
        if (fields.type) row.push(shot.type || "");
        if (fields.date) row.push(shot.date || "");
        if (fields.location) row.push(shot.location || "");
        if (fields.talent) row.push(shot.talent.join(", "));
        if (fields.products) row.push(shot.products.join(", "));
        if (fields.notes) row.push(shot.notes || "");
        if (fields.image) row.push(shot.image || "");
        rows.push(row.map(escapeCsv).join(","));
      });
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `${title || "planner-export"}.csv`;
    link.download = filename.replace(/\s+/g, "-");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV export saved");
    onClose?.();
  }, [fields, hasShots, lanesWithImageFallback, title, onClose]);

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
          {/* Preview Toggle */}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
              ${showPreview
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
              }
            `}
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </span>
          </button>

          <Button onClick={handleDownloadCsv} disabled={!hasShots || isLoading || isGenerating} className="gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
            <FileDown className="w-4 h-4" />
            Export CSV
          </Button>

          <Button
            onClick={handleDownloadPdf}
            disabled={!hasShots || isLoading || isGenerating || !imagesReadyForExport}
            className="gap-2"
            title={!imagesReadyForExport ? "Waiting for images to load" : undefined}
          >
            <FileDown className="w-4 h-4" />
            {isGenerating ? "Exporting..." : isPreloadingImages ? "Loading images..." : "Export PDF"}
          </Button>
        </div>
      </div>

        {/* Main Content Area with Resizable Panels */}
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
          {/* Left Panel - Configuration */}
          <div
            className="flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-800/50"
            style={{ width: showPreview ? `${dividerPosition}%` : '100%' }}
          >
            <div className="p-6 space-y-6">
              {/* Image Loading Status */}
              {includeImages && inlineImages && (
                <ExportImageStatus
                  isLoading={isPreloadingImages}
                  progress={imageProgress}
                  failedImages={failedImages}
                  isReadyForExport={imagesReadyForExport}
                  onRetry={retryImage}
                  onSkip={skipImage}
                  onSkipAll={skipAllFailed}
                  onRetryAll={retryAllFailed}
                  includeImages={includeImages}
                />
              )}

              {/* Document Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Document Settings</h3>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="planner-export-title-input">
                    Page title
                  </label>
                  <input
                    id="planner-export-title-input"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                    placeholder="Planner overview"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="planner-export-subtitle-input">
                    Subtitle
                  </label>
                  <input
                    id="planner-export-subtitle-input"
                    type="text"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                    placeholder="Generated automatically"
                  />
                </div>

                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Page orientation</span>
                  <div className="mt-2 inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    {["portrait", "landscape"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setOrientation(option)}
                        className={`px-3 py-1.5 text-sm capitalize transition ${
                          orientation === option
                            ? "bg-slate-900 dark:bg-slate-700 text-white"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Layout Settings */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Layout</h3>

                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Switch between a table or gallery-style cards for the PDF export.
                  </p>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    {[
                      { value: "gallery", label: "Gallery" },
                      { value: "table", label: "Table" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setLayoutMode(option.value)}
                        className={`px-3 py-1.5 text-sm transition ${
                          layoutMode === option.value
                            ? "bg-slate-900 dark:bg-slate-700 text-white"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {layoutMode === "gallery" && (
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Density
                    </label>
                    <div className="space-y-2">
                      {Object.values(DENSITY_PRESETS).map((preset) => (
                        <label key={preset.id} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="density"
                            value={preset.id}
                            checked={density === preset.id}
                            onChange={() => setDensity(preset.id)}
                            className="mt-0.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                              {preset.label}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {preset.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Image handling */}
              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Image handling
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={fallbackToProductImages}
                    onChange={(event) => setFallbackToProductImages(event.target.checked)}
                    className="mt-1 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                  />
                  <span>Use product images when shot image is missing</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={inlineImages}
                    onChange={(event) => setInlineImages(event.target.checked)}
                    className="mt-1 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                  />
                  <span>Inline images for PDF (slower, avoid external fetch issues)</span>
                </label>
              </div>

              {/* Include Sections */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Include sections</h3>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeLaneSummary}
                      onChange={(event) => setIncludeLaneSummary(event.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    />
                    Lane summary
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeTalentSummary}
                      onChange={(event) => setIncludeTalentSummary(event.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    />
                    Talent summary
                  </label>
                </div>
              </div>

              {/* Filter Shots */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filter shots</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose which lanes, talent, and dates to include in your export.
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
                            Select all lanes
                          </button>
                          <span aria-hidden="true">•</span>
                          <span>{selectedLaneIds.length} selected</span>
                        </div>
                      )}
                      {laneOptions.length === 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No lanes available.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Talent Filter */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Talent</span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Leave blank to include every talent. Select one or more names to limit the export.
                  </p>
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
                      Clear talent filters
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
                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                      />
                      {availableDates.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Available dates: {availableDates.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section Manager */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <PlannerSheetSectionManager
                  sectionStates={sectionStates}
                  onSectionStatesChange={setSectionStates}
                />
              </div>

              {/* Custom Header Labels (Table Mode Only) */}
              {layoutMode === 'table' && (
                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Custom Header Labels
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                    Customize column header text to make labels fit better in the PDF table.
                  </p>
                  <div className="space-y-2">
                    {getVisibleSections(sectionStates).map(section => (
                      <div key={section.id} className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 dark:text-slate-400 w-24 flex-shrink-0">
                          {section.label}:
                        </label>
                        <input
                          type="text"
                          placeholder={section.label}
                          value={customLabels[section.id] || ''}
                          onChange={(e) => setCustomLabels(prev => ({
                            ...prev,
                            [section.id]: e.target.value
                          }))}
                          className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                        />
                        {customLabels[section.id] && (
                          <button
                            onClick={() => setCustomLabels(prev => {
                              const updated = { ...prev };
                              delete updated[section.id];
                              return updated;
                            })}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resizable Divider */}
          {showPreview && (
            <div
              className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize relative flex items-center justify-center transition-colors group"
              onMouseDown={() => setIsDragging(true)}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            </div>
          )}

          {/* Right Panel - Live PDF Preview */}
          {showPreview && (
            <div
              className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900"
              style={{ width: `${100 - dividerPosition}%` }}
            >
              <PdfPagePreview
                document={previewDocument}
                status={previewDocument ? 'ready' : 'generating'}
              />
            </div>
          )}
        </div>
      </div>
  );
};

export { prepareLanesForPdf };
export default PlannerExportModal;
