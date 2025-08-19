// Application constants
export const ROLES = {
  ADMIN: 'admin',
  PRODUCER: 'producer', 
  EDITOR: 'editor',
  VIEWER: 'viewer',
  CATALOG: 'catalog',
  WAREHOUSE: 'warehouse'
}

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    projects: ['create', 'read', 'update', 'delete'],
    products: ['create', 'read', 'update', 'delete'],
    talent: ['create', 'read', 'update', 'delete'],
    locations: ['create', 'read', 'update', 'delete'],
    pullRequests: ['create', 'read', 'update', 'delete', 'approve'],
    warehouse: ['create', 'read', 'update', 'delete', 'respond'],
    permissions: ['manage']
  },
  [ROLES.PRODUCER]: {
    projects: ['create', 'read', 'update'],
    products: ['read'],
    talent: ['create', 'read', 'update'],
    locations: ['create', 'read', 'update'],
    pullRequests: ['create', 'read', 'update', 'approve'],
    warehouse: ['read', 'respond'],
    permissions: []
  },
  [ROLES.EDITOR]: {
    projects: ['create', 'read', 'update'],
    products: ['read'],
    talent: ['create', 'read', 'update'],
    locations: ['create', 'read', 'update'],
    pullRequests: ['create', 'read', 'update'],
    warehouse: [],
    permissions: []
  },
  [ROLES.VIEWER]: {
    projects: ['read'],
    products: ['read'],
    talent: ['read'],
    locations: ['read'],
    pullRequests: ['read'],
    warehouse: [],
    permissions: []
  },
  [ROLES.CATALOG]: {
    projects: ['read'],
    products: ['create', 'read', 'update'],
    talent: [],
    locations: [],
    pullRequests: ['read'],
    warehouse: [],
    permissions: []
  },
  [ROLES.WAREHOUSE]: {
    projects: ['read'],
    products: [],
    talent: [],
    locations: [],
    pullRequests: ['read', 'respond'],
    warehouse: ['read', 'respond'],
    permissions: []
  }
}

export const SHOT_STATUSES = {
  DRAFT: 'draft',
  READY: 'ready', 
  SCHEDULED: 'scheduled',
  SHOT: 'shot',
  WRAPPED: 'wrapped'
}

export const PULL_REQUEST_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  FULFILLED: 'fulfilled',
  APPROVED: 'approved'
}

export const PRODUCT_CATEGORIES = {
  MENS: 'mens',
  WOMENS: 'womens',
  UNISEX: 'unisex'
}

export const KEYBOARD_SHORTCUTS = {
  NEW_SHOT: 'n',
  SEARCH: '/',
  SAVE: 'ctrl+s',
  ESCAPE: 'escape'
}