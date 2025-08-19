import { Loader2 } from "lucide-react"
import { cn } from "../lib/utils"

export default function LoadingSpinner({ 
  className = "", 
  size = "default",
  text = ""
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-8 w-8", 
    lg: "h-12 w-12"
  }
  
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  )
}