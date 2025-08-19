import { useState } from "react"
import { useFirestoreCollection, useFirestoreAdd, useFirestoreUpdate, useFirestoreDelete } from "../hooks/useFirebaseQuery"
import { locationsPath } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { 
  MapPin, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Navigation,
  Clock,
  DollarSign,
  Camera
} from "lucide-react"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().optional(),
  type: z.string().optional(),
  capacity: z.string().optional(),
  rate: z.string().optional(),
  availability: z.string().optional(),
  notes: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  amenities: z.string().optional(),
})

function LocationForm({ location = null, onSave, onCancel, isLoading = false }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name || '',
      address: location?.address || '',
      type: location?.type || '',
      capacity: location?.capacity || '',
      rate: location?.rate || '',
      availability: location?.availability || '',
      notes: location?.notes || '',
      contact_name: location?.contact_name || '',
      contact_phone: location?.contact_phone || '',
      contact_email: location?.contact_email || '',
      amenities: location?.amenities || '',
    }
  })

  const onSubmit = (data) => {
    onSave({
      ...data,
      active: true,
    })
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {location ? 'Edit Location' : 'Add New Location'}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Location Name *</label>
                <Input {...register('name')} placeholder="Studio, Park, Office, etc." />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select 
                  {...register('type')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type...</option>
                  <option value="studio">Photo Studio</option>
                  <option value="outdoor">Outdoor Location</option>
                  <option value="office">Office/Corporate</option>
                  <option value="retail">Retail Space</option>
                  <option value="residential">Residential</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Address</label>
                <Input {...register('address')} placeholder="Full street address" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capacity</label>
                <Input {...register('capacity')} placeholder="e.g., 10 people, 500 sq ft" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rate</label>
                <Input {...register('rate')} placeholder="e.g., $200/hour, $1500/day" />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Contact Name</label>
                <Input {...register('contact_name')} placeholder="Location manager" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <Input {...register('contact_phone')} placeholder="+1 (555) 123-4567" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input {...register('contact_email')} type="email" placeholder="contact@location.com" />
                {errors.contact_email && (
                  <p className="text-red-500 text-sm mt-1">{errors.contact_email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Additional Details</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">Amenities</label>
              <Input 
                {...register('amenities')} 
                placeholder="WiFi, Parking, Catering Kitchen, Green Screen, etc." 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Availability</label>
              <Input 
                {...register('availability')} 
                placeholder="Mon-Fri 9AM-5PM, Weekends by appointment" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea 
                {...register('notes')}
                placeholder="Special instructions, restrictions, equipment available, etc."
                className="w-full p-3 border border-gray-300 rounded-md resize-none"
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (location ? 'Update Location' : 'Add Location')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function LocationCard({ location, onEdit, onDelete, isSelected, onSelect }) {
  return (
    <Card 
      className={`cursor-pointer transition-colors hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
              <MapPin className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">{location.name}</h3>
              {location.type && (
                <p className="text-sm text-gray-600 capitalize">{location.type}</p>
              )}
              {location.address && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{location.address}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(location)
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(location)
              }}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {location.capacity && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Navigation className="h-3 w-3" />
              Capacity: {location.capacity}
            </div>
          )}
          
          {location.rate && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <DollarSign className="h-3 w-3" />
              {location.rate}
            </div>
          )}
          
          {location.availability && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              {location.availability}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {location.type && (
            <Badge variant="secondary" className="text-xs capitalize">
              {location.type}
            </Badge>
          )}
          {location.amenities && location.amenities.split(',').slice(0, 2).map((amenity, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {amenity.trim()}
            </Badge>
          ))}
          {location.amenities && location.amenities.split(',').length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{location.amenities.split(',').length - 2} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function LocationsPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuthContext()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocations, setSelectedLocations] = useState([])

  // Query locations
  const { data: allLocations = [], isLoading, error } = useFirestoreCollection(locationsPath())

  // Mutations
  const createLocationMutation = useFirestoreAdd(locationsPath())
  const updateLocationMutation = useFirestoreUpdate([...locationsPath(), 'temp'])
  const deleteLocationMutation = useFirestoreDelete([...locationsPath(), 'temp'])

  if (!hasPermission('locations', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view locations.</p>
      </div>
    )
  }

  // Filter locations based on search
  const filteredLocations = allLocations.filter(location =>
    !searchQuery || 
    location.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.amenities?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateLocation = async (locationData) => {
    try {
      await createLocationMutation.mutateAsync(locationData)
      toast({
        title: "Success",
        description: "Location added successfully"
      })
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating location:', error)
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive"
      })
    }
  }

  const handleUpdateLocation = async (locationData) => {
    if (!editingLocation) return

    try {
      const locationPath_ = [...locationsPath(), editingLocation.id]
      const mutation = useFirestoreUpdate(locationPath_)
      await mutation.mutateAsync(locationData)
      
      toast({
        title: "Success",
        description: "Location updated successfully"
      })
      setEditingLocation(null)
    } catch (error) {
      console.error('Error updating location:', error)
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive"
      })
    }
  }

  const handleDeleteLocation = async (location) => {
    if (!confirm(`Are you sure you want to delete ${location.name}?`)) return

    try {
      const locationPath_ = [...locationsPath(), location.id]
      const mutation = useFirestoreDelete(locationPath_)
      await mutation.mutateAsync()
      
      toast({
        title: "Success", 
        description: "Location deleted successfully"
      })
    } catch (error) {
      console.error('Error deleting location:', error)
      toast({
        title: "Error",
        description: "Failed to delete location",
        variant: "destructive"
      })
    }
  }

  const handleLocationSelect = (location) => {
    setSelectedLocations(prev => {
      const isSelected = prev.some(l => l.id === location.id)
      if (isSelected) {
        return prev.filter(l => l.id !== location.id)
      } else {
        return [...prev, location]
      }
    })
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading locations..." />
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading locations: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-600 mt-1">Manage shoot locations and venues</p>
        </div>
        
        {hasPermission('locations', 'create') && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedLocations.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedLocations.length} selected
            </span>
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedLocations([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingLocation) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <LocationForm
            location={editingLocation}
            onSave={editingLocation ? handleUpdateLocation : handleCreateLocation}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingLocation(null)
            }}
            isLoading={createLocationMutation.isPending || updateLocationMutation.isPending}
          />
        </div>
      )}

      {/* Locations List */}
      {filteredLocations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onEdit={setEditingLocation}
              onDelete={handleDeleteLocation}
              isSelected={selectedLocations.some(l => l.id === location.id)}
              onSelect={() => handleLocationSelect(location)}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No locations match your search' : 'No locations yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Add locations to your database to get started'
              }
            </p>
            {hasPermission('locations', 'create') && !searchQuery && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}