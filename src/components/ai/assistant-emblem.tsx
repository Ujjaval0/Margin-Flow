import React from "react";

/**
 * AssistantEmblem: Claude-inspired bespoke editorial emblem
 * Replaces generic purple AI sparkles with a warm, sophisticated, intellectual mark.
 */
export function AssistantEmblem({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 8-point geometric starburst inspired by Claude / Anthropic aesthetic */}
      <path d="M12 1.5C12.4 6.8 16.8 11.2 22.5 11.6V12.4C16.8 12.8 12.4 17.2 12 22.5H11.2C10.8 17.2 6.4 12.8 0.7 12.4V11.6C6.4 11.2 10.8 6.8 11.2 1.5H12Z" />
      <path
        d="M19.4 4.6L20.2 5.4C16.8 8.8 14.2 11.4 10.8 14.8L10 14C13.4 10.6 16 8 19.4 4.6Z"
        opacity="0.5"
      />
      <path
        d="M4.6 4.6L5.4 3.8C8.8 7.2 11.4 9.8 14.8 13.2L14 14C10.6 10.6 8 8 4.6 4.6Z"
        opacity="0.5"
      />
    </svg>
  );
}
