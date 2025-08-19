import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Users, 
  Plus,
  Edit,
  Trash2,
  Mail,
  Shield,
  Search,
  UserPlus,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '../lib/utils'
import { ROLES, ROLE_PERMISSIONS } from '../lib/constants'
import { useToast } from '../hooks/use-toast'

const ROLE_COLORS = {
  [ROLES.ADMIN]: 'bg-red-100 text-red-800',
  [ROLES.PRODUCER]: 'bg-blue-100 text-blue-800',
  [ROLES.EDITOR]: 'bg-green-100 text-green-800',
  [ROLES.VIEWER]: 'bg-gray-100 text-gray-800',
  [ROLES.CATALOG]: 'bg-purple-100 text-purple-800',
  [ROLES.WAREHOUSE]: 'bg-orange-100 text-orange-800'
}

function UserCard({ user, onEdit, onDelete, onToggleStatus, currentUserId }) {
  const isCurrentUser = user.id === currentUserId
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-gray-500" />
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900">
                {user.displayName || user.email}
                {isCurrentUser && (
                  <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                )}
              </h3>
              <p className="text-sm text-gray-600">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-xs", ROLE_COLORS[user.role])}>
                  {user.role}
                </Badge>
                <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(user)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            {!isCurrentUser && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleStatus(user)}
                >
                  {user.status === 'active' ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(user)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Joined: {new Date(user.joinedAt).toLocaleDateString()}</span>
            <span>Last Active: {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Never'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InviteUserModal({ onClose, onInvite, isLoading }) {
  const [formData, setFormData] = useState({
    email: '',
    role: ROLES.VIEWER,
    message: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.email.trim()) return
    
    onInvite(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Welcome Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md resize-none"
                rows={3}
                placeholder="Optional welcome message..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function EditUserModal({ user, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    role: user.role,
    status: user.status || 'active'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(user.id, formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Display Name</label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="User's display name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                value={user.email}
                disabled
                className="bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function PermissionMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Role</th>
                <th className="text-center p-2">Projects</th>
                <th className="text-center p-2">Products</th>
                <th className="text-center p-2">Talent</th>
                <th className="text-center p-2">Locations</th>
                <th className="text-center p-2">Pull Requests</th>
                <th className="text-center p-2">Warehouse</th>
                <th className="text-center p-2">Admin</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => (
                <tr key={role} className="border-b">
                  <td className="p-2">
                    <Badge className={cn("text-xs", ROLE_COLORS[role])}>
                      {role}
                    </Badge>
                  </td>
                  <td className="text-center p-2">
                    {permissions.projects?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.products?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.talent?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.locations?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.pullRequests?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.warehouse?.join(', ') || '—'}
                  </td>
                  <td className="text-center p-2">
                    {permissions.permissions?.length > 0 ? 'Full' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-xs text-gray-600">
          <p><strong>Permissions:</strong> create, read, update, delete, approve, respond, manage</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function UserManagement({ 
  users = [],
  currentUserId,
  onInviteUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  isLoading = false
}) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = filterRole === 'all' || user.role === filterRole
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleInviteUser = async (inviteData) => {
    try {
      await onInviteUser(inviteData)
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteData.email}`
      })
      setShowInviteModal(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      })
    }
  }

  const handleUpdateUser = async (userId, updates) => {
    try {
      await onUpdateUser(userId, updates)
      toast({
        title: "User Updated",
        description: "User information updated successfully"
      })
      setEditingUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      })
    }
  }

  const handleDeleteUser = async (user) => {
    if (!confirm(`Are you sure you want to delete ${user.displayName || user.email}?`)) {
      return
    }

    try {
      await onDeleteUser(user.id)
      toast({
        title: "User Deleted",
        description: "User has been removed from the organization"
      })
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to delete user",
        variant: "destructive"
      })
    }
  }

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    
    try {
      await onToggleUserStatus(user.id, newStatus)
      toast({
        title: "Status Updated",
        description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <p className="text-gray-600 mt-1">Manage organization members and their roles</p>
            </div>
            
            <Button onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Users Grid */}
          {filteredUsers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onEdit={setEditingUser}
                  onDelete={handleDeleteUser}
                  onToggleStatus={handleToggleStatus}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No users found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || filterRole !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Start by inviting your first team member'
                  }
                </p>
                {(!searchQuery && filterRole === 'all' && filterStatus === 'all') && (
                  <Button onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionMatrix />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUser}
          isLoading={isLoading}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}