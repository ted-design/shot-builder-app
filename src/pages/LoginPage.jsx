import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithPopup, signInWithEmailLink, isSignInWithEmailLink } from "firebase/auth"
import { auth, provider } from "../firebase"
import { Button } from "../components/ui/button"
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { useState } from "react"
import { useToast } from "../hooks/use-toast"
import LoadingSpinner from "../components/LoadingSpinner"

export default function LoginPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    // Handle email link sign in
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn')
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn')
            navigate('/projects')
          })
          .catch((error) => {
            console.error('Email link sign in error:', error)
            toast({
              title: "Sign in failed", 
              description: error.message,
              variant: "destructive"
            })
          })
      }
    }

    // Redirect if already signed in
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        navigate("/projects", { replace: true })
      }
    })
    
    return () => unsubscribe()
  }, [navigate, toast])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithPopup(auth, provider)
      // Navigation will happen via the auth state change listener
    } catch (error) {
      console.error('Google sign in error:', error)
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignIn = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      // For now, we'll just show Google sign-in since we need to configure email links
      toast({
        title: "Email sign-in coming soon",
        description: "Please use Google sign-in for now",
      })
    } catch (error) {
      console.error('Email sign in error:', error)
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner text="Signing in..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-lg">SB</span>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Shot Builder</CardTitle>
          <p className="text-gray-600">Sign in to manage your shoots</p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn} 
            className="w-full"
            disabled={loading}
          >
            Continue with Google
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
            />
            <Button 
              onClick={handleEmailSignIn} 
              variant="outline" 
              className="w-full"
              disabled={loading}
            >
              Send Magic Link
            </Button>
          </div>
          
          {emailSent && (
            <div className="text-center text-sm text-green-600">
              Check your email for a sign-in link!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}