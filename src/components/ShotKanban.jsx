import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Camera, 
  Plus, 
  Calendar,
  Users, 
  Package,
  MapPin,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react'
import { cn } from '../lib/utils'
import { SHOT_STATUSES } from '../lib/constants'
import { useToast } from '../hooks/use-toast'

const STATUS_COLUMNS = [
  {
    id: SHOT_STATUSES.DRAFT,
    title: 'Draft',
    description: 'Shots being planned',
    color: 'bg-gray-100 border-gray-300'
  },
  {
    id: SHOT_STATUSES.READY,
    title: 'Ready',
    description: 'Ready for scheduling',
    color: 'bg-blue-50 border-blue-200'
  },
  {
    id: SHOT_STATUSES.SCHEDULED,
    title: 'Scheduled',
    description: 'Assigned to shoot day',
    color: 'bg-yellow-50 border-yellow-200'
  },
  {
    id: SHOT_STATUSES.SHOT,
    title: 'Shot',
    description: 'Photography complete',
    color: 'bg-green-50 border-green-200'
  },
  {
    id: SHOT_STATUSES.WRAPPED,
    title: 'Wrapped',
    description: 'Post-production complete',
    color: 'bg-purple-50 border-purple-200'
  }
]

function DroppableColumn({ column, shots, onAddShot }) {
  const { setNodeRef } = useDroppable({
    id: column.id
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[600px] w-80 rounded-lg border-2 border-dashed p-4",
        column.color
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{column.title}</h3>
          <p className="text-sm text-gray-600">{column.description}</p>
          <span className="text-xs text-gray-500">{shots.length} shots</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAddShot(column.id)}
          className="h-8 w-8 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={shots.map(shot => shot.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 flex-1">
          {shots.map((shot) => (
            <SortableShotCard key={shot.id} shot={shot} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableShotCard({ shot }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: shot.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ShotCard shot={shot} />
    </div>
  )
}

function ShotCard({ shot }) {
  const hasWarnings = !shot.active || shot.productIds?.length === 0 || shot.talentIds?.length === 0

  return (
    <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium line-clamp-2">
              {shot.name}
            </CardTitle>
            {shot.type && (
              <p className="text-xs text-gray-500 mt-1">{shot.type}</p>
            )}
          </div>
          {hasWarnings && (
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {shot.date && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="h-3 w-3" />
            {new Date(shot.date).toLocaleDateString()}
          </div>
        )}

        <div className="space-y-2">
          {shot.productIds?.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Package className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">{shot.productIds.length} products</span>
            </div>
          )}

          {shot.talentIds?.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">{shot.talentIds.length} talent</span>
            </div>
          )}

          {shot.locationId && (
            <div className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">Location set</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            {!shot.active && (
              <Badge variant="destructive" className="text-xs">Inactive</Badge>
            )}
            {shot.priority && (
              <Badge variant="secondary" className="text-xs">{shot.priority}</Badge>
            )}
          </div>
          
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ShotKanban({ 
  shots = [], 
  onUpdateShot, 
  onCreateShot,
  loading = false 
}) {
  const [activeShot, setActiveShot] = useState(null)
  const { toast } = useToast()

  // Group shots by status
  const shotsByStatus = STATUS_COLUMNS.reduce((acc, column) => {
    acc[column.id] = shots.filter(shot => shot.status === column.id)
    return acc
  }, {})

  const handleDragStart = (event) => {
    const { active } = event
    const shot = shots.find(s => s.id === active.id)
    setActiveShot(shot)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveShot(null)

    if (!over) return

    const shotId = active.id
    const newStatus = over.id

    // Find the shot being moved
    const shot = shots.find(s => s.id === shotId)
    if (!shot) return

    // Don't update if status hasn't changed
    if (shot.status === newStatus) return

    // Update shot status
    onUpdateShot(shotId, { status: newStatus })

    toast({
      title: "Shot Updated",
      description: `Shot moved to ${STATUS_COLUMNS.find(c => c.id === newStatus)?.title}`
    })
  }

  const handleAddShot = (status) => {
    onCreateShot({ status })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading shots...</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-6">
        {STATUS_COLUMNS.map((column) => (
          <DroppableColumn
            key={column.id}
            column={column}
            shots={shotsByStatus[column.id] || []}
            onAddShot={handleAddShot}
          />
        ))}
      </div>

      <DragOverlay>
        {activeShot && <ShotCard shot={activeShot} />}
      </DragOverlay>
    </DndContext>
  )
}