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

export default ProjectPDF;

