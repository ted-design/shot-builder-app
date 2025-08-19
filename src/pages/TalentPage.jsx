import { useState } from "react"
import { useFirestoreCollection, useFirestoreAdd, useFirestoreUpdate, useFirestoreDelete } from "../hooks/useFirebaseQuery"
import { talentPath } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { 
  Users, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  User,
  Camera
} from "lucide-react"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const talentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
  rate: z.string().optional(),
  experience: z.string().optional(),
  specialties: z.string().optional(),
})

function TalentForm({ talent = null, onSave, onCancel, isLoading = false }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(talentSchema),
    defaultValues: {
      name: talent?.name || '',
      role: talent?.role || '',
      email: talent?.email || '',
      phone: talent?.phone || '',
      notes: talent?.notes || '',
      rate: talent?.rate || '',
      experience: talent?.experience || '',
      specialties: talent?.specialties || '',
    }
  })

  const onSubmit = (data) => {
    onSave({
      ...data,
      active: true,
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {talent ? 'Edit Talent' : 'Add New Talent'}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <Input {...register('name')} placeholder="Full name" />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <Input {...register('role')} placeholder="e.g., Model, Photographer, Stylist" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input {...register('email')} type="email" placeholder="email@example.com" />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <Input {...register('phone')} placeholder="+1 (555) 123-4567" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rate/Fee</label>
              <Input {...register('rate')} placeholder="e.g., $500/day" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Experience</label>
              <Input {...register('experience')} placeholder="Years of experience" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Specialties</label>
            <Input {...register('specialties')} placeholder="Fashion, Editorial, Commercial, etc." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea 
              {...register('notes')}
              placeholder="Additional notes about this talent"
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (talent ? 'Update Talent' : 'Add Talent')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TalentCard({ talent, onEdit, onDelete, isSelected, onSelect }) {
  return (
    <Card 
      className={`cursor-pointer transition-colors hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">{talent.name}</h3>
              {talent.role && (
                <p className="text-sm text-gray-600">{talent.role}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {talent.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {talent.email}
                  </div>
                )}
                {talent.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {talent.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(talent)
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(talent)
              }}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {talent.experience && (
            <Badge variant="secondary" className="text-xs">
              {talent.experience} exp
            </Badge>
          )}
          {talent.rate && (
            <Badge variant="outline" className="text-xs">
              {talent.rate}
            </Badge>
          )}
          {talent.specialties && (
            <Badge variant="outline" className="text-xs">
              {talent.specialties}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TalentPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuthContext()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTalent, setEditingTalent] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTalent, setSelectedTalent] = useState([])

  // Query talent
  const { data: allTalent = [], isLoading, error } = useFirestoreCollection(talentPath())

  // Mutations
  const createTalentMutation = useFirestoreAdd(talentPath())
  const updateTalentMutation = useFirestoreUpdate([...talentPath(), 'temp'])
  const deleteTalentMutation = useFirestoreDelete([...talentPath(), 'temp'])

  if (!hasPermission('talent', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view talent.</p>
      </div>
    )
  }

  // Filter talent based on search
  const filteredTalent = allTalent.filter(talent =>
    !searchQuery || 
    talent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    talent.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    talent.specialties?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateTalent = async (talentData) => {
    try {
      await createTalentMutation.mutateAsync(talentData)
      toast({
        title: "Success",
        description: "Talent added successfully"
      })
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating talent:', error)
      toast({
        title: "Error",
        description: "Failed to add talent",
        variant: "destructive"
      })
    }
  }

  const handleUpdateTalent = async (talentData) => {
    if (!editingTalent) return

    try {
      const talentPath_ = [...talentPath(), editingTalent.id]
      const mutation = useFirestoreUpdate(talentPath_)
      await mutation.mutateAsync(talentData)
      
      toast({
        title: "Success",
        description: "Talent updated successfully"
      })
      setEditingTalent(null)
    } catch (error) {
      console.error('Error updating talent:', error)
      toast({
        title: "Error",
        description: "Failed to update talent",
        variant: "destructive"
      })
    }
  }

  const handleDeleteTalent = async (talent) => {
    if (!confirm(`Are you sure you want to delete ${talent.name}?`)) return

    try {
      const talentPath_ = [...talentPath(), talent.id]
      const mutation = useFirestoreDelete(talentPath_)
      await mutation.mutateAsync()
      
      toast({
        title: "Success", 
        description: "Talent deleted successfully"
      })
    } catch (error) {
      console.error('Error deleting talent:', error)
      toast({
        title: "Error",
        description: "Failed to delete talent",
        variant: "destructive"
      })
    }
  }

  const handleTalentSelect = (talent) => {
    setSelectedTalent(prev => {
      const isSelected = prev.some(t => t.id === talent.id)
      if (isSelected) {
        return prev.filter(t => t.id !== talent.id)
      } else {
        return [...prev, talent]
      }
    })
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading talent..." />
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading talent: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Talent</h1>
          <p className="text-gray-600 mt-1">Manage models, photographers, and crew</p>
        </div>
        
        {hasPermission('talent', 'create') && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Talent
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search talent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedTalent.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedTalent.length} selected
            </span>
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedTalent([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTalent) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <TalentForm
            talent={editingTalent}
            onSave={editingTalent ? handleUpdateTalent : handleCreateTalent}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingTalent(null)
            }}
            isLoading={createTalentMutation.isPending || updateTalentMutation.isPending}
          />
        </div>
      )}

      {/* Talent List */}
      {filteredTalent.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTalent.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              onEdit={setEditingTalent}
              onDelete={handleDeleteTalent}
              isSelected={selectedTalent.some(t => t.id === talent.id)}
              onSelect={() => handleTalentSelect(talent)}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No talent match your search' : 'No talent yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Add talent to your database to get started'
              }
            </p>
            {hasPermission('talent', 'create') && !searchQuery && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Talent
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}