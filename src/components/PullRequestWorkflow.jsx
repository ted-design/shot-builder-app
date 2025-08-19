import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  FileText, 
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Edit,
  Plus,
  Minus,
  User,
  Calendar,
  ShoppingCart,
  Truck
} from 'lucide-react'
import { cn, formatDate, formatCurrency } from '../lib/utils'
import { PULL_REQUEST_STATUSES } from '../lib/constants'
import { useToast } from '../hooks/use-toast'

const STATUS_CONFIG = {
  [PULL_REQUEST_STATUSES.DRAFT]: {
    icon: Edit,
    color: 'bg-gray-100 text-gray-800',
    label: 'Draft'
  },
  [PULL_REQUEST_STATUSES.SUBMITTED]: {
    icon: FileText,
    color: 'bg-blue-100 text-blue-800',
    label: 'Submitted'
  },
  [PULL_REQUEST_STATUSES.IN_PROGRESS]: {
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800',
    label: 'In Progress'
  },
  [PULL_REQUEST_STATUSES.FULFILLED]: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800',
    label: 'Fulfilled'
  },
  [PULL_REQUEST_STATUSES.APPROVED]: {
    icon: CheckCircle,
    color: 'bg-purple-100 text-purple-800',
    label: 'Approved'
  }
}

function PullRequestHeader({ pullRequest, onUpdateStatus, onExport, userRole }) {
  const statusConfig = STATUS_CONFIG[pullRequest.status]
  const StatusIcon = statusConfig.icon

  const canEdit = userRole === 'admin' || userRole === 'producer'
  const canFulfill = userRole === 'admin' || userRole === 'warehouse'
  
  const nextStatus = {
    draft: 'submitted',
    submitted: 'in_progress',
    in_progress: 'fulfilled',
    fulfilled: 'approved'
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold">Pull Request #{pullRequest.number}</h1>
        </div>
        
        <Badge className={cn("flex items-center gap-1", statusConfig.color)}>
          <StatusIcon className="h-3 w-3" />
          {statusConfig.label}
        </Badge>
        
        {pullRequest.priority === 'high' && (
          <Badge variant="destructive">High Priority</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onExport('pdf')}
        >
          <Download className="h-4 w-4 mr-2" />
          PDF
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onExport('csv')}
        >
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>

        {(canEdit || canFulfill) && pullRequest.status !== 'approved' && (
          <Button 
            onClick={() => onUpdateStatus(nextStatus[pullRequest.status])}
            size="sm"
          >
            {pullRequest.status === 'draft' && 'Submit Request'}
            {pullRequest.status === 'submitted' && 'Start Fulfillment'}
            {pullRequest.status === 'in_progress' && 'Mark Fulfilled'}
            {pullRequest.status === 'fulfilled' && 'Approve Request'}
          </Button>
        )}
      </div>
    </div>
  )
}

function PullRequestInfo({ pullRequest, project, shots }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Project Information</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Project:</span>
                <span>{project?.name || 'Unknown Project'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shoot Dates:</span>
                <span>{project?.shootDates?.join(', ') || 'TBD'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Shots:</span>
                <span>{shots?.length || 0}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Request Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{formatDate(pullRequest.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Requested By:</span>
                <span>{pullRequest.createdBy?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Items:</span>
                <span>{pullRequest.items?.length || 0}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Status</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span>{formatDate(pullRequest.updatedAt)}</span>
              </div>
              {pullRequest.fulfilledBy && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fulfilled By:</span>
                  <span>{pullRequest.fulfilledBy.name}</span>
                </div>
              )}
              {pullRequest.notes && (
                <div className="mt-2">
                  <span className="text-gray-600">Notes:</span>
                  <p className="text-gray-900 mt-1">{pullRequest.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ItemsList({ 
  items, 
  onUpdateItem, 
  onRemoveItem, 
  userRole, 
  pullRequestStatus,
  products = [] 
}) {
  const canEdit = (userRole === 'admin' || userRole === 'producer') && 
                   ['draft', 'submitted'].includes(pullRequestStatus)
  const canFulfill = (userRole === 'admin' || userRole === 'warehouse') && 
                     ['submitted', 'in_progress'].includes(pullRequestStatus)

  const getProductInfo = (productId) => {
    return products.find(p => p.id === productId) || { name: 'Unknown Product', style_number: 'N/A' }
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const product = getProductInfo(item.productId)
        const hasResponse = item.response && item.response.status
        
        return (
          <Card key={item.id || index}>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Request Details */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Requested Item</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Product:</span>
                      <span className="font-medium">{product.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Style:</span>
                      <span>{product.style_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Requested Qty:</span>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        )}
                        <span className="font-medium min-w-[2rem] text-center">{item.quantity}</span>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateItem(index, { quantity: item.quantity + 1 })}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {item.notes && (
                      <div>
                        <span className="text-sm text-gray-600">Notes:</span>
                        <p className="text-sm mt-1">{item.notes}</p>
                      </div>
                    )}
                    
                    {canEdit && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        className="mt-2"
                      >
                        Remove Item
                      </Button>
                    )}
                  </div>
                </div>

                {/* Warehouse Response */}
                <div className={cn(
                  "border-l pl-6",
                  hasResponse ? "border-green-200" : "border-gray-200"
                )}>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Warehouse Response
                    {hasResponse && (
                      <Badge variant="outline" className="ml-2">
                        {item.response.status}
                      </Badge>
                    )}
                  </h4>
                  
                  {hasResponse ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Picked Product:</span>
                        <span>{item.response.pickedProduct || product.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Quantity Picked:</span>
                        <span className="font-medium">{item.response.quantityPicked || 0}</span>
                      </div>
                      {item.response.substitution && (
                        <div>
                          <span className="text-sm text-gray-600">Substitution:</span>
                          <p className="text-sm mt-1 text-amber-600">{item.response.substitution}</p>
                        </div>
                      )}
                      {item.response.notes && (
                        <div>
                          <span className="text-sm text-gray-600">Notes:</span>
                          <p className="text-sm mt-1">{item.response.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : canFulfill ? (
                    <WarehouseResponseForm 
                      item={item}
                      product={product}
                      onSubmit={(response) => onUpdateItem(index, { response })}
                    />
                  ) : (
                    <p className="text-sm text-gray-500">Awaiting warehouse response</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function WarehouseResponseForm({ item, product, onSubmit }) {
  const [response, setResponse] = useState({
    pickedProduct: product.name,
    quantityPicked: item.quantity,
    status: 'fulfilled',
    substitution: '',
    notes: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(response)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Picked Product</label>
        <Input
          value={response.pickedProduct}
          onChange={(e) => setResponse(prev => ({ ...prev, pickedProduct: e.target.value }))}
          placeholder="Product name"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Quantity Picked</label>
        <Input
          type="number"
          min="0"
          value={response.quantityPicked}
          onChange={(e) => setResponse(prev => ({ ...prev, quantityPicked: parseInt(e.target.value) || 0 }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Status</label>
        <select
          value={response.status}
          onChange={(e) => setResponse(prev => ({ ...prev, status: e.target.value }))}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="fulfilled">Fulfilled</option>
          <option value="partial">Partial</option>
          <option value="substituted">Substituted</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {response.status === 'substituted' && (
        <div>
          <label className="block text-sm font-medium mb-1">Substitution Details</label>
          <Input
            value={response.substitution}
            onChange={(e) => setResponse(prev => ({ ...prev, substitution: e.target.value }))}
            placeholder="Describe the substitution"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={response.notes}
          onChange={(e) => setResponse(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full p-2 border border-gray-300 rounded-md resize-none"
          rows={2}
          placeholder="Additional notes..."
        />
      </div>

      <Button type="submit" size="sm" className="w-full">
        <CheckCircle className="h-4 w-4 mr-2" />
        Submit Response
      </Button>
    </form>
  )
}

function ActivityLog({ events = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{event.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>{event.user}</span>
                    <Calendar className="h-3 w-3 ml-2" />
                    <span>{formatDate(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function PullRequestWorkflow({ 
  pullRequest,
  project,
  shots = [],
  products = [],
  onUpdate,
  onExport,
  userRole = 'viewer'
}) {
  const { toast } = useToast()

  const handleUpdateStatus = async (newStatus) => {
    try {
      await onUpdate({ 
        status: newStatus,
        [`${newStatus}At`]: new Date().toISOString(),
        [`${newStatus}By`]: { name: 'Current User' } // In real app, get from auth
      })
      
      toast({
        title: "Status Updated",
        description: `Pull request marked as ${newStatus}`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      })
    }
  }

  const handleUpdateItem = async (index, updates) => {
    try {
      const updatedItems = [...pullRequest.items]
      updatedItems[index] = { ...updatedItems[index], ...updates }
      
      await onUpdate({ items: updatedItems })
      
      toast({
        title: "Item Updated",
        description: "Pull request item updated successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive"
      })
    }
  }

  const handleRemoveItem = async (index) => {
    try {
      const updatedItems = pullRequest.items.filter((_, i) => i !== index)
      await onUpdate({ items: updatedItems })
      
      toast({
        title: "Item Removed",
        description: "Item removed from pull request"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive"
      })
    }
  }

  const handleExport = (format) => {
    onExport(format)
    toast({
      title: "Export Started",
      description: `Generating ${format.toUpperCase()} export...`
    })
  }

  return (
    <div className="space-y-6">
      <PullRequestHeader 
        pullRequest={pullRequest}
        onUpdateStatus={handleUpdateStatus}
        onExport={handleExport}
        userRole={userRole}
      />

      <PullRequestInfo 
        pullRequest={pullRequest}
        project={project}
        shots={shots}
      />

      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">
            Items ({pullRequest.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-6">
          <ItemsList
            items={pullRequest.items || []}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            userRole={userRole}
            pullRequestStatus={pullRequest.status}
            products={products}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityLog events={pullRequest.activityLog || []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}