import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Button = forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const baseStyles = cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
      // Default variant
      "bg-primary text-primary-foreground shadow hover:bg-primary/90": variant === "default",
      
      // Destructive variant
      "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90": variant === "destructive",
      
      // Outline variant
      "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground": variant === "outline",
      
      // Secondary variant
      "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80": variant === "secondary",
      
      // Ghost variant
      "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
      
      // Link variant
      "text-primary underline-offset-4 hover:underline": variant === "link",
      
      // Sizes
      "h-9 px-4 py-2": size === "default",
      "h-8 rounded-md px-3 text-xs": size === "sm",
      "h-10 rounded-md px-8": size === "lg",
      "h-9 w-9": size === "icon",
    },
    className
  );

  return (
    <button
      className={baseStyles}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button }; 