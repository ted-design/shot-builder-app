import { useState } from "react"
import { useFirestoreCollection, useFirestoreUpdate } from "../hooks/useFirebaseQuery"
import { projectShotsPath, getActiveProjectId } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import CalendarPlanner from "../components/CalendarPlanner"
import ShotForm from "../components/ShotForm"
import { 
  Calendar,
  LayoutGrid,
  List,
  Filter,
  Download,
  Settings
} from "lucide-react"
import { Badge } from "../components/ui/badge"
import { cn } from "../lib/utils"

function PlannerStats({ shots }) {
  const stats = {
    total: shots.length,
    scheduled: shots.filter(s => s.scheduledDate).length,
    unscheduled: shots.filter(s => !s.scheduledDate && (s.status === 'ready' || s.status === 'scheduled')).length,
    issues: shots.filter(s => !s.locationId || !s.talentIds?.length || !s.productIds?.length).length,
    thisWeek: shots.filter(s => {
      if (!s.scheduledDate) return false
      const shotDate = new Date(s.scheduledDate)
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return shotDate >= weekStart && shotDate <= weekEnd
    }).length
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Shots</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.scheduled}</div>
          <div className="text-sm text-gray-600">Scheduled</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.unscheduled}</div>
          <div className="text-sm text-gray-600">Unscheduled</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
          <div className="text-sm text-gray-600">Issues</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.thisWeek}</div>
          <div className="text-sm text-gray-600">This Week</div>
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineView({ shots, onUpdateShot }) {
  const scheduledShots = shots
    .filter(shot => shot.scheduledDate)
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))

  const groupedByDate = scheduledShots.reduce((acc, shot) => {
    const date = new Date(shot.scheduledDate).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(shot)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(groupedByDate).map(([dateString, dateShots]) => (
        <Card key={dateString}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {new Date(dateString).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <Badge variant="secondary">
                {dateShots.length} shots
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dateShots.map((shot) => (
                <Card key={shot.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{shot.name}</h4>
                      <p className="text-sm text-gray-600">{shot.type}</p>
                      {shot.scheduledTime && (
                        <p className="text-sm text-gray-500 mt-1">
                          🕐 {shot.scheduledTime}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={shot.status === 'shot' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {shot.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                    <span>📦 {shot.productIds?.length || 0}</span>
                    <span>👥 {shot.talentIds?.length || 0}</span>
                    {shot.locationId && <span>📍 Location</span>}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      
      {Object.keys(groupedByDate).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No scheduled shots</h3>
            <p className="text-gray-600">Schedule shots using the calendar planner above</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function PlannerPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuthContext()
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' or 'timeline'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState({})
  
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

  // Update mutation
  const updateShotMutation = useFirestoreUpdate([...projectShotsPath(activeProjectId), 'temp'])

  // Check permissions
  if (!hasPermission('projects', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view the planner.</p>
      </div>
    )
  }

  const handleUpdateShot = async (shotId, updates) => {
    try {
      // Create mutation with correct path
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
    } catch (error) {
      console.error('Error updating shot:', error)
      toast({
        title: "Error",
        description: "Failed to update shot",
        variant: "destructive"
      })
    }
  }

  const handleCreateShot = (initialData = {}) => {
    setCreateFormData(initialData)
    setShowCreateForm(true)
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
          <h1 className="text-3xl font-bold text-gray-900">Planner</h1>
          <p className="text-gray-600 mt-1">
            Schedule and organize shots with drag-and-drop calendar
          </p>
          {activeProjectId !== 'default-project' && (
            <Badge variant="outline" className="mt-2">
              Project: {activeProjectId}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4 mr-2" />
              Timeline
            </Button>
          </div>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PlannerStats shots={allShots} />

      {/* Create Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <ShotForm
            shot={null}
            initialData={createFormData}
            onSave={(data) => {
              // Handle shot creation
              console.log('Creating shot:', data)
              setShowCreateForm(false)
              setCreateFormData({})
            }}
            onCancel={() => {
              setShowCreateForm(false)
              setCreateFormData({})
            }}
            isLoading={false}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner text="Loading planner..." />
      ) : viewMode === 'calendar' ? (
        <CalendarPlanner
          shots={allShots}
          onUpdateShot={handleUpdateShot}
          onCreateShot={handleCreateShot}
          loading={isLoading}
        />
      ) : (
        <TimelineView 
          shots={allShots}
          onUpdateShot={handleUpdateShot}
        />
      )}
    </div>
  )
}