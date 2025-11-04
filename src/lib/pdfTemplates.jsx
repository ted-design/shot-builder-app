import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { normalizePullItem, getPullItemDisplayName, getTotalQuantity } from "./pullItems";

// Basic styles for a simple demo PDF
const styles = StyleSheet.create({
  page: { paddingTop: 164, paddingLeft: 24, paddingRight: 24, paddingBottom: 24, fontSize: 11, fontFamily: "Helvetica" },
  header: { fontSize: 18, marginBottom: 8 },
  subheader: { fontSize: 14, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  metaLeft: { flex: 1, paddingRight: 8 },
  metaRight: { flex: 1, paddingLeft: 8 },
  metaRightText: { textAlign: "right" },
  label: { fontWeight: 700 },
  listItem: { marginBottom: 2 },
  hr: { marginVertical: 8, height: 1, backgroundColor: "#ddd" },
  pageHeader: { position: "absolute", left: 24, right: 24, top: 24 },
  pageHeaderTitle: { fontSize: 20, marginBottom: 4 },
  pageHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#ddd", borderStyle: "solid" },
  tableRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 6,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    borderStyle: "solid",
  },
  cellHeader: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 6,
    paddingRight: 6,
    backgroundColor: "#f5f5f5",
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    borderStyle: "solid",
    fontWeight: 700,
  },
  text: { lineHeight: 1.25 },
  imageCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  imageThumb: {
    width: 28,
    height: 28,
    objectFit: "cover",
  },
  cellText: { lineHeight: 1.35 },
});

// Mock data used for the demo only
export const mockProject = {
  name: "Demo Project",
  client: "Acme Co.",
  date: "2025-01-01",
  shots: [
    { id: "S-001", title: "Opening Shot", location: "Studio A", talent: "Jamie" },
    { id: "S-002", title: "Product Closeup", location: "Studio B", talent: "Alex" },
    { id: "S-003", title: "Lifestyle Scene", location: "City Park", talent: "Riley" },
  ],
};

export function ProjectPDF({ project = mockProject }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{project.name}</Text>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Client: </Text>
            {project.client}
          </Text>
          <Text>
            <Text style={styles.label}>Date: </Text>
            {project.date}
          </Text>
        </View>

        <View style={styles.hr} />

        <Text style={styles.subheader}>Shots</Text>
        {project.shots.map((s) => (
          <View key={s.id} style={styles.listItem}>
            <Text>
              {s.id} — {s.title} ({s.location}) · Talent: {s.talent}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function PullPDF({ pull }) {
  let createdAt = "";
  if (pull.createdAt) {
    let date;
    if (pull.createdAt?.seconds) date = new Date(pull.createdAt.seconds * 1000);
    else if (typeof pull.createdAt?.toDate === "function") date = pull.createdAt.toDate();
    else if (typeof pull.createdAt === "number") date = new Date(pull.createdAt);
    if (date && !Number.isNaN(date.getTime())) createdAt = date.toLocaleString();
  }

  const status = (pull.status || "draft").toUpperCase();
  const settings = pull.settings || {};
  const orientation = settings.orientation || "portrait";
  const headerText = settings.headerText || "";
  const subheaderText = settings.subheaderText || "";
  const groupedItems = pull.groupedItems || [{ title: null, items: pull.items || [] }];
  const columnFlags = (pull.settings && pull.settings.columns) || {
    product: true,
    styleNumber: true,
    colour: true,
    gender: true,
    size: true,
    quantity: true,
    fulfilled: true,
    notes: true,
  };
  const includeImages = !!(pull.settings && pull.settings.includeImages);

  const colFlexOverrides = pull.settings?.columnFlex || {};
  let columns = [
    includeImages && { key: "image", label: "Image", flex: 0.7 },
    columnFlags.product && { key: "product", label: "Product", flex: 2 },
    columnFlags.styleNumber && { key: "styleNumber", label: "Style #", flex: 1 },
    columnFlags.colour && { key: "colour", label: "Colour", flex: 1 },
    columnFlags.gender && { key: "gender", label: "Gender", flex: 0.8 },
    columnFlags.size && { key: "size", label: "Size", flex: 0.7 },
    columnFlags.quantity && { key: "quantity", label: "Qty Req.", flex: 0.7 },
    columnFlags.fulfilled && { key: "fulfilled", label: "Qty Fulfilled", flex: 0.9 },
    columnFlags.notes && { key: "notes", label: "Notes", flex: 1.5 },
  ].filter(Boolean);
  columns = columns.map((c) => ({ ...c, flex: colFlexOverrides[c.key] || c.flex }));
  // Truncation helpers for single-line cells (approximate ellipsis)
  const CHAR_BUDGET_PER_FLEX = 12;
  const ellipsize = (text, limit) => {
    const s = String(text ?? "");
    if (s.length <= limit) return s;
    return s.slice(0, Math.max(0, limit - 1)) + "…";
  };
  const truncateByFlex = (text, key, flex) => {
    if (key === "quantity" || key === "fulfilled") return String(text ?? "");
    const limit = Math.max(6, Math.floor((flex || 1) * CHAR_BUDGET_PER_FLEX));
    return ellipsize(text, limit);
  };
  if (!columns.length) {
    columns = [
      { key: "product", label: "Product", flex: 2 },
      { key: "size", label: "Size", flex: 0.7 },
      { key: "quantity", label: "Qty Req.", flex: 0.7 },
    ];
  }

  // Normalize all items
  const normalizeGroup = (group) => ({
    ...group,
    items: (group.items || []).map((item) => normalizePullItem(item)),
  });

  const groups = groupedItems.map(normalizeGroup);
  const repeatHeaderEachPage = pull.settings?.repeatHeaderEachPage !== false;
  const groupHeaderEachSection = pull.settings?.groupHeaderEachSection === true;

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* Page Header (fixed across pages) */}
        <View fixed style={styles.pageHeader}>
          {headerText ? (
            <Text style={styles.pageHeaderTitle}>{headerText}</Text>
          ) : null}
          <Text style={styles.header}>{pull.title || "Pull Sheet"}</Text>
          {subheaderText ? <Text style={styles.subheader}>{subheaderText}</Text> : null}
          <View style={styles.pageHeaderRow}>
            <Text wrap={false}>
              <Text style={styles.label}>Status: </Text>
              {status}
            </Text>
            {createdAt && (
              <Text style={styles.metaRightText} wrap={false}>
                <Text style={styles.label}>Created: </Text>
                {createdAt}
              </Text>
            )}
          </View>
          <View style={styles.hr} />
          {/* Column Header repeated on each page */}
          {repeatHeaderEachPage && (
            <View
              style={[
                styles.tableRow,
                { borderWidth: 1, borderColor: "#ddd", borderStyle: "solid" },
              ]}
            >
              {columns.map((col, i) => (
                <View
                  key={col.key}
                  style={[
                    styles.cellHeader,
                    { flex: col.flex },
                    i === columns.length - 1 && { borderRightWidth: 0 },
                  ]}
                >
                  <Text style={styles.text} wrap={false}>{col.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Render groups */}
        {groups.map((group, groupIndex) => (
          <View key={groupIndex} style={{ marginBottom: 12 }}>
            {group.title && (
              <Text style={[styles.subheader, { marginTop: groupIndex > 0 ? 12 : 0 }]}>
                {group.title}
              </Text>
            )}

            <View style={styles.table}>
              {/* Optional header under group title */}
              {groupHeaderEachSection && (
                <View
                  style={[
                    styles.tableRow,
                    { borderBottomWidth: 1, borderBottomColor: "#ddd", borderStyle: "solid" },
                  ]}
                >
                  {columns.map((col, i) => (
                    <View
                      key={col.key}
                      style={[
                        styles.cellHeader,
                        { flex: col.flex },
                        i === columns.length - 1 && { borderRightWidth: 0 },
                      ]}
                    >
                      <Text style={styles.text} wrap={false}>{col.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Items */}
              {group.items.length === 0 && (
                <View
                  style={[
                    styles.tableRow,
                    { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" },
                  ]}
                >
                  <Text style={styles.cell}>No items</Text>
                  <Text style={styles.cell}>-</Text>
                  <Text style={styles.cell}>-</Text>
                  <Text style={styles.cell}>-</Text>
                </View>
              )}

              {group.items.map((item) => {
                const productName = item.familyName || "";
                const sizes = item.sizes && item.sizes.length ? item.sizes : [{ size: "One Size", quantity: 1, fulfilled: 0 }];
                return sizes.map((size, sizeIndex) => (
                  <View
                    key={`${item.id}-${sizeIndex}`}
                    style={[
                      styles.tableRow,
                      { borderBottomWidth: 1, borderBottomColor: "#ddd", borderStyle: "solid" },
                    ]}
                  >
                    {columns.map((col, i) => {
                      let value = "";
                      switch (col.key) {
                        case "image":
                          value = sizeIndex === 0 ? (item.colourImagePath || "") : "";
                          break;
                        case "product":
                          value = sizeIndex === 0 ? productName : "";
                          break;
                        case "styleNumber":
                          value = sizeIndex === 0 ? (item.styleNumber || "") : "";
                          break;
                        case "colour":
                          value = sizeIndex === 0 ? (item.colourName || "") : "";
                          break;
                        case "gender":
                          value = sizeIndex === 0 ? (item.gender || "") : "";
                          break;
                        case "size":
                          value = size.size;
                          break;
                        case "quantity":
                          value = String(size.quantity ?? "");
                          break;
                        case "fulfilled":
                          value = String(size.fulfilled ?? 0);
                          break;
                        case "notes":
                          value = sizeIndex === 0 ? (item.notes || "") : "";
                          break;
                        default:
                          value = "";
                      }
                      if (col.key === "image") {
                        return (
                          <View
                            key={col.key}
                            style={[
                              styles.cell,
                              styles.imageCell,
                              { flex: col.flex },
                              i === columns.length - 1 && { borderRightWidth: 0 },
                            ]}
                          >
                            {value ? <Image src={value} style={styles.imageThumb} /> : null}
                          </View>
                        );
                      }
                      const isNotes = col.key === "notes";
                      const maxLines = 1;
                      return (
                        <View
                          key={col.key}
                          style={[
                            styles.cell,
                            { flex: col.flex },
                            i === columns.length - 1 && { borderRightWidth: 0 },
                          ]}
                        >
                          <Text style={[styles.text, styles.cellText]} wrap={false} maxLines={maxLines}>
                            {truncateByFlex(value, col.key, col.flex)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ));
              })}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export default ProjectPDF;
