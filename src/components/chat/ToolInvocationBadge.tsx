"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getLabel(toolName: string, args: Record<string, unknown>): string {
  const path = typeof args.path === "string" ? args.path : "";
  const filename = path.split("/").filter(Boolean).pop() ?? path;

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return `Creating ${filename}`;
      case "str_replace":
      case "insert":
        return `Editing ${filename}`;
      case "view":
        return `Reading ${filename}`;
      case "undo_edit":
        return `Reverting ${filename}`;
      default:
        return `Updating ${filename}`;
    }
  }

  if (toolName === "file_manager") {
    switch (args.command) {
      case "delete":
        return `Deleting ${filename}`;
      case "rename": {
        const newPath = typeof args.new_path === "string" ? args.new_path : "";
        const newFilename = newPath.split("/").filter(Boolean).pop() ?? newPath;
        return `Renaming ${filename} → ${newFilename}`;
      }
    }
  }

  return toolName;
}

interface ToolInvocationBadgeProps {
  tool: ToolInvocation;
}

export function ToolInvocationBadge({ tool }: ToolInvocationBadgeProps) {
  const done = tool.state === "result" && "result" in tool && tool.result != null;
  const label = getLabel(tool.toolName, tool.args as Record<string, unknown>);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {done ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
