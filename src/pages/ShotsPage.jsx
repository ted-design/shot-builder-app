import { useState, useEffect } from "react"
import { useFirestoreCollection, useFirestoreAdd, useFirestoreUpdate } from "../hooks/useFirebaseQuery"
import { projectShotsPath, getActiveProjectId } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import ShotKanban from "../components/ShotKanban"
import ShotForm from "../components/ShotForm"
import PDFExportModal from "../components/PDFExportModal"
import { 
  Camera, 
  Plus, 
  LayoutGrid, 
  List,
  Filter,
  Search,
  Download,
  FileText
} from "lucide-react"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { cn } from "../lib/utils"

export default function ShotsPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuthContext()
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' or 'list'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingShot, setEditingShot] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedShots, setSelectedShots] = useState([])
  const [showPDFExport, setShowPDFExport] = useState(false)
  
  const activeProjectId = getActiveProjectId()

  // Query shots for the active project
  const { 
    data: allShots = [], 
    isLoading, 
    error 
  } = useFirestoreCollection(
    projectShotsPath(activeProjectId),
    []
  )

  // Mutations
  const createShotMutation = useFirestoreAdd(projectShotsPath(activeProjectId))
  const updateShotMutation = useFirestoreUpdate([...projectShotsPath(activeProjectId), 'temp'])

  // Check permissions
  if (!hasPermission('projects', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view shots.</p>
      </div>
    )
  }

  // Filter shots based on search and status
  const filteredShots = allShots.filter(shot => {
    const matchesSearch = !searchQuery || 
      shot.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shot.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shot.type?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || shot.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const handleCreateShot = async (shotData) => {
    try {
      await createShotMutation.mutateAsync({
        ...shotData,
        projectId: activeProjectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      toast({
        title: "Success",
        description: "Shot created successfully"
      })

      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating shot:', error)
      toast({
        title: "Error",
        description: "Failed to create shot",
        variant: "destructive"
      })
    }
  }

  const handleUpdateShot = async (shotId, updates) => {
    try {
      // Update the path to include the specific shot ID
      const shotPath = [...projectShotsPath(activeProjectId), shotId]
      const mutation = useFirestoreUpdate(shotPath)
      
      await mutation.mutateAsync({
        ...updates,
        updatedAt: new Date().toISOString(),
      })

      toast({
        title: "Success", 
        description: "Shot updated successfully"
      })

      setEditingShot(null)
    } catch (error) {
      console.error('Error updating shot:', error)
      toast({
        title: "Error",
        description: "Failed to update shot",
        variant: "destructive"
      })
    }
  }

  const handleKanbanCreateShot = (initialData = {}) => {
    setShowCreateForm(true)
    // You could pre-fill form data here if needed
  }

  const handleShotSelect = (shot) => {
    setSelectedShots(prev => {
      const isSelected = prev.some(s => s.id === shot.id)
      if (isSelected) {
        return prev.filter(s => s.id !== shot.id)
      } else {
        return [...prev, shot]
      }
    })
  }

  const handleBulkExport = () => {
    if (selectedShots.length === 0) {
      toast({
        title: "No Shots Selected",
        description: "Please select shots to export",
        variant: "destructive"
      })
      return
    }
    setShowPDFExport(true)
  }

  const handleExportAll = () => {
    setSelectedShots(filteredShots)
    setShowPDFExport(true)
  }

  const clearSelection = () => {
    setSelectedShots([])
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading shots: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shots</h1>
          <p className="text-gray-600 mt-1">
            Manage photo shoot shots with Kanban workflow
          </p>
          {activeProjectId !== 'default-project' && (
            <Badge variant="outline" className="mt-2">
              Project: {activeProjectId}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search shots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportAll}>
            <FileText className="h-4 w-4 mr-2" />
            Export All
          </Button>

          {hasPermission('projects', 'create') && (
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Shot
            </Button>
          )}
        </div>
      </div>

      {/* Selection Bar */}
      {selectedShots.length > 0 && (
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedShots.length} shot{selectedShots.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-1">
                  {selectedShots.slice(0, 3).map(shot => (
                    <Badge key={shot.id} variant="secondary" className="text-xs">
                      {shot.name}
                    </Badge>
                  ))}
                  {selectedShots.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedShots.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {['draft', 'ready', 'scheduled', 'shot', 'wrapped'].map(status => {
          const count = allShots.filter(shot => shot.status === status).length
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
                <div className="text-sm text-gray-600 capitalize">{status}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingShot) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <ShotForm
            shot={editingShot}
            onSave={editingShot ? 
              (data) => handleUpdateShot(editingShot.id, data) : 
              handleCreateShot
            }
            onCancel={() => {
              setShowCreateForm(false)
              setEditingShot(null)
            }}
            isLoading={createShotMutation.isPending || updateShotMutation.isPending}
          />
        </div>
      )}

      {/* PDF Export Modal */}
      <PDFExportModal
        isOpen={showPDFExport}
        onClose={() => {
          setShowPDFExport(false)
          setSelectedShots([])
        }}
        exportType="shots"
        data={selectedShots}
        projectName={activeProjectId}
        onExport={(exportData) => {
          console.log('Export completed:', exportData)
        }}
      />

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner text="Loading shots..." />
      ) : viewMode === 'kanban' ? (
        <ShotKanban
          shots={filteredShots}
          onUpdateShot={handleUpdateShot}
          onCreateShot={handleKanbanCreateShot}
          loading={isLoading}
        />
      ) : (
        <ShotListView 
          shots={filteredShots}
          onEditShot={setEditingShot}
          onUpdateShot={handleUpdateShot}
          selectedShots={selectedShots}
          onSelectShot={handleShotSelect}
        />
      )}

      {/* Empty State */}
      {!isLoading && filteredShots.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || filterStatus !== 'all' ? 'No shots match your filters' : 'No shots yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Create your first shot to get started'
              }
            </p>
            {hasPermission('projects', 'create') && !searchQuery && filterStatus === 'all' && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Shot
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ShotListView({ shots, onEditShot, onUpdateShot, selectedShots, onSelectShot }) {
  return (
    <div className="space-y-3">
      {shots.map((shot) => {
        const isSelected = selectedShots.some(s => s.id === shot.id)
        
        return (
          <Card 
            key={shot.id} 
            className={cn(
              "hover:shadow-md transition-shadow cursor-pointer",
              isSelected && "ring-2 ring-primary bg-primary/5"
            )}
            onClick={() => onSelectShot(shot)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelectShot(shot)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Camera className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">{shot.name}</h3>
                    <p className="text-sm text-gray-600">{shot.type || 'No type'}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {shot.status || 'draft'}
                      </Badge>
                      {shot.priority && (
                        <Badge 
                          variant={shot.priority === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {shot.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right text-sm text-gray-600">
                    <div>Products: {shot.productIds?.length || 0}</div>
                    <div>Talent: {shot.talentIds?.length || 0}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditShot(shot)
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}