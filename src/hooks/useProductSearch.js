import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchProducts, getProductSuggestions } from '../lib/typesense'
import { debounce } from '../lib/utils'

export function useProductSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    category: 'all',
    color: 'all', 
    active: 'all',
    inStock: false
  })
  const [sortBy, setSortBy] = useState('name')

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      setSearchQuery(query)
    }, 300),
    []
  )

  // Main search query
  const { 
    data: searchResults, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['productSearch', searchQuery, filters, sortBy],
    queryFn: async () => {
      const appliedFilters = { ...filters }
      
      // Apply stock filter
      if (filters.inStock) {
        appliedFilters.stock_quantity_gt = 0
      }
      
      const results = await searchProducts(
        searchQuery,
        appliedFilters,
        ['category', 'color', 'active']
      )
      
      // Apply sorting
      if (sortBy && results.hits) {
        results.hits.sort((a, b) => {
          const aVal = a.document[sortBy]
          const bVal = b.document[sortBy]
          
          if (sortBy === 'price') {
            return aVal - bVal
          }
          if (sortBy === 'stock_quantity') {
            return bVal - aVal // Descending for stock
          }
          return aVal?.toString().localeCompare(bVal?.toString()) || 0
        })
      }
      
      return results
    },
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Update search query with debouncing
  const updateSearchQuery = useCallback((query) => {
    debouncedSearch(query)
  }, [debouncedSearch])

  // Update filters
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      category: 'all',
      color: 'all',
      active: 'all', 
      inStock: false
    })
    setSearchQuery('')
  }, [])

  return {
    // State
    searchQuery,
    filters,
    sortBy,
    
    // Results
    products: searchResults?.hits?.map(hit => hit.document) || [],
    facets: searchResults?.facet_counts || {},
    totalResults: searchResults?.found || 0,
    searchTime: searchResults?.search_time_ms || 0,
    
    // Loading states
    isLoading,
    error,
    
    // Actions
    updateSearchQuery,
    updateFilter,
    setSortBy,
    clearFilters,
    refetch
  }
}

// Hook for product suggestions/autocomplete
export function useProductSuggestions() {
  const [query, setQuery] = useState('')
  
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['productSuggestions', query],
    queryFn: () => getProductSuggestions(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2 // 2 minutes
  })
  
  return {
    suggestions,
    isLoading,
    setQuery
  }
}