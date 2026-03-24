"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent cursor-pointer",
  {
    variants: {
      variant: {
        // Primary ember button
        primary:
          "bg-fv-ember text-white hover:bg-fv-ember-bright shadow-lg shadow-fv-ember/20 hover:shadow-fv-ember/30 focus:ring-fv-ember",
        // Gold secondary
        gold:
          "bg-fv-gold text-fv-void hover:bg-fv-gold-bright shadow-lg shadow-fv-gold/20 focus:ring-fv-gold font-semibold",
        // Outline
        outline:
          "border border-fv-border bg-transparent text-fv-text hover:bg-fv-card hover:border-fv-border-bright focus:ring-fv-border",
        // Subtle
        ghost:
          "bg-transparent text-fv-text-muted hover:bg-fv-card hover:text-fv-text focus:ring-fv-border",
        // Danger
        danger:
          "bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-800/60 hover:text-red-200 focus:ring-red-800",
        // Cinematic (gradient)
        cinematic:
          "bg-gradient-to-r from-fv-ember to-fv-gold text-white font-semibold shadow-xl hover:shadow-2xl hover:from-fv-ember-bright hover:to-fv-gold-bright focus:ring-fv-gold",
        // Token (for token spend actions)
        token:
          "bg-fv-gold/10 border border-fv-gold/30 text-fv-gold hover:bg-fv-gold/20 hover:border-fv-gold/50 focus:ring-fv-gold",
      },
      size: {
        sm: "px-3 py-1.5 text-xs h-8",
        md: "px-4 py-2 text-sm h-9",
        lg: "px-6 py-2.5 text-base h-11",
        xl: "px-8 py-3.5 text-lg h-13",
        icon: "w-9 h-9 p-0",
        "icon-sm": "w-7 h-7 p-0 text-xs",
        "icon-lg": "w-11 h-11 p-0",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
