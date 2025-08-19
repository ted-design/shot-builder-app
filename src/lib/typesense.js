import Typesense from 'typesense'

// Typesense client configuration
// For development, we'll use mock data
// In production, this would connect to your Typesense server
const client = new Typesense.Client({
  'nodes': [{
    'host': 'localhost', // For production, use your Typesense server
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': 'xyz', // For production, use your admin API key
  'connectionTimeoutSeconds': 2
})

// Mock data for development since we don't have a Typesense server set up
const mockProducts = [
  {
    id: '1',
    name: 'Merino Wool Base Layer - Men\'s',
    category: 'mens',
    subcategory: 'base-layers',
    style_number: 'MW-BL-001',
    color: 'Black',
    size: 'M',
    gender: 'mens',
    active: true,
    stock_quantity: 15,
    price: 89.99,
    description: 'Premium merino wool base layer for active wear',
    images: ['https://picsum.photos/400/400?random=1'],
    tags: ['merino', 'wool', 'base-layer', 'active']
  },
  {
    id: '2', 
    name: 'Merino Wool Base Layer - Women\'s',
    category: 'womens',
    subcategory: 'base-layers',
    style_number: 'MW-BL-002',
    color: 'Charcoal',
    size: 'S',
    gender: 'womens',
    active: true,
    stock_quantity: 8,
    price: 89.99,
    description: 'Premium merino wool base layer designed for women',
    images: ['https://picsum.photos/400/400?random=2'],
    tags: ['merino', 'wool', 'base-layer', 'women']
  },
  {
    id: '3',
    name: 'Merino Wool Long Sleeve Tee',
    category: 'mens',
    subcategory: 'shirts',
    style_number: 'MW-LS-001', 
    color: 'Navy',
    size: 'L',
    gender: 'mens',
    active: true,
    stock_quantity: 12,
    price: 69.99,
    description: 'Comfortable merino wool long sleeve tee',
    images: ['https://picsum.photos/400/400?random=3'],
    tags: ['merino', 'wool', 'tee', 'long-sleeve']
  },
  {
    id: '4',
    name: 'Merino Wool Shorts',
    category: 'womens',
    subcategory: 'shorts',
    style_number: 'MW-SH-001',
    color: 'Olive',
    size: 'M',
    gender: 'womens', 
    active: true,
    stock_quantity: 6,
    price: 59.99,
    description: 'Lightweight merino wool shorts for summer',
    images: ['https://picsum.photos/400/400?random=4'],
    tags: ['merino', 'wool', 'shorts', 'summer']
  },
  {
    id: '5',
    name: 'Merino Wool Hoodie',
    category: 'unisex',
    subcategory: 'outerwear',
    style_number: 'MW-HD-001',
    color: 'Grey',
    size: 'XL',
    gender: 'unisex',
    active: false, // Out of stock example
    stock_quantity: 0,
    price: 129.99,
    description: 'Premium merino wool hoodie for outdoor activities',
    images: ['https://picsum.photos/400/400?random=5'],
    tags: ['merino', 'wool', 'hoodie', 'outerwear']
  }
]

// Mock search function that simulates Typesense search
export async function searchProducts(query = '', filters = {}, facets = []) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  let results = [...mockProducts]
  
  // Apply text search
  if (query) {
    const searchTerm = query.toLowerCase()
    results = results.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.style_number.toLowerCase().includes(searchTerm) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }
  
  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') {
      results = results.filter(product => {
        if (Array.isArray(value)) {
          return value.includes(product[key])
        }
        return product[key] === value
      })
    }
  })
  
  // Generate facet counts
  const facetCounts = {}
  if (facets.includes('category')) {
    facetCounts.category = {}
    mockProducts.forEach(product => {
      facetCounts.category[product.category] = (facetCounts.category[product.category] || 0) + 1
    })
  }
  if (facets.includes('color')) {
    facetCounts.color = {}
    mockProducts.forEach(product => {
      facetCounts.color[product.color] = (facetCounts.color[product.color] || 0) + 1
    })
  }
  if (facets.includes('active')) {
    facetCounts.active = {}
    mockProducts.forEach(product => {
      const status = product.active ? 'active' : 'inactive'
      facetCounts.active[status] = (facetCounts.active[status] || 0) + 1
    })
  }
  
  return {
    hits: results.map(product => ({ document: product })),
    found: results.length,
    facet_counts: facetCounts,
    search_time_ms: Math.floor(Math.random() * 50) + 10
  }
}

// Get product suggestions for autocomplete
export async function getProductSuggestions(query = '', limit = 5) {
  await new Promise(resolve => setTimeout(resolve, 50))
  
  if (!query) return []
  
  const searchTerm = query.toLowerCase()
  const suggestions = mockProducts
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.style_number.toLowerCase().includes(searchTerm)
    )
    .slice(0, limit)
    .map(product => ({
      text: product.name,
      value: product.id,
      style_number: product.style_number
    }))
  
  return suggestions
}

// Index a product (mock - in production this would sync to Typesense)
export async function indexProduct(product) {
  console.log('Indexing product:', product.name)
  // In production: await client.collections('products').documents().create(product)
  return true
}

// Delete a product from index (mock)
export async function deleteProductFromIndex(productId) {
  console.log('Removing product from index:', productId)
  // In production: await client.collections('products').documents(productId).delete()
  return true
}

export default client