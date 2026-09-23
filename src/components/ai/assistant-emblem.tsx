import React from "react";
import { InfinityLoop } from "@/components/ui/infinity-loop";

/**
 * AssistantEmblem: Infinity Loop brand mark for Flow Assistant
 */
export function AssistantEmblem({ className = "w-4 h-4", ...props }: React.ComponentProps<"svg">) {
  return <InfinityLoop className={className} {...props} />;
}
