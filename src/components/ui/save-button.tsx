import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveButtonProps extends ButtonProps {
  /** Show a spinner and disable the button while saving. */
  saving?: boolean;
}

/** The one Save button used across the app (small outline button, spinner while saving). */
export const SaveButton = React.forwardRef<HTMLButtonElement, SaveButtonProps>(
  ({ saving = false, disabled, className, children = "Save", type = "button", ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      size="sm"
      variant="outline"
      className={cn("h-8", className)}
      disabled={disabled || saving}
      {...props}
    >
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </Button>
  )
);
SaveButton.displayName = "SaveButton";
