import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  FileText,
  Download,
  Settings,
  X,
  Eye,
  CheckCircle2,
  Circle
} from 'lucide-react'
import { cn } from '../lib/utils'
import { pdf } from '@react-pdf/renderer'
import { ShotListPDF, InventoryPDF } from '../lib/pdfTemplates'
import { useToast } from '../hooks/use-toast'

const SHOT_FIELDS = [
  { id: 'name', label: 'Shot Name', description: 'The name/title of the shot' },
  { id: 'type', label: 'Shot Type', description: 'Category or type of shot' },
  { id: 'status', label: 'Status', description: 'Current workflow status' },
  { id: 'date', label: 'Scheduled Date', description: 'When the shot is scheduled' },
  { id: 'products', label: 'Product Count', description: 'Number of products in shot' },
  { id: 'talent', label: 'Talent Count', description: 'Number of talent assigned' },
  { id: 'location', label: 'Location', description: 'Shoot location assignment' },
  { id: 'priority', label: 'Priority', description: 'Shot priority level' },
  { id: 'description', label: 'Description', description: 'Shot description and notes' },
  { id: 'notes', label: 'Notes', description: 'Additional notes and requirements' }
]

const INVENTORY_FIELDS = [
  { id: 'product', label: 'Product Name', description: 'Name of the requested product' },
  { id: 'styleNumber', label: 'Style Number', description: 'Product style/SKU number' },
  { id: 'quantity', label: 'Requested Quantity', description: 'Originally requested amount' },
  { id: 'quantityPicked', label: 'Picked Quantity', description: 'Actually picked amount' },
  { id: 'status', label: 'Fulfillment Status', description: 'Fulfillment status' },
  { id: 'substitution', label: 'Substitutions', description: 'Any product substitutions' },
  { id: 'notes', label: 'Notes', description: 'Warehouse notes and comments' }
]

