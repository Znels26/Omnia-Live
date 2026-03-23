import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-fv-border text-fv-text-muted",
        ember: "bg-fv-ember/15 text-fv-ember border border-fv-ember/30",
        gold: "bg-fv-gold/15 text-fv-gold border border-fv-gold/30",
        storm: "bg-fv-storm/15 text-fv-storm-bright border border-fv-storm/30",
        forest: "bg-fv-forest/15 text-fv-forest-bright border border-fv-forest/30",
        danger: "bg-red-900/30 text-red-400 border border-red-800/40",
        warning: "bg-yellow-900/30 text-yellow-400 border border-yellow-800/40",
        success: "bg-green-900/30 text-green-400 border border-green-800/40",
        premium: "bg-gradient-to-r from-fv-ember/20 to-fv-gold/20 text-fv-gold border border-fv-gold/30 font-display",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
