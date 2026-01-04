import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    {
        variants: {
            variant: {
                default: "bg-gradient-to-br from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5",
                destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
                outline: "border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white",
                secondary: "bg-slate-700 text-slate-100 shadow-sm hover:bg-slate-600",
                ghost: "text-slate-300 hover:bg-slate-800 hover:text-white",
                link: "text-primary underline-offset-4 hover:underline",
                success: "bg-gradient-to-br from-emerald-500 to-green-400 text-white shadow-lg hover:shadow-xl",
                warning: "bg-gradient-to-br from-amber-400 to-orange-400 text-slate-900 shadow-lg hover:shadow-xl",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-12 rounded-xl px-8 text-base",
                xl: "h-14 rounded-xl px-10 text-lg",
                icon: "h-10 w-10",
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
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean
    }) {
    const Comp = asChild ? Slot : "button"

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    )
}

export { Button, buttonVariants }