function FieldSelector({ fields, selectedFields, onToggleField, title }) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <div className="grid grid-cols-1 gap-3">
        {fields.map((field) => (
          <div
            key={field.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              selectedFields.includes(field.id)
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-gray-300"
            )}
            onClick={() => onToggleField(field.id)}
          >
            <div className="mt-0.5">
              {selectedFields.includes(field.id) ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{field.label}</div>
              <div className="text-xs text-gray-600">{field.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportOptions({ options, onUpdateOptions, exportType }) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">Export Options</h3>
      <div className="space-y-3">
        {exportType === 'shots' && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includesSummary}
                onChange={(e) => onUpdateOptions({ includesSummary: e.target.checked })}
              />
              <span className="text-sm">Include export summary</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeDetails}
                onChange={(e) => onUpdateOptions({ includeDetails: e.target.checked })}
              />
              <span className="text-sm">Include detailed shot information</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.groupByStatus}
                onChange={(e) => onUpdateOptions({ groupByStatus: e.target.checked })}
              />
              <span className="text-sm">Group shots by status</span>
            </label>
          </>
        )}
        
        {exportType === 'inventory' && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeSummary}
                onChange={(e) => onUpdateOptions({ includeSummary: e.target.checked })}
              />
              <span className="text-sm">Include fulfillment summary</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeSubstitutions}
                onChange={(e) => onUpdateOptions({ includeSubstitutions: e.target.checked })}
              />
              <span className="text-sm">Include substitution details</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.showPrices}
                onChange={(e) => onUpdateOptions({ showPrices: e.target.checked })}
              />
              <span className="text-sm">Show product prices</span>
            </label>
          </>
        )}

        <div className="pt-4 border-t">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Document Title (Optional)</label>
              <Input
                placeholder="Custom title for the PDF"
                value={options.customTitle || ''}
                onChange={(e) => onUpdateOptions({ customTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Organization Name</label>
              <Input
                placeholder="Organization name for header"
                value={options.organizationName || 'Shot Builder'}
                onChange={(e) => onUpdateOptions({ organizationName: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PDFExportModal({
  isOpen,
  onClose,
  exportType, // 'shots' or 'inventory'
  data, // shots array or pull request object
  products = [],
  projectName,
  onExport
}) {
  const { toast } = useToast()
  const [selectedFields, setSelectedFields] = useState(
    exportType === 'shots' 
      ? ['name', 'type', 'status', 'date', 'products', 'talent']
      : ['product', 'styleNumber', 'quantity', 'status', 'notes']
  )
  const [options, setOptions] = useState({
    includesSummary: true,
    includeDetails: exportType === 'shots',
    groupByStatus: false,
    includeSummary: exportType === 'inventory',
    includeSubstitutions: true,
    showPrices: false,
    customTitle: '',
    organizationName: 'Shot Builder'
  })
  const [isGenerating, setIsGenerating] = useState(false)

  const fields = exportType === 'shots' ? SHOT_FIELDS : INVENTORY_FIELDS

  const toggleField = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    )
  }

  const updateOptions = (updates) => {
    setOptions(prev => ({ ...prev, ...updates }))
  }

  const handlePreview = async () => {
    // For now, just show a toast. In a real app, this could open a preview modal
    toast({
      title: "Preview",
      description: "PDF preview would open here in a real implementation"
    })
  }

  const handleGenerateAndDownload = async () => {
    setIsGenerating(true)
    
    try {
      let pdfDoc

      if (exportType === 'shots') {
        const shots = Array.isArray(data) ? data : []
        pdfDoc = (
          <ShotListPDF
            shots={shots}
            selectedFields={selectedFields}
            options={options}
            projectName={projectName}
            organizationName={options.organizationName}
          />
        )
      } else {
        const pullRequest = data
        const items = pullRequest.items || []
        pdfDoc = (
          <InventoryPDF
            pullRequest={pullRequest}
            items={items}
            products={products}
            selectedFields={selectedFields}
            options={options}
            organizationName={options.organizationName}
          />
        )
      }

      // Generate PDF blob
      const blob = await pdf(pdfDoc).toBlob()
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const filename = exportType === 'shots' 
        ? `shot-list-${new Date().getTime()}.pdf`
        : `inventory-${data.number}-${new Date().getTime()}.pdf`
      
      link.download = filename
      link.click()
      
      // Cleanup
      URL.revokeObjectURL(url)
      
      toast({
        title: "PDF Generated",
        description: `${exportType === 'shots' ? 'Shot list' : 'Inventory report'} downloaded successfully`
      })
      
      if (onExport) {
        onExport({
          type: exportType,
          fields: selectedFields,
          options,
          filename
        })
      }
      
      onClose()

    } catch (error) {
      console.error('PDF generation error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const selectAllFields = () => {
    setSelectedFields(fields.map(f => f.id))
  }

  const clearAllFields = () => {
    setSelectedFields([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>
                Export {exportType === 'shots' ? 'Shot List' : 'Inventory Report'} to PDF
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6">
            {/* Export Summary */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Export Summary</h3>
                  <p className="text-sm text-gray-600">
                    {exportType === 'shots' 
                      ? `Exporting ${Array.isArray(data) ? data.length : 0} shots`
                      : `Exporting pull request #${data?.number} with ${data?.items?.length || 0} items`
                    }
                  </p>
                </div>
                <Badge variant="outline">
                  {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
                </Badge>
              </div>
            </div>

            <Tabs defaultValue="fields" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fields">Fields & Layout</TabsTrigger>
                <TabsTrigger value="options">Export Options</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-6 mt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select Fields to Include</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllFields}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAllFields}>
                      Clear All
                    </Button>
                  </div>
                </div>

                <FieldSelector
                  fields={fields}
                  selectedFields={selectedFields}
                  onToggleField={toggleField}
                  title={exportType === 'shots' ? 'Shot Information' : 'Inventory Information'}
                />
              </TabsContent>

              <TabsContent value="options" className="mt-6">
                <ExportOptions
                  options={options}
                  onUpdateOptions={updateOptions}
                  exportType={exportType}
                />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>

        <div className="border-t p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedFields.length === 0 && (
                <span className="text-red-600">Please select at least one field to export</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button 
                onClick={handleGenerateAndDownload}
                disabled={selectedFields.length === 0 || isGenerating}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}