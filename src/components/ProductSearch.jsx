import React, { useState } from 'react'
import { Search, Filter, X, Package, Grid, List } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useProductSearch } from '../hooks/useProductSearch'
import { cn } from '../lib/utils'
import LoadingSpinner from './LoadingSpinner'

export default function ProductSearch({ onProductSelect, selectedProducts = [], className = "" }) {
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false)
  
  const {
    searchQuery,
    filters,
    sortBy,
    products,
    facets,
    totalResults,
    searchTime,
    isLoading,
    updateSearchQuery,
    updateFilter,
    setSortBy,
    clearFilters
  } = useProductSearch()

  const handleProductClick = (product) => {
    if (onProductSelect) {
      onProductSelect(product)
    }
  }

  const isProductSelected = (productId) => {
    return selectedProducts.some(p => p.id === productId)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products, styles, colors..."
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
            className="pl-10"
            data-search-input
          />
          {searchQuery && (
            <button
              onClick={() => updateSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Filters</CardTitle>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="mens">Men's</SelectItem>
                    <SelectItem value="womens">Women's</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <Select value={filters.color} onValueChange={(value) => updateFilter('color', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Colors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Colors</SelectItem>
                    <SelectItem value="Black">Black</SelectItem>
                    <SelectItem value="Charcoal">Charcoal</SelectItem>
                    <SelectItem value="Navy">Navy</SelectItem>
                    <SelectItem value="Olive">Olive</SelectItem>
                    <SelectItem value="Grey">Grey</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filters.active} onValueChange={(value) => updateFilter('active', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value={true}>Active</SelectItem>
                    <SelectItem value={false}>Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="in-stock"
                  checked={filters.inStock}
                  onCheckedChange={(checked) => updateFilter('inStock', checked)}
                />
                <label htmlFor="in-stock" className="text-sm font-medium">
                  In Stock Only
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Header */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <div>
          {isLoading ? (
            "Searching..."
          ) : (
            `${totalResults} products found ${searchTime ? `in ${searchTime}ms` : ''}`
          )}
        </div>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="price">Price Low-High</SelectItem>
            <SelectItem value="stock_quantity">Stock Level</SelectItem>
            <SelectItem value="style_number">Style Number</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingSpinner text="Searching products..." />}

      {/* Results */}
      {!isLoading && (
        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-3"
        )}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              viewMode={viewMode}
              isSelected={isProductSelected(product.id)}
              onSelect={() => handleProductClick(product)}
            />
          ))}
        </div>
      )}

      {/* No Results */}
      {!isLoading && products.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search or filters
            </p>
            <Button onClick={clearFilters}>Clear Filters</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProductCard({ product, viewMode, isSelected, onSelect }) {
  if (viewMode === 'list') {
    return (
      <Card 
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <img
              src={product.images?.[0] || 'https://via.placeholder.com/80x80'}
              alt={product.name}
              className="w-16 h-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.style_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${product.price}</p>
                  <p className="text-sm text-gray-500">
                    Stock: {product.stock_quantity}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{product.color}</Badge>
                <Badge variant="outline">{product.size}</Badge>
                {!product.active && <Badge variant="destructive">Inactive</Badge>}
                {product.stock_quantity === 0 && <Badge variant="secondary">Out of Stock</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-colors hover:shadow-md",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/300x300'}
          alt={product.name}
          className="w-full h-48 object-cover rounded mb-3"
        />
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
          <p className="text-sm text-gray-500">{product.style_number}</p>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">${product.price}</span>
            <span className="text-sm text-gray-500">Stock: {product.stock_quantity}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">{product.color}</Badge>
            <Badge variant="outline" className="text-xs">{product.size}</Badge>
            {!product.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}