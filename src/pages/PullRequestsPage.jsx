import { useState } from "react"
import { useFirestoreCollection, useFirestoreAdd, useFirestoreUpdate } from "../hooks/useFirebaseQuery"
import { pullRequestsPath, getActiveProjectId, projectsPath, productsPath } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import PullRequestWorkflow from "../components/PullRequestWorkflow"
import PDFExportModal from "../components/PDFExportModal"
import { 
  FileText, 
  Plus, 
  Search,
  Filter,
  Download,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye
} from "lucide-react"
import { cn, formatDate } from "../lib/utils"
import { PULL_REQUEST_STATUSES } from "../lib/constants"

const STATUS_COLORS = {
  [PULL_REQUEST_STATUSES.DRAFT]: 'bg-gray-100 text-gray-800',
  [PULL_REQUEST_STATUSES.SUBMITTED]: 'bg-blue-100 text-blue-800', 
  [PULL_REQUEST_STATUSES.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [PULL_REQUEST_STATUSES.FULFILLED]: 'bg-green-100 text-green-800',
  [PULL_REQUEST_STATUSES.APPROVED]: 'bg-purple-100 text-purple-800'
}

function PullRequestCard({ pullRequest, onClick, onQuickAction, onExport }) {
  const totalItems = pullRequest.items?.length || 0
  const fulfilledItems = pullRequest.items?.filter(item => 
    item.response && ['fulfilled', 'partial', 'substituted'].includes(item.response.status)
  ).length || 0

  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-900">
              Pull Request #{pullRequest.number}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Project: {pullRequest.projectName || 'Unknown'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", STATUS_COLORS[pullRequest.status])}>
              {pullRequest.status}
            </Badge>
            {pullRequest.priority === 'high' && (
              <Badge variant="destructive" className="text-xs">
                High
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Items:</span>
            <span>{totalItems}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress:</span>
            <span>{fulfilledItems}/{totalItems}</span>
          </div>

          {totalItems > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Created: {formatDate(pullRequest.createdAt)}</span>
            <span>By: {pullRequest.createdBy?.name || 'Unknown'}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onExport(pullRequest)
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          {pullRequest.status === 'draft' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onQuickAction(pullRequest.id, 'submit')
              }}
            >
              Submit
            </Button>
          )}
          
          {pullRequest.status === 'submitted' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onQuickAction(pullRequest.id, 'start')
              }}
            >
              Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CreatePullRequestModal({ onClose, onCreate, projects, shots, products }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedShots, setSelectedShots] = useState([])
  const [priority, setPriority] = useState('medium')
  const [notes, setNotes] = useState('')

  const projectShots = shots.filter(shot => shot.projectId === selectedProject)
  const availableShots = projectShots.filter(shot => 
    shot.status === 'scheduled' && shot.productIds?.length > 0
  )

  const handleCreate = () => {
    if (!selectedProject || selectedShots.length === 0) return

    // Aggregate products from selected shots
    const items = []
    const productCounts = {}

    selectedShots.forEach(shotId => {
      const shot = shots.find(s => s.id === shotId)
      shot.productIds?.forEach(productId => {
        productCounts[productId] = (productCounts[productId] || 0) + 1
      })
    })

    Object.entries(productCounts).forEach(([productId, quantity]) => {
      items.push({
        id: `${Date.now()}-${productId}`,
        productId,
        quantity,
        notes: ''
      })
    })

    const project = projects.find(p => p.id === selectedProject)
    
    onCreate({
      projectId: selectedProject,
      projectName: project?.name || 'Unknown Project',
      shotIds: selectedShots,
      items,
      priority,
      notes,
      status: 'draft'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Create Pull Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Project *</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Shots ({availableShots.length} available)
              </label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                {availableShots.map((shot) => (
                  <label key={shot.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedShots.includes(shot.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedShots(prev => [...prev, shot.id])
                        } else {
                          setSelectedShots(prev => prev.filter(id => id !== shot.id))
                        }
                      }}
                    />
                    <span className="text-sm">{shot.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {shot.productIds?.length || 0} products
                    </Badge>
                  </label>
                ))}
                
                {availableShots.length === 0 && (
                  <p className="text-sm text-gray-500">No shots with products available</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={3}
              placeholder="Additional notes for the warehouse team..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!selectedProject || selectedShots.length === 0}
            >
              Create Pull Request
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PullRequestsPage() {
  const { toast } = useToast()
  const { hasPermission, role } = useAuthContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPullRequest, setSelectedPullRequest] = useState(null)
  const [showPDFExport, setShowPDFExport] = useState(false)
  const [exportPullRequest, setExportPullRequest] = useState(null)
  
  const activeProjectId = getActiveProjectId()

  // Query pull requests
  const { data: allPullRequests = [], isLoading: loadingPullRequests } = useFirestoreCollection(
    pullRequestsPath(activeProjectId),
    []
  )

  // Query related data
  const { data: allProjects = [] } = useFirestoreCollection(projectsPath())
  const { data: allShots = [] } = useFirestoreCollection([...projectsPath(), activeProjectId, 'shots'])
  const { data: allProducts = [] } = useFirestoreCollection(productsPath())

  // Mutations
  const createPullRequestMutation = useFirestoreAdd(pullRequestsPath(activeProjectId))
  const updatePullRequestMutation = useFirestoreUpdate([...pullRequestsPath(activeProjectId), 'temp'])

  if (!hasPermission('pullRequests', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view pull requests.</p>
      </div>
    )
  }

  // Filter pull requests
  const filteredPullRequests = allPullRequests.filter(pr => {
    const matchesSearch = !searchQuery || 
      pr.number?.toString().includes(searchQuery) ||
      pr.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || pr.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const handleCreatePullRequest = async (data) => {
    try {
      const pullRequestNumber = `PR-${Date.now().toString().slice(-6)}`
      
      await createPullRequestMutation.mutateAsync({
        ...data,
        number: pullRequestNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: { name: 'Current User' } // In real app, get from auth
      })

      toast({
        title: "Success",
        description: "Pull request created successfully"
      })
      
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error creating pull request:', error)
      toast({
        title: "Error",
        description: "Failed to create pull request",
        variant: "destructive"
      })
    }
  }

  const handleUpdatePullRequest = async (pullRequestId, updates) => {
    try {
      const prPath = [...pullRequestsPath(activeProjectId), pullRequestId]
      const mutation = useFirestoreUpdate(prPath)
      
      await mutation.mutateAsync({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error updating pull request:', error)
      throw error
    }
  }

  const handleQuickAction = async (pullRequestId, action) => {
    const statusMap = {
      submit: 'submitted',
      start: 'in_progress',
      fulfill: 'fulfilled',
      approve: 'approved'
    }

    try {
      await handleUpdatePullRequest(pullRequestId, {
        status: statusMap[action]
      })
      
      toast({
        title: "Success",
        description: `Pull request ${action}ted successfully`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} pull request`,
        variant: "destructive"
      })
    }
  }

  const handleExportPullRequest = (pullRequest) => {
    setExportPullRequest(pullRequest)
    setShowPDFExport(true)
  }

  const handleExport = (format) => {
    // Mock export - in real app this would generate actual files
    toast({
      title: "Export Started",
      description: `Generating ${format.toUpperCase()} export...`
    })
  }

  const currentProject = allProjects.find(p => p.id === activeProjectId)
  const selectedPR = selectedPullRequest ? 
    allPullRequests.find(pr => pr.id === selectedPullRequest) : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back to list when viewing individual PR */}
      {selectedPullRequest && (
        <Button
          variant="outline"
          onClick={() => setSelectedPullRequest(null)}
          className="mb-4"
        >
          ← Back to Pull Requests
        </Button>
      )}

      {!selectedPullRequest ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pull Requests</h1>
              <p className="text-gray-600 mt-1">Manage wardrobe requests and fulfillment</p>
            </div>
            
            {hasPermission('pullRequests', 'create') && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Pull Request
              </Button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search pull requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {['draft', 'submitted', 'in_progress', 'fulfilled', 'approved'].map(status => {
              const count = allPullRequests.filter(pr => pr.status === status).length
              return (
                <Card 
                  key={status}
                  className={cn(
                    "cursor-pointer transition-colors",
                    filterStatus === status && "ring-2 ring-primary"
                  )}
                  onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pull Requests List */}
          {loadingPullRequests ? (
            <LoadingSpinner text="Loading pull requests..." />
          ) : filteredPullRequests.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPullRequests.map((pullRequest) => (
                <PullRequestCard
                  key={pullRequest.id}
                  pullRequest={pullRequest}
                  onClick={() => setSelectedPullRequest(pullRequest.id)}
                  onQuickAction={handleQuickAction}
                  onExport={handleExportPullRequest}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery || filterStatus !== 'all' ? 'No pull requests match your filters' : 'No pull requests yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Create your first pull request to get started'
                  }
                </p>
                {hasPermission('pullRequests', 'create') && !searchQuery && filterStatus === 'all' && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pull Request
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <CreatePullRequestModal
              onClose={() => setShowCreateModal(false)}
              onCreate={handleCreatePullRequest}
              projects={allProjects}
              shots={allShots}
              products={allProducts}
            />
          )}
        </>
      ) : (
        /* Individual Pull Request View */
        selectedPR && (
          <PullRequestWorkflow
            pullRequest={selectedPR}
            project={currentProject}
            shots={allShots.filter(s => selectedPR.shotIds?.includes(s.id))}
            products={allProducts}
            onUpdate={(updates) => handleUpdatePullRequest(selectedPR.id, updates)}
            onExport={handleExport}
            userRole={role}
          />
        )
      )}

      {/* PDF Export Modal */}
      <PDFExportModal
        isOpen={showPDFExport}
        onClose={() => {
          setShowPDFExport(false)
          setExportPullRequest(null)
        }}
        exportType="inventory"
        data={exportPullRequest}
        products={allProducts}
        onExport={(exportData) => {
          console.log('Export completed:', exportData)
        }}
      />
    </div>
  )
}