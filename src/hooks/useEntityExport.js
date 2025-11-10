/**
 * useEntityExport - Shared hook for exporting entity data to CSV/PDF
 *
 * Consolidates export logic across all entity types (shots, products, talent, etc.)
 * Provides consistent export functionality with customizable column definitions.
 *
 * @example
 * const { exportToCSV, exportToPDF, isExporting } = useEntityExport('shots', shots, shotColumns);
 */

import { useState, useCallback } from 'react';
import { toast } from '../lib/toast';

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data, columns) {
  if (!data || data.length === 0) {
    return '';
  }

  // Header row
  const headers = columns.map(col => col.label || col.key).join(',');

  // Data rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value = '';

      // Handle accessor function or direct key
      if (typeof col.accessor === 'function') {
        value = col.accessor(item);
      } else if (col.key) {
        value = item[col.key];
      }

      // Format value for CSV (handle commas, quotes, newlines)
      if (value === null || value === undefined) {
        return '';
      }

      const stringValue = String(value);

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Trigger browser download of file
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Hook for exporting entity data
 *
 * @param {string} entityType - Type of entity (shots, products, talent, etc.)
 * @param {Array} data - Array of entity objects to export
 * @param {Array} columns - Column definitions with { key, label, accessor? }
 * @returns {Object} Export functions and state
 */
export function useEntityExport(entityType, data, columns) {
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Export data to CSV file
   */
  const exportToCSV = useCallback(async (selectedItems = null) => {
    setIsExporting(true);

    try {
      const itemsToExport = selectedItems || data;

      if (!itemsToExport || itemsToExport.length === 0) {
        toast.warning({
          title: 'No data to export',
          description: 'There are no items to export.',
        });
        return;
      }

      const csv = arrayToCSV(itemsToExport, columns);
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${entityType}-${timestamp}.csv`;

      downloadFile(csv, filename, 'text/csv;charset=utf-8;');

      toast.success({
        title: 'Export successful',
        description: `Exported ${itemsToExport.length} ${entityType} to CSV`,
      });
    } catch (error) {
      console.error('[useEntityExport] CSV export failed:', error);
      toast.error({
        title: 'Export failed',
        description: 'Unable to export data. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [data, columns, entityType]);

  /**
   * Export data to PDF (basic implementation)
   * For more advanced PDF features, consider using jsPDF or pdfmake
   */
  const exportToPDF = useCallback(async (selectedItems = null) => {
    setIsExporting(true);

    try {
      const itemsToExport = selectedItems || data;

      if (!itemsToExport || itemsToExport.length === 0) {
        toast.warning({
          title: 'No data to export',
          description: 'There are no items to export.',
        });
        return;
      }

      // For now, export as formatted text (can be enhanced with jsPDF later)
      const headers = columns.map(col => col.label || col.key).join('\t');
      const rows = itemsToExport.map(item => {
        return columns.map(col => {
          let value = '';
          if (typeof col.accessor === 'function') {
            value = col.accessor(item);
          } else if (col.key) {
            value = item[col.key];
          }
          return value || '';
        }).join('\t');
      });

      const content = [headers, ...rows].join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${entityType}-${timestamp}.txt`;

      downloadFile(content, filename, 'text/plain;charset=utf-8;');

      toast.success({
        title: 'Export successful',
        description: `Exported ${itemsToExport.length} ${entityType} to text file`,
      });
    } catch (error) {
      console.error('[useEntityExport] PDF export failed:', error);
      toast.error({
        title: 'Export failed',
        description: 'Unable to export data. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [data, columns, entityType]);

  return {
    exportToCSV,
    exportToPDF,
    isExporting,
  };
}
