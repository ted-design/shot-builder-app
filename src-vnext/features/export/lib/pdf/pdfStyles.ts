import { StyleSheet } from "@react-pdf/renderer"

/** Page size dimensions in points */
export const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  pageFooter: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  // Table styles
  tableContainer: {
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    borderRadius: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  tableRowStriped: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  tableCell: {
    fontSize: 8,
    color: "#374151",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableCellMuted: {
    fontSize: 8,
    color: "#9CA3AF",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  // Text styles
  heading: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  subheading: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.4,
  },
  // Status badges
  badge: {
    fontSize: 7,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  // Divider
  dividerSolid: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
    marginVertical: 8,
  },
  dividerDashed: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
    borderBottomStyle: "dashed",
    marginVertical: 8,
  },
  // Section header (for crew groups)
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 10,
  },
})

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  todo: { bg: "#F3F4F6", text: "#374151" },
  in_progress: { bg: "#DBEAFE", text: "#1D4ED8" },
  on_hold: { bg: "#FEF3C7", text: "#B45309" },
  complete: { bg: "#D1FAE5", text: "#047857" },
}

export const STATUS_LABELS: Record<string, string> = {
  todo: "Draft",
  in_progress: "In Progress",
  on_hold: "On Hold",
  complete: "Shot",
}
