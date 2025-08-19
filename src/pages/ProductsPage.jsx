import { useState } from "react"
import { useFirestoreCollection, useFirestoreAdd } from "../hooks/useFirebaseQuery"
import { productsPath } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import ProductSearch from "../components/ProductSearch"
import { Plus, Package, Upload, Download } from "lucide-react"
import { Badge } from "../components/ui/badge"

export default function ProductsPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuthContext()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [viewMode, setViewMode] = useState('search') // 'search' or 'manage'
  
  const [formData, setFormData] = useState({
    name: "",
    category: "mens",
    subcategory: "",
    style_number: "",
    color: "",
    size: "",
    price: "",
    description: "",
    stock_quantity: "",
    active: true
  })

  // Query all products for management view
  const { data: allProducts = [], isLoading: loadingProducts } = useFirestoreCollection(
    productsPath(),
    [],
    { enabled: viewMode === 'manage' }
  )

  // Create product mutation
  const createProductMutation = useFirestoreAdd(productsPath())

  if (!hasPermission('products', 'read')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to view products.</p>
      </div>
    )
  }

  const handleCreateProduct = async () => {
    if (!formData.name.trim() || !formData.style_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name and style number are required",
        variant: "destructive"
      })
      return
    }

    try {
      const newProduct = {
        ...formData,
        name: formData.name.trim(),
        style_number: formData.style_number.trim(),
        price: parseFloat(formData.price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        images: [],
        tags: formData.name.toLowerCase().split(' ')
      }

      await createProductMutation.mutateAsync(newProduct)

      toast({
        title: "Success",
        description: "Product created successfully"
      })

      // Reset form
      setFormData({
        name: "",
        category: "mens",
        subcategory: "",
        style_number: "",
        color: "",
        size: "",
        price: "",
        description: "",
        stock_quantity: "",
        active: true
      })
      setShowCreateForm(false)

    } catch (error) {
      console.error('Error creating product:', error)
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive"
      })
    }
  }

  const handleProductSelect = (product) => {
    setSelectedProducts(prev => {
      const isSelected = prev.some(p => p.id === product.id)
      if (isSelected) {
        return prev.filter(p => p.id !== product.id)
      } else {
        return [...prev, product]
      }
    })
  }

  const clearSelection = () => {
    setSelectedProducts([])
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">
            Search and manage product catalog with advanced filtering
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'search' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('search')}
              className="rounded-r-none"
            >
              Search
            </Button>
            <Button
              variant={viewMode === 'manage' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('manage')}
              className="rounded-l-none"
            >
              Manage
            </Button>
          </div>

          {hasPermission('products', 'create') && (
            <>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selected Products Bar */}
      {selectedProducts.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-1">
                  {selectedProducts.slice(0, 3).map(product => (
                    <Badge key={product.id} variant="secondary" className="text-xs">
                      {product.style_number}
                    </Badge>
                  ))}
                  {selectedProducts.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedProducts.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Product Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                placeholder="Product name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
              
              <Input
                placeholder="Style number"
                value={formData.style_number}
                onChange={(e) => setFormData(prev => ({ ...prev, style_number: e.target.value }))}
              />

              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="mens">Men's</option>
                <option value="womens">Women's</option>
                <option value="unisex">Unisex</option>
              </select>

              <Input
                placeholder="Subcategory"
                value={formData.subcategory}
                onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
              />

              <Input
                placeholder="Color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              />

              <Input
                placeholder="Size"
                value={formData.size}
                onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
              />

              <Input
                type="number"
                step="0.01"
                placeholder="Price"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              />

              <Input
                type="number"
                placeholder="Stock quantity"
                value={formData.stock_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
              />
            </div>

            <textarea
              placeholder="Product description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={3}
            />

            <div className="flex gap-2">
              <Button 
                onClick={handleCreateProduct}
                disabled={createProductMutation.isPending}
              >
                {createProductMutation.isPending ? "Creating..." : "Create Product"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content based on view mode */}
      {viewMode === 'search' ? (
        <ProductSearch 
          onProductSelect={handleProductSelect}
          selectedProducts={selectedProducts}
        />
      ) : (
        <div className="space-y-4">
          {loadingProducts ? (
            <LoadingSpinner text="Loading products..." />
          ) : allProducts.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No products yet</h3>
                <p className="text-gray-600 mb-4">Add your first product to get started</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allProducts.map((product) => (
                <Card 
                  key={product.id}
                  className={`cursor-pointer transition-colors hover:shadow-md ${
                    selectedProducts.some(p => p.id === product.id) 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : ''
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-500">{product.style_number}</p>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">${product.price}</span>
                        <span className="text-sm text-gray-500">Stock: {product.stock_quantity}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{product.category}</Badge>
                        {product.color && <Badge variant="outline" className="text-xs">{product.color}</Badge>}
                        {!product.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}