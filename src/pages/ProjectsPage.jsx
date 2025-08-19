import { useState } from "react"
import { useFirestoreCollection, useFirestoreAdd } from "../hooks/useFirebaseQuery"
import { projectsPath } from "../lib/paths"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useToast } from "../hooks/use-toast"
import LoadingSpinner from "../components/LoadingSpinner"
import { Plus, Calendar, FileText } from "lucide-react"

export default function ProjectsPage() {
  const { toast } = useToast()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    shootDates: [""],
    briefUrl: ""
  })

  // Query projects
  const { data: projects = [], isLoading, error } = useFirestoreCollection(
    projectsPath(),
    []
  )

  // Create project mutation
  const createProjectMutation = useFirestoreAdd(projectsPath())

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive"
      })
      return
    }

    try {
      const shootDates = formData.shootDates.filter(date => date.trim())
      
      await createProjectMutation.mutateAsync({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        briefUrl: formData.briefUrl.trim(),
        shootDates,
        status: 'active'
      })

      toast({
        title: "Success",
        description: "Project created successfully"
      })

      // Reset form
      setFormData({
        name: "",
        description: "",
        shootDates: [""],
        briefUrl: ""
      })
      setShowCreateForm(false)

    } catch (error) {
      console.error('Error creating project:', error)
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive"
      })
    }
  }

  const addDateField = () => {
    setFormData(prev => ({
      ...prev,
      shootDates: [...prev.shootDates, ""]
    }))
  }

  const updateDate = (index, value) => {
    setFormData(prev => ({
      ...prev,
      shootDates: prev.shootDates.map((date, i) => i === index ? value : date)
    }))
  }

  const removeDate = (index) => {
    setFormData(prev => ({
      ...prev,
      shootDates: prev.shootDates.filter((_, i) => i !== index)
    }))
  }

  const setActiveProject = (projectId) => {
    localStorage.setItem('ACTIVE_PROJECT_ID', projectId)
    toast({
      title: "Active Project Set",
      description: "Project is now active for shots and planner"
    })
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading projects..." />
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading projects: {error.message}</p>
      </div>
    )
  }

  const activeProjectId = localStorage.getItem('ACTIVE_PROJECT_ID')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your photo shoot projects</p>
        </div>
        
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Project name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            
            <textarea
              placeholder="Project description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={3}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Shoot Dates</label>
              {formData.shootDates.map((date, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => updateDate(index, e.target.value)}
                    className="flex-1"
                  />
                  {formData.shootDates.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDate(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addDateField}
              >
                Add Date
              </Button>
            </div>

            <Input
              placeholder="Brief URL (optional)"
              value={formData.briefUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, briefUrl: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button 
                onClick={handleCreateProject}
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
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

      {/* Projects List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const isActive = activeProjectId === project.id
          const nextShootDate = project.shootDates?.length ? project.shootDates[0] : null
          
          return (
            <Card key={project.id} className={isActive ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  {isActive && (
                    <span className="px-2 py-1 text-xs bg-primary text-white rounded-full">
                      Active
                    </span>
                  )}
                </div>
                
                {project.description && (
                  <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                )}
                
                {nextShootDate && (
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Calendar className="h-4 w-4 mr-1" />
                    Next shoot: {new Date(nextShootDate).toLocaleDateString()}
                  </div>
                )}
                
                {project.briefUrl && (
                  <div className="flex items-center text-sm mb-3">
                    <FileText className="h-4 w-4 mr-1" />
                    <a 
                      href={project.briefUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View Brief
                    </a>
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  {!isActive && (
                    <Button 
                      size="sm" 
                      onClick={() => setActiveProject(project.id)}
                    >
                      Set Active
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {projects.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}