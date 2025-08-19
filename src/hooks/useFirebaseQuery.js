import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query,
  onSnapshot
} from 'firebase/firestore'
import { useEffect } from 'react'
import { db } from '../firebase'

// Mock data for demo mode
const MOCK_DATA = {
  projects: [
    {
      id: 'project-1',
      name: 'Summer Campaign 2024',
      description: 'Summer product line photoshoot',
      status: 'active',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-20'
    },
    {
      id: 'project-2', 
      name: 'Fall Campaign 2024',
      description: 'Fall/Winter collection shoot',
      status: 'planning',
      createdAt: '2024-02-01',
      updatedAt: '2024-02-05'
    }
  ],
  shots: [
    {
      id: 'shot-1',
      name: 'Merino T-Shirt Hero',
      type: 'hero',
      status: 'ready',
      description: 'Hero shot for merino t-shirt',
      projectId: 'project-1',
      productIds: ['prod-1', 'prod-2'],
      talentIds: ['talent-1'],
      locationId: 'location-1',
      priority: 'high',
      scheduledDate: '2024-06-15',
      notes: 'Focus on texture and comfort',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-20'
    },
    {
      id: 'shot-2',
      name: 'Lifestyle Active Wear',
      type: 'lifestyle',
      status: 'scheduled',
      description: 'Active wear in outdoor setting',
      projectId: 'project-1',
      productIds: ['prod-3', 'prod-4'],
      talentIds: ['talent-1', 'talent-2'],
      locationId: 'location-2',
      priority: 'medium',
      scheduledDate: '2024-06-20',
      notes: 'Natural lighting preferred',
      createdAt: '2024-01-16',
      updatedAt: '2024-01-21'
    },
    {
      id: 'shot-3',
      name: 'Wool Sweater Detail',
      type: 'detail',
      status: 'draft',
      description: 'Close-up shots of wool texture',
      projectId: 'project-2',
      productIds: ['prod-5'],
      talentIds: [],
      locationId: null,
      priority: 'low',
      scheduledDate: null,
      notes: 'Macro lens required',
      createdAt: '2024-02-01',
      updatedAt: '2024-02-01'
    }
  ],
  products: [
    {
      id: 'prod-1',
      name: 'Merino T-Shirt - Navy',
      style_number: 'MT-001-NVY',
      category: 'mens',
      price: 95,
      description: 'Premium merino wool t-shirt'
    },
    {
      id: 'prod-2',
      name: 'Merino T-Shirt - Gray',
      style_number: 'MT-001-GRY',
      category: 'mens',
      price: 95,
      description: 'Premium merino wool t-shirt'
    },
    {
      id: 'prod-3',
      name: 'Active Shorts - Black',
      style_number: 'AS-002-BLK',
      category: 'unisex',
      price: 75,
      description: 'Performance active shorts'
    },
    {
      id: 'prod-4',
      name: 'Tank Top - White',
      style_number: 'TT-003-WHT',
      category: 'womens',
      price: 55,
      description: 'Lightweight merino tank'
    },
    {
      id: 'prod-5',
      name: 'Wool Sweater - Charcoal',
      style_number: 'WS-004-CHR',
      category: 'unisex',
      price: 175,
      description: 'Cozy wool sweater'
    }
  ],
  pullRequests: [
    {
      id: 'pr-1',
      number: 'PR-001',
      projectId: 'project-1',
      projectName: 'Summer Campaign 2024',
      status: 'submitted',
      priority: 'high',
      shotIds: ['shot-1'],
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 2,
          response: { status: 'fulfilled', quantityPicked: 2, notes: 'Items ready' }
        },
        {
          id: 'item-2',
          productId: 'prod-2',
          quantity: 1,
          response: { status: 'partial', quantityPicked: 1, notes: 'One size unavailable' }
        }
      ],
      createdAt: '2024-01-16',
      updatedAt: '2024-01-17',
      createdBy: { name: 'Demo User' }
    }
  ],
  talent: [
    {
      id: 'talent-1',
      name: 'Alex Johnson',
      type: 'model',
      email: 'alex@example.com'
    },
    {
      id: 'talent-2',
      name: 'Sarah Chen',
      type: 'model',
      email: 'sarah@example.com'
    }
  ],
  locations: [
    {
      id: 'location-1',
      name: 'Studio A',
      type: 'studio',
      address: '123 Photo St, New York, NY'
    },
    {
      id: 'location-2',
      name: 'Central Park',
      type: 'outdoor',
      address: 'Central Park, New York, NY'
    }
  ]
}

// Check if we're in demo mode
function isDemoMode() {
  return window.location.search.includes('demo=true')
}

/**
 * Hook for real-time Firestore collection queries with TanStack Query
 */
export function useFirestoreCollection(path, queryConstraints = [], options = {}) {
  const queryKey = ['firestore', 'collection', ...path, JSON.stringify(queryConstraints)]
  const queryClient = useQueryClient()
  
  // Mock data for demo mode
  if (isDemoMode()) {
    const collectionName = path[path.length - 1]
    let mockData = []
    
    switch (collectionName) {
      case 'projects':
        mockData = MOCK_DATA.projects
        break
      case 'shots':
        mockData = MOCK_DATA.shots
        break
      case 'products':
        mockData = MOCK_DATA.products
        break
      case 'pullRequests':
        mockData = MOCK_DATA.pullRequests
        break
      case 'talent':
        mockData = MOCK_DATA.talent
        break
      case 'locations':
        mockData = MOCK_DATA.locations
        break
      default:
        mockData = []
    }
    
    return useQuery({
      queryKey,
      queryFn: async () => mockData,
      ...options
    })
  }
  
  useEffect(() => {
    const collectionRef = collection(db, ...path)
    const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        queryClient.setQueryData(queryKey, data)
      },
      (error) => {
        console.error('Firestore collection error:', error)
        queryClient.setQueryData(queryKey, [])
      }
    )
    
    return () => unsubscribe()
  }, [JSON.stringify(path), JSON.stringify(queryConstraints)])
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const collectionRef = collection(db, ...path)
      const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    },
    ...options
  })
}

/**
 * Hook for real-time Firestore document queries
 */
export function useFirestoreDocument(path, options = {}) {
  const queryKey = ['firestore', 'document', ...path]
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const docRef = doc(db, ...path)
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.exists() ? {
          id: snapshot.id,
          ...snapshot.data()
        } : null
        queryClient.setQueryData(queryKey, data)
      },
      (error) => {
        console.error('Firestore document error:', error)
        queryClient.setQueryData(queryKey, null)
      }
    )
    
    return () => unsubscribe()
  }, [JSON.stringify(path)])
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const docRef = doc(db, ...path)
      const snapshot = await getDoc(docRef)
      return snapshot.exists() ? {
        id: snapshot.id,
        ...snapshot.data()
      } : null
    },
    ...options
  })
}

/**
 * Mutation hooks for Firestore operations
 */
export function useFirestoreAdd(path) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      if (isDemoMode()) {
        // Mock successful add in demo mode
        const newItem = { id: `demo-${Date.now()}`, ...data }
        return newItem
      }
      
      const collectionRef = collection(db, ...path)
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return { id: docRef.id, ...data }
    },
    onSuccess: () => {
      // Invalidate collection queries
      queryClient.invalidateQueries(['firestore', 'collection', ...path])
    }
  })
}

export function useFirestoreUpdate(path) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      if (isDemoMode()) {
        // Mock successful update in demo mode
        return data
      }
      
      const docRef = doc(db, ...path)
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      })
      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries(['firestore', 'document', ...path])
      queryClient.invalidateQueries(['firestore', 'collection', ...path.slice(0, -1)])
    }
  })
}

export function useFirestoreDelete(path) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        // Mock successful delete in demo mode
        return true
      }
      
      const docRef = doc(db, ...path)
      await deleteDoc(docRef)
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries(['firestore', 'document', ...path])
      queryClient.invalidateQueries(['firestore', 'collection', ...path.slice(0, -1)])
    }
  })
}