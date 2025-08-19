import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Camera, 
  Package, 
  Users, 
  MapPin, 
  FileText,
  X 
} from 'lucide-react'
import { useFirestoreCollection } from '../hooks/useFirebaseQuery'
import { productsPath, talentPath, locationsPath } from '../lib/paths'
import ProductSearch from './ProductSearch'

const shotSchema = z.object({
  name: z.string().min(1, 'Shot name is required'),
  description: z.string().optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  locationId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().optional(),
})

export default function ShotForm({
  shot = null,
  onSave,
  onCancel,
  isLoading = false
}) {
  const [selectedProducts, setSelectedProducts] = useState(shot?.productIds || [])
  const [selectedTalent, setSelectedTalent] = useState(shot?.talentIds || [])
  const [showProductSearch, setShowProductSearch] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(shotSchema),
    defaultValues: {
      name: shot?.name || '',
      description: shot?.description || '',
      type: shot?.type || '',
      date: shot?.date || '',
      locationId: shot?.locationId || '',
      priority: shot?.priority || 'medium',
      notes: shot?.notes || '',
    }
  })

  // Load reference data
  const { data: allProducts = [] } = useFirestoreCollection(productsPath())
  const { data: allTalent = [] } = useFirestoreCollection(talentPath())
  const { data: allLocations = [] } = useFirestoreCollection(locationsPath())

  // Get selected items
  const selectedProductsData = allProducts.filter(p => selectedProducts.includes(p.id))
  const selectedTalentData = allTalent.filter(t => selectedTalent.includes(t.id))

  useEffect(() => {
    if (shot) {
      reset({
        name: shot.name || '',
        description: shot.description || '',
        type: shot.type || '',
        date: shot.date || '',
        locationId: shot.locationId || '',
        priority: shot.priority || 'medium',
        notes: shot.notes || '',
      })
      setSelectedProducts(shot.productIds || [])
      setSelectedTalent(shot.talentIds || [])
    }
  }, [shot, reset])

  const onSubmit = (data) => {
    const shotData = {
      ...data,
      productIds: selectedProducts,
      talentIds: selectedTalent,
      status: shot?.status || 'draft',
      active: true,
    }

    onSave(shotData)
  }

  const handleProductSelect = (product) => {
    setSelectedProducts(prev => {
      if (prev.includes(product.id)) {
        return prev.filter(id => id !== product.id)
      } else {
        return [...prev, product.id]
      }
    })
  }

  const removeProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(id => id !== productId))
  }

  const removeTalent = (talentId) => {
    setSelectedTalent(prev => prev.filter(id => id !== talentId))
  }

  const toggleTalent = (talentId) => {
    setSelectedTalent(prev => {
      if (prev.includes(talentId)) {
        return prev.filter(id => id !== talentId)
      } else {
        return [...prev, talentId]
      }
    })
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {shot ? 'Edit Shot' : 'Create New Shot'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="products">Products ({selectedProducts.length})</TabsTrigger>
              <TabsTrigger value="talent">Talent ({selectedTalent.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Shot Name *</label>
                  <Input {...register('name')} placeholder="Enter shot name" />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Shot Type</label>
                  <Input {...register('type')} placeholder="e.g., Portrait, Lifestyle, Product" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Shoot Date</label>
                  <Input {...register('date')} type="date" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select 
                    {...register('priority')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <select 
                    {...register('locationId')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select location...</option>
                    {allLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea 
                    {...register('description')}
                    placeholder="Brief description of the shot"
                    className="w-full p-3 border border-gray-300 rounded-md resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Selected Products</h3>
                <Button 
                  type="button"
                  onClick={() => setShowProductSearch(true)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Add Products
                </Button>
              </div>

              {selectedProductsData.length > 0 ? (
                <div className="grid gap-3">
                  {selectedProductsData.map((product) => (
                    <div 
                      key={product.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.style_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{product.color}</Badge>
                        <Badge variant="outline">{product.size}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(product.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No products selected</p>
                  <Button 
                    type="button"
                    variant="outline" 
                    className="mt-2"
                    onClick={() => setShowProductSearch(true)}
                  >
                    Add Products
                  </Button>
                </div>
              )}

              {showProductSearch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-lg max-w-6xl w-full max-h-[80vh] overflow-hidden">
                    <div className="p-4 border-b">
                      <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Select Products</h2>
                        <Button 
                          variant="ghost" 
                          onClick={() => setShowProductSearch(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 overflow-y-auto">
                      <ProductSearch 
                        onProductSelect={handleProductSelect}
                        selectedProducts={selectedProductsData}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="talent" className="space-y-4">
              <h3 className="text-lg font-medium">Select Talent</h3>
              
              {allTalent.length > 0 ? (
                <div className="grid gap-3">
                  {allTalent.map((talent) => (
                    <div 
                      key={talent.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTalent.includes(talent.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleTalent(talent.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">{talent.name}</p>
                          <p className="text-sm text-gray-600">{talent.role || 'Talent'}</p>
                        </div>
                      </div>
                      {selectedTalent.includes(talent.id) && (
                        <Badge>Selected</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No talent available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea 
                  {...register('notes')}
                  placeholder="Additional notes, instructions, or requirements for this shot"
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={8}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (shot ? 'Update Shot' : 'Create Shot')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}