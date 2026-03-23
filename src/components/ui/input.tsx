import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, type, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-fv-text-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-3 py-2.5 rounded-md border text-sm text-fv-text bg-fv-surface transition-all duration-200",
            "placeholder:text-fv-text-dim",
            "border-fv-border focus:border-fv-ember focus:ring-2 focus:ring-fv-ember/20 focus:outline-none",
            error && "border-red-700 focus:border-red-600 focus:ring-red-700/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-fv-text-dim">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
