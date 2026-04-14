// src/components/common/ExportButton.jsx
//
// Reusable export button with modal for CSV/Excel export

import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, FileText, CheckSquare, Square } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { downloadCSV, downloadExcel, getExportColumns } from '../../lib/dataExport';
import { toast } from '../../lib/toast';

export default function ExportButton({ data, entityType, buttonVariant = "secondary", buttonSize = "sm" }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [format, setFormat] = useState('csv'); // Only CSV supported (Excel temporarily disabled)
  const [exporting, setExporting] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(new Set());

  const availableColumns = useMemo(() => getExportColumns(entityType), [entityType]);

  // Initialize all columns as selected when modal opens
  const handleOpenModal = () => {
    setSelectedColumnKeys(new Set(availableColumns.map(col => col.key)));
    setModalOpen(true);
  };

  const toggleColumn = (columnKey) => {
    setSelectedColumnKeys(prev => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const toggleAllColumns = () => {
    if (selectedColumnKeys.size === availableColumns.length) {
      setSelectedColumnKeys(new Set());
    } else {
      setSelectedColumnKeys(new Set(availableColumns.map(col => col.key)));
    }
  };

  const handleExport = async () => {
    if (selectedColumnKeys.size === 0) {
      toast.error({ title: 'Please select at least one column to export' });
      return;
    }

    setExporting(true);

    try {
      const selectedColumns = availableColumns.filter(col => selectedColumnKeys.has(col.key));
      const options = {
        selectedColumns,
        filename: customFilename.trim() || undefined,
      };

      if (format === 'csv') {
        downloadCSV(data, entityType, options);
        toast.success({ title: 'CSV exported successfully' });
      } else {
        downloadExcel(data, entityType, options);
        toast.success({ title: 'Excel file exported successfully' });
      }

      setModalOpen(false);
      setCustomFilename('');
    } catch (error) {
      console.error('[ExportButton] Export failed', error);
      toast.error({ title: 'Export failed', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  if (!data || data.length === 0) {
    return (
      <Button
        variant={buttonVariant}
        size={buttonSize}
        disabled
        title="No data to export"
        className="flex items-center gap-1.5"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpenModal}
        className="flex items-center gap-1.5"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </Button>

      {modalOpen && (
        <Modal open onClose={() => setModalOpen(false)} labelledBy="export-modal-title" contentClassName="max-w-2xl">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <h2 id="export-modal-title" className="text-lg font-semibold">
                Export {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
              </h2>
              <p className="text-sm text-slate-600">
                Export {data.length} {data.length === 1 ? 'item' : 'items'} to CSV or Excel format
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format Selection - Excel temporarily disabled due to security vulnerability */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Export Format</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    className="flex-1 rounded-card border-2 border-primary bg-primary/5 p-4 text-center text-primary"
                  >
                    <FileText className="mx-auto mb-2 h-8 w-8" />
                    <div className="text-sm font-semibold">CSV</div>
                    <div className="text-xs text-slate-600">Universal spreadsheet format</div>
                  </button>
                  <div
                    className="flex-1 rounded-card border-2 border-slate-200 bg-slate-50 p-4 text-center opacity-50"
                    title="Excel export temporarily disabled due to security vulnerability"
                  >
                    <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <div className="text-sm font-semibold text-slate-400">Excel</div>
                    <div className="text-xs text-slate-500">Temporarily unavailable</div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Note: Excel export temporarily disabled for security reasons. CSV works with Excel, Google Sheets, and all spreadsheet apps.
                </p>
              </div>

              {/* Custom Filename */}
              <div className="space-y-2">
                <label htmlFor="custom-filename" className="text-sm font-medium text-slate-700">
                  Custom Filename (optional)
                </label>
                <Input
                  id="custom-filename"
                  placeholder={`e.g., ${entityType}_export`}
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Leave empty to use default filename with date
                </p>
              </div>

              {/* Column Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Select Columns</span>
                  <Button variant="ghost" size="sm" onClick={toggleAllColumns}>
                    {selectedColumnKeys.size === availableColumns.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto rounded-card border border-slate-200 p-3">
                  {availableColumns.map((column) => {
                    const isSelected = selectedColumnKeys.has(column.key);
                    return (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleColumn(column.key)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium text-slate-900">
                          {column.label}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <p className="text-xs text-slate-500">
                  {selectedColumnKeys.size} of {availableColumns.length} columns selected
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={exporting}>
                  Cancel
                </Button>
                <Button onClick={handleExport} disabled={exporting || selectedColumnKeys.size === 0}>
                  {exporting ? (
                    'Exporting...'
                  ) : (
                    `Export ${format.toUpperCase()} (${selectedColumnKeys.size} columns)`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Modal>
      )}
    </>
  );
}
