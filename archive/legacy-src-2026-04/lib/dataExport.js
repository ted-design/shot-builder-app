// src/lib/dataExport.js
//
// Generic utility functions for exporting data to CSV format
//
// NOTE: Excel export temporarily removed due to xlsx security vulnerability (HIGH severity)
// See docs/SECURITY_AUDIT_2025-01-11.md for details
// Can be re-added with exceljs library if needed

/**
 * Sanitize cell value to prevent CSV/Excel injection
 * Prefixes values starting with =, +, -, @ with a single quote
 */
const sanitizeCellValue = (value) => {
  if (!value) return '';
  const str = String(value);
  const firstChar = str.charAt(0);

  // Prevent formula injection by prefixing dangerous characters
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    return `'${str}`;
  }

  return str;
};

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
      { key: 'styleName', label: 'Style Name', format: (val) => val || '' },
      { key: 'styleNumber', label: 'Style Number', format: (val) => val || '' },
      { key: 'previousStyleNumber', label: 'Previous Style Number', format: (val) => val || '' },
      { key: 'gender', label: 'Gender', format: (val) => val || '' },
      { key: 'status', label: 'Status', format: (val) => val || '' },
      { key: 'sizeOptions', label: 'Sizes', format: (val) => formatArray(val) },
      { key: 'colorNames', label: 'Colors', format: (val) => formatArray(val) },
      { key: 'skuCount', label: 'SKU Count', format: (val) => val || 0 },
      { key: 'activeSkuCount', label: 'Active SKUs', format: (val) => val || 0 },
      { key: 'notes', label: 'Notes', format: (val) => val || '' },
      { key: 'archived', label: 'Archived', format: (val) => val ? 'Yes' : 'No' },
      { key: 'createdAt', label: 'Created', format: (val) => formatTimestamp(val) },
      { key: 'updatedAt', label: 'Updated', format: (val) => formatTimestamp(val) },
    ],
    filename: 'product-families'
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
      const sanitized = sanitizeCellValue(formatted || '');
      return sanitized;
    });
    rows.push(row);
  });

  // Convert to CSV string with proper escaping
  return rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * Convert data to Excel workbook
 * @deprecated Excel export removed due to xlsx security vulnerability
 * @throws {Error} Always throws - Excel export is disabled
 */
export const exportToExcel = () => {
  throw new Error('Excel export temporarily disabled due to security vulnerability. Please use CSV export instead.');
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
 * @deprecated Excel export removed due to xlsx security vulnerability
 * @throws {Error} Always throws - Excel export is disabled
 */
export const downloadExcel = () => {
  throw new Error('Excel export temporarily disabled due to security vulnerability. Please use CSV export instead.');
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
