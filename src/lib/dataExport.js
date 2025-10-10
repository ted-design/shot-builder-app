// src/lib/dataExport.js
//
// Generic utility functions for exporting data to CSV and Excel formats

import * as XLSX from 'xlsx';

/**
 * Format timestamp for export
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  if (typeof timestamp === 'number') return new Date(timestamp).toLocaleDateString();
  if (timestamp instanceof Date) return timestamp.toLocaleDateString();
  if (typeof timestamp.toMillis === 'function') return new Date(timestamp.toMillis()).toLocaleDateString();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
  return '';
};

/**
 * Format array values for export
 */
const formatArray = (arr, field = 'name') => {
  if (!Array.isArray(arr)) return '';
  return arr.map(item => typeof item === 'string' ? item : (item[field] || '')).join(', ');
};

/**
 * Export configurations for different entity types
 */
const EXPORT_CONFIGS = {
  shots: {
    columns: [
      { key: 'name', label: 'Shot Name', format: (val) => val || '' },
      { key: 'type', label: 'Type', format: (val) => val || '' },
      { key: 'description', label: 'Description', format: (val) => val || '' },
      { key: 'location', label: 'Location', format: (val) => val?.name || val || '' },
      { key: 'talent', label: 'Talent', format: (val) => formatArray(val, 'name') },
      { key: 'products', label: 'Products', format: (val) => formatArray(val, 'name') },
      { key: 'tags', label: 'Tags', format: (val) => formatArray(val, 'label') },
      { key: 'date', label: 'Date', format: (val) => formatTimestamp(val) },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'shots'
  },
  products: {
    columns: [
      { key: 'name', label: 'Product Name', format: (val) => val || '' },
      { key: 'styleNumber', label: 'Style Number', format: (val) => val || '' },
      { key: 'category', label: 'Category', format: (val) => val || '' },
      { key: 'gender', label: 'Gender', format: (val) => val || '' },
      { key: 'sizes', label: 'Sizes', format: (val) => formatArray(val) },
      { key: 'colors', label: 'Colors', format: (val) => formatArray(val, 'name') },
      { key: 'description', label: 'Description', format: (val) => val || '' },
      { key: 'price', label: 'Price', format: (val) => val ? `$${val}` : '' },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'products'
  },
  talent: {
    columns: [
      { key: 'name', label: 'Name', format: (val) => val || '' },
      { key: 'gender', label: 'Gender', format: (val) => val || '' },
      { key: 'agency', label: 'Agency', format: (val) => val || '' },
      { key: 'email', label: 'Email', format: (val) => val || '' },
      { key: 'phone', label: 'Phone', format: (val) => val || '' },
      { key: 'measurements', label: 'Measurements', format: (val) => val || '' },
      { key: 'notes', label: 'Notes', format: (val) => val || '' },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'talent'
  },
  locations: {
    columns: [
      { key: 'name', label: 'Location Name', format: (val) => val || '' },
      { key: 'address', label: 'Address', format: (val) => val || '' },
      { key: 'city', label: 'City', format: (val) => val || '' },
      { key: 'state', label: 'State', format: (val) => val || '' },
      { key: 'zipCode', label: 'Zip Code', format: (val) => val || '' },
      { key: 'country', label: 'Country', format: (val) => val || '' },
      { key: 'type', label: 'Type', format: (val) => val || '' },
      { key: 'notes', label: 'Notes', format: (val) => val || '' },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'locations'
  },
  projects: {
    columns: [
      { key: 'name', label: 'Project Name', format: (val) => val || '' },
      { key: 'description', label: 'Description', format: (val) => val || '' },
      { key: 'status', label: 'Status', format: (val) => val || '' },
      { key: 'shootDates', label: 'Shoot Dates', format: (val) => formatArray(val) },
      { key: 'createdBy', label: 'Created By', format: (val) => val || '' },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'projects'
  }
};

/**
 * Convert data to CSV format
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity (shots, products, talent, locations, projects)
 * @param {Array} selectedColumns - Optional: specific columns to export
 * @returns {string} CSV content
 */
export const exportToCSV = (data, entityType, selectedColumns = null) => {
  const config = EXPORT_CONFIGS[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const columns = selectedColumns || config.columns;

  // CSV Headers
  const headers = columns.map(col => col.label);
  const rows = [headers];

  // Data rows
  data.forEach((item) => {
    const row = columns.map((col) => {
      const value = item[col.key];
      const formatted = col.format ? col.format(value) : value;
      return String(formatted || '');
    });
    rows.push(row);
  });

  // Convert to CSV string
  return rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * Convert data to Excel workbook
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity
 * @param {Array} selectedColumns - Optional: specific columns to export
 * @returns {XLSX.WorkBook} Excel workbook
 */
export const exportToExcel = (data, entityType, selectedColumns = null) => {
  const config = EXPORT_CONFIGS[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const columns = selectedColumns || config.columns;

  // Prepare data for Excel
  const excelData = [
    columns.map(col => col.label) // Headers
  ];

  data.forEach((item) => {
    const row = columns.map((col) => {
      const value = item[col.key];
      const formatted = col.format ? col.format(value) : value;
      return formatted || '';
    });
    excelData.push(row);
  });

  // Create workbook and worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Auto-size columns
  const columnWidths = columns.map((col, i) => {
    const maxLength = Math.max(
      col.label.length,
      ...data.map(item => {
        const val = item[col.key];
        const formatted = col.format ? col.format(val) : val;
        return String(formatted || '').length;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) }; // Max width 50 chars
  });
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, entityType.charAt(0).toUpperCase() + entityType.slice(1));

  return workbook;
};

/**
 * Download CSV file
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity
 * @param {Object} options - Export options
 */
export const downloadCSV = (data, entityType, options = {}) => {
  const { selectedColumns, filename } = options;
  const config = EXPORT_CONFIGS[entityType];

  const csvContent = exportToCSV(data, entityType, selectedColumns);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || config.filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download Excel file
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity
 * @param {Object} options - Export options
 */
export const downloadExcel = (data, entityType, options = {}) => {
  const { selectedColumns, filename } = options;
  const config = EXPORT_CONFIGS[entityType];

  const workbook = exportToExcel(data, entityType, selectedColumns);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || config.filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Get available columns for entity type
 * @param {string} entityType - Type of entity
 * @returns {Array} Available columns
 */
export const getExportColumns = (entityType) => {
  const config = EXPORT_CONFIGS[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  return config.columns;
};

/**
 * Generate Google Sheets export URL
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity
 * @param {Array} selectedColumns - Optional: specific columns to export
 * @returns {string} Google Sheets import URL
 */
export const generateGoogleSheetsURL = (data, entityType, selectedColumns = null) => {
  const csvContent = exportToCSV(data, entityType, selectedColumns);
  const encodedData = encodeURIComponent(csvContent);

  // Note: This creates a URL that can be used with Google Sheets import functionality
  // Users would need to manually import this into a new sheet
  return `data:text/csv;charset=utf-8,${encodedData}`;
};
