import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "ember" | "gold" | "transparent";
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hoverable = false, children, ...props }, ref) => {
    const variants = {
      default: "bg-fv-card border border-fv-border",
      elevated: "bg-fv-card border border-fv-border shadow-2xl shadow-black/50",
      ember: "bg-fv-card border border-fv-ember/30 shadow-lg shadow-fv-ember/10",
      gold: "bg-fv-card border border-fv-gold/30 shadow-lg shadow-fv-gold/10",
      transparent: "bg-transparent border border-fv-border-subtle",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg",
          variants[variant],
          hoverable && "transition-all duration-200 hover:bg-fv-card-hover hover:border-fv-border-bright cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 py-4 border-b border-fv-border-subtle", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-display text-sm font-medium text-fv-moon tracking-wide uppercase", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 py-4", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-5 py-3 border-t border-fv-border-subtle flex items-center gap-3", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";
