import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-12 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-4 py-2 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all",
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
