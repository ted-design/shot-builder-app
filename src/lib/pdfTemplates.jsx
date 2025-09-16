import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
  const items = Array.isArray(pull.items) ? pull.items : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{pull.title || "Pull Sheet"}</Text>
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
        <Text style={styles.subheader}>Line Items</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" }]}>
            <Text style={styles.cellHeader}>Item</Text>
            <Text style={styles.cellHeader}>Quantity</Text>
            <Text style={styles.cellHeader}>Notes</Text>
          </View>
          {items.length === 0 && (
            <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" }]}>
              <Text style={styles.cell}>No items</Text>
              <Text style={styles.cell}>-</Text>
              <Text style={styles.cell}>-</Text>
            </View>
          )}
          {items.map((item) => (
            <View
              key={item.id || item.name}
              style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: "#ccc", borderStyle: "solid" }]}
            >
              <Text style={styles.cell}>{item.name}</Text>
              <Text style={styles.cell}>{item.quantity}</Text>
              <Text style={styles.cell}>{item.notes || ""}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export default ProjectPDF;
