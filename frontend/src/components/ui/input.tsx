import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-12 w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                className
            )}
            {...props}
        />
    )
}

export { Input }
