import { useState } from "react"
import { useFirestoreCollection, useFirestoreUpdate } from "../hooks/useFirebaseQuery"
import { membersPath, getCurrentOrgId } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { useToast } from "../hooks/use-toast"
import { useAuthContext } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import UserManagement from "../components/UserManagement"
import { 
  Settings, 
  Users, 
  Shield,
  Activity,
  Database,
  Bell,
  Globe,
  Lock,
  Palette,
  Mail
} from "lucide-react"
import { cn } from "../lib/utils"

function OrganizationSettings({ orgId, onUpdate }) {
  const [settings, setSettings] = useState({
    name: 'Unbound Merino',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    defaultRole: 'viewer',
    allowSelfSignup: false,
    requireApproval: true,
    emailNotifications: true,
    slackIntegration: false
  })

  const handleSave = () => {
    onUpdate(settings)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Organization Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Organization Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date Format</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => setSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security & Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Default Role for New Users</label>
            <select
              value={settings.defaultRole}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultRole: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="producer">Producer</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.allowSelfSignup}
                onChange={(e) => setSettings(prev => ({ ...prev, allowSelfSignup: e.target.checked }))}
              />
              <span className="text-sm font-medium">Allow self-signup</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.requireApproval}
                onChange={(e) => setSettings(prev => ({ ...prev, requireApproval: e.target.checked }))}
              />
              <span className="text-sm font-medium">Require admin approval for new users</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications & Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Email Notifications</span>
                <p className="text-xs text-gray-600">Send email updates for important events</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Slack Integration</span>
                <p className="text-xs text-gray-600">Send notifications to Slack channels</p>
              </div>
              <input
                type="checkbox"
                checked={settings.slackIntegration}
                onChange={(e) => setSettings(prev => ({ ...prev, slackIntegration: e.target.checked }))}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </div>
  )
}

function ActivityLog() {
  const mockActivities = [
    {
      id: 1,
      user: 'John Doe',
      action: 'Created pull request #PR-123456',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      type: 'pull_request'
    },
    {
      id: 2,
      user: 'Jane Smith',
      action: 'Updated shot "Hero Portrait"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      type: 'shot'
    },
    {
      id: 3,
      user: 'Mike Johnson',
      action: 'Added new talent "Sarah Wilson"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      type: 'talent'
    },
    {
      id: 4,
      user: 'Admin',
      action: 'Invited user alice@example.com',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      type: 'user'
    }
  ]

  const getActivityIcon = (type) => {
    switch (type) {
      case 'pull_request': return '📋'
      case 'shot': return '📸'
      case 'talent': return '👥'
      case 'user': return '👤'
      default: return '📝'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
              <div className="text-lg">{getActivityIcon(activity.type)}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.action}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{activity.user}</span>
                  <span>•</span>
                  <span>{activity.timestamp.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SystemStatus() {
  const stats = {
    totalUsers: 24,
    activeProjects: 8,
    totalShots: 156,
    pendingPullRequests: 3,
    storageUsed: '2.4 GB',
    storageLimit: '10 GB'
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalUsers}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.activeProjects}</div>
            <div className="text-sm text-gray-600">Active Projects</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalShots}</div>
            <div className="text-sm text-gray-600">Total Shots</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.pendingPullRequests}</div>
            <div className="text-sm text-gray-600">Pending PRs</div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600 mb-2">Storage Usage</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-medium">{stats.storageUsed}</span>
              <span className="text-sm text-gray-500">of {stats.storageLimit}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full" 
                style={{ width: '24%' }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ActivityLog />
    </div>
  )
}

export default function AdminPage() {
  const { toast } = useToast()
  const { role, user } = useAuthContext()
  const orgId = getCurrentOrgId()
  
  // Query organization members
  const { data: members = [], isLoading, error } = useFirestoreCollection(
    membersPath(orgId),
    []
  )

  if (role !== 'admin') {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">You don't have permission to access the admin panel.</p>
      </div>
    )
  }

  const handleInviteUser = async (inviteData) => {
    // Mock invite user - in real app this would call Firebase Cloud Function
    console.log('Inviting user:', inviteData)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    throw new Error('User invitation not yet implemented')
  }

  const handleUpdateUser = async (userId, updates) => {
    // Mock update user - in real app this would update Firestore and Firebase Auth
    console.log('Updating user:', userId, updates)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    throw new Error('User update not yet implemented')
  }

  const handleDeleteUser = async (userId) => {
    console.log('Deleting user:', userId)
    throw new Error('User deletion not yet implemented')
  }

  const handleToggleUserStatus = async (userId, status) => {
    console.log('Toggling user status:', userId, status)
    throw new Error('User status toggle not yet implemented')
  }

  const handleUpdateSettings = (settings) => {
    console.log('Updating organization settings:', settings)
    toast({
      title: "Settings Updated",
      description: "Organization settings have been saved"
    })
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading admin panel..." />
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading admin data: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and organization settings</p>
        </div>
        
        <Badge variant="outline" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Administrator
        </Badge>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserManagement
            users={members}
            currentUserId={user?.uid}
            onInviteUser={handleInviteUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onToggleUserStatus={handleToggleUserStatus}
            isLoading={false}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <OrganizationSettings
            orgId={orgId}
            onUpdate={handleUpdateSettings}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityLog />
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <SystemStatus />
        </TabsContent>
      </Tabs>
    </div>
  )
}