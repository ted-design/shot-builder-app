import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { normalizePullItem, getPullItemDisplayName, getTotalQuantity } from "./pullItems";

// Basic styles for a simple demo PDF
const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 12, fontFamily: "Helvetica" },
  header: { fontSize: 18, marginBottom: 8 },
  subheader: { fontSize: 14, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontWeight: 700 },
  listItem: { marginBottom: 2 },
  hr: { marginVertical: 8, height: 1, backgroundColor: "#ccc" },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#ccc", borderStyle: "solid" },
  tableRow: { flexDirection: "row" },
  cell: { flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: "#ccc", borderStyle: "solid" },
  cellHeader: {
    flex: 1,
    padding: 6,
    backgroundColor: "#f5f5f5",
    borderRightWidth: 1,
    borderRightColor: "#ccc",
    borderStyle: "solid",
    fontWeight: 700,
  },
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

  // Normalize all items
  const normalizeGroup = (group) => ({
    ...group,
    items: (group.items || []).map((item) => normalizePullItem(item)),
  });

  const groups = groupedItems.map(normalizeGroup);

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* Custom Header */}
        {headerText && <Text style={[styles.header, { fontSize: 20 }]}>{headerText}</Text>}

        {/* Title */}
        <Text style={styles.header}>{pull.title || "Pull Sheet"}</Text>

        {/* Custom Subheader */}
        {subheaderText && <Text style={styles.subheader}>{subheaderText}</Text>}

        {/* Metadata */}
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Status: </Text>
            {status}
          </Text>
          {createdAt && (
            <Text>
              <Text style={styles.label}>Created: </Text>
              {createdAt}
            </Text>
          )}
        </View>

        <View style={styles.hr} />

        {/* Render groups */}
        {groups.map((group, groupIndex) => (
          <View key={groupIndex} wrap={false} style={{ marginBottom: 12 }}>
            {group.title && (
              <Text style={[styles.subheader, { marginTop: groupIndex > 0 ? 12 : 0 }]}>
                {group.title}
              </Text>
            )}

            <View style={styles.table}>
              {/* Table Header */}
              {groupIndex === 0 && (
                <View
                  style={[
                    styles.tableRow,
                    { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" },
                  ]}
                >
                  <Text style={[styles.cellHeader, { flex: 2 }]}>Product</Text>
                  <Text style={styles.cellHeader}>Size</Text>
                  <Text style={styles.cellHeader}>Qty</Text>
                  <Text style={[styles.cellHeader, { flex: 1.5 }]}>Notes</Text>
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
                const displayName = getPullItemDisplayName(item);
                const sizes = item.sizes || [];

                // If item has multiple sizes, create a row for each size
                if (sizes.length > 1) {
                  return sizes.map((size, sizeIndex) => (
                    <View
                      key={`${item.id}-${sizeIndex}`}
                      style={[
                        styles.tableRow,
                        { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" },
                      ]}
                    >
                      <Text style={[styles.cell, { flex: 2 }]}>
                        {sizeIndex === 0 ? displayName : ""}
                      </Text>
                      <Text style={styles.cell}>{size.size}</Text>
                      <Text style={styles.cell}>{size.quantity}</Text>
                      <Text style={[styles.cell, { flex: 1.5 }]}>
                        {sizeIndex === 0 ? item.notes || "" : ""}
                      </Text>
                    </View>
                  ));
                }

                // Single size or no sizes
                const size = sizes[0] || { size: "One Size", quantity: 1 };
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" },
                    ]}
                  >
                    <Text style={[styles.cell, { flex: 2 }]}>{displayName}</Text>
                    <Text style={styles.cell}>{size.size}</Text>
                    <Text style={styles.cell}>{size.quantity}</Text>
                    <Text style={[styles.cell, { flex: 1.5 }]}>{item.notes || ""}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export default ProjectPDF;
