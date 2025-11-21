import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // --- 1. The Base Shape ---
          "relative rounded-xl overflow-hidden",
          
          // --- 2. The Glass Effect (The Magic) ---
          // We use bg-card (which changes per theme) but make it 40% opaque
          // This lets the pink or slate background bleed through!
          "bg-card/40",
          
          // The Blur: This makes the text readable
          "backdrop-blur-md", 
          
          // --- 3. The Border (The Lip Liner) ---
          // We use a very subtle border so it doesn't look messy
          "border border-border/50 shadow-sm",
          
          // --- 4. Text Colors ---
          "text-card-foreground",
          
          // Allow overriding classes if you need to
          className
        )}
        {...props}
      >
        {/* Optional: A subtle white gradient on top for extra 'gloss' */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        
        {/* The Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }
