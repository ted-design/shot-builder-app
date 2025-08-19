import React, { useState, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  DragOverlay
} from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Camera,
  Clock,
  Users,
  MapPin,
  Package,
  AlertTriangle
} from 'lucide-react'
import { cn, formatDate } from '../lib/utils'
import { useToast } from '../hooks/use-toast'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function CalendarDay({ date, shots = [], onAddShot, isToday, isCurrentMonth, onDropShot }) {
  const { setNodeRef, isOver } = useDroppable({
    id: date.toISOString()
  })

  const dayShots = shots.filter(shot => {
    if (!shot.scheduledDate) return false
    const shotDate = new Date(shot.scheduledDate)
    return shotDate.toDateString() === date.toDateString()
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] p-2 border border-gray-200 transition-colors",
        "hover:bg-gray-50",
        isToday && "bg-blue-50 border-blue-200",
        !isCurrentMonth && "bg-gray-100 text-gray-400",
        isOver && "bg-primary/10 border-primary"
      )}
    >
      <div className="flex justify-between items-center mb-2">
        <span className={cn(
          "text-sm font-medium",
          isToday && "text-blue-600",
          !isCurrentMonth && "text-gray-400"
        )}>
          {date.getDate()}
        </span>
        
        {isCurrentMonth && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddShot(date)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {dayShots.map((shot) => (
          <CalendarShotCard key={shot.id} shot={shot} />
        ))}
      </div>

      {dayShots.length > 3 && (
        <div className="text-xs text-gray-500 mt-1">
          +{dayShots.length - 3} more
        </div>
      )}
    </div>
  )
}

function CalendarShotCard({ shot }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shot.id
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  } : undefined

  const hasIssues = !shot.locationId || !shot.talentIds?.length || !shot.productIds?.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-2 rounded text-xs bg-white border shadow-sm cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-shadow",
        hasIssues && "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{shot.name}</p>
          {shot.scheduledTime && (
            <p className="text-gray-500 flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {shot.scheduledTime}
            </p>
          )}
        </div>
        {hasIssues && (
          <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        {shot.productIds?.length > 0 && (
          <div className="flex items-center gap-1 text-gray-500">
            <Package className="h-3 w-3" />
            <span>{shot.productIds.length}</span>
          </div>
        )}
        {shot.talentIds?.length > 0 && (
          <div className="flex items-center gap-1 text-gray-500">
            <Users className="h-3 w-3" />
            <span>{shot.talentIds.length}</span>
          </div>
        )}
        {shot.locationId && (
          <MapPin className="h-3 w-3 text-gray-500" />
        )}
      </div>

      <Badge 
        variant={shot.priority === 'high' ? 'destructive' : 'secondary'} 
        className="text-xs mt-1"
      >
        {shot.status}
      </Badge>
    </div>
  )
}

function UnscheduledShots({ shots, onDragStart }) {
  const unscheduledShots = shots.filter(shot => 
    !shot.scheduledDate && (shot.status === 'ready' || shot.status === 'scheduled')
  )

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Unscheduled Shots ({unscheduledShots.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unscheduledShots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {unscheduledShots.map((shot) => (
              <CalendarShotCard key={shot.id} shot={shot} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>All shots are scheduled!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CalendarPlanner({ 
  shots = [], 
  onUpdateShot,
  onCreateShot,
  loading = false 
}) {
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeShot, setActiveShot] = useState(null)

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
    
    const days = []
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 42) // 6 weeks = 42 days
    
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d))
    }
    
    return days
  }, [currentDate])

  const today = new Date()
  const currentMonth = currentDate.getMonth()

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleDragStart = (event) => {
    const shot = shots.find(s => s.id === event.active.id)
    setActiveShot(shot)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveShot(null)

    if (!over) return

    const shotId = active.id
    const dropDate = new Date(over.id)
    
    // Find the shot being moved
    const shot = shots.find(s => s.id === shotId)
    if (!shot) return

    // Update shot with scheduled date
    onUpdateShot(shotId, {
      scheduledDate: dropDate.toISOString(),
      status: 'scheduled'
    })

    toast({
      title: "Shot Scheduled",
      description: `"${shot.name}" scheduled for ${formatDate(dropDate)}`
    })
  }

  const handleAddShot = (date) => {
    onCreateShot({
      scheduledDate: date.toISOString(),
      status: 'scheduled'
    })
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Unscheduled Shots */}
        <UnscheduledShots shots={shots} />

        {/* Calendar Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Button
                onClick={() => setCurrentDate(new Date())}
                variant="outline"
                size="sm"
              >
                Today
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-medium text-gray-500 border-r last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => (
                <div key={index} className="border-r last:border-r-0 border-b last:border-b-0">
                  <CalendarDay
                    date={date}
                    shots={shots}
                    onAddShot={handleAddShot}
                    isToday={date.toDateString() === today.toDateString()}
                    isCurrentMonth={date.getMonth() === currentMonth}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></div>
                <span>Issues (missing location, talent, or products)</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-gray-400" />
                <span>Drag shots from unscheduled to calendar days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DragOverlay>
        {activeShot && <CalendarShotCard shot={activeShot} />}
      </DragOverlay>
    </DndContext>
  )
}