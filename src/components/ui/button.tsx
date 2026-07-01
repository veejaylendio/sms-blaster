import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-300 outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(168,150,255,0.3)] hover:shadow-[0_0_25px_rgba(168,150,255,0.5)]",
        outline:
          "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 hover:text-white",
        secondary:
          "bg-white/5 text-white hover:bg-white/10 border border-white/5",
        ghost:
          "text-text-muted hover:text-white hover:bg-white/5",
        destructive:
          "bg-destructive/20 text-destructive border border-destructive/20 hover:bg-destructive/30 hover:border-destructive/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        xs: "h-7 px-3 text-xs rounded-lg",
        sm: "h-9 px-4 text-sm rounded-lg",
        lg: "h-12 px-8 text-base rounded-2xl",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
