import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge, getLabel } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// --- getLabel unit tests ---

test("getLabel: str_replace_editor create", () => {
  expect(getLabel("str_replace_editor", { command: "create", path: "/src/Button.tsx" })).toBe("Creating Button.tsx");
});

test("getLabel: str_replace_editor str_replace", () => {
  expect(getLabel("str_replace_editor", { command: "str_replace", path: "/src/Card.tsx" })).toBe("Editing Card.tsx");
});

test("getLabel: str_replace_editor insert", () => {
  expect(getLabel("str_replace_editor", { command: "insert", path: "/src/Card.tsx" })).toBe("Editing Card.tsx");
});

test("getLabel: str_replace_editor view", () => {
  expect(getLabel("str_replace_editor", { command: "view", path: "/src/App.tsx" })).toBe("Reading App.tsx");
});

test("getLabel: str_replace_editor undo_edit", () => {
  expect(getLabel("str_replace_editor", { command: "undo_edit", path: "/src/App.tsx" })).toBe("Reverting App.tsx");
});

test("getLabel: file_manager delete", () => {
  expect(getLabel("file_manager", { command: "delete", path: "/src/Old.tsx" })).toBe("Deleting Old.tsx");
});

test("getLabel: file_manager rename", () => {
  expect(getLabel("file_manager", { command: "rename", path: "/src/Old.tsx", new_path: "/src/New.tsx" })).toBe("Renaming Old.tsx → New.tsx");
});

test("getLabel: unknown tool falls back to toolName", () => {
  expect(getLabel("some_other_tool", { command: "run" })).toBe("some_other_tool");
});

test("getLabel: extracts basename from nested path", () => {
  expect(getLabel("str_replace_editor", { command: "create", path: "/deeply/nested/dir/Component.tsx" })).toBe("Creating Component.tsx");
});

// --- ToolInvocationBadge render tests ---

function makeTool(overrides: Partial<ToolInvocation>): ToolInvocation {
  return {
    toolCallId: "test-id",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/src/Button.tsx" },
    state: "call",
    ...overrides,
  } as ToolInvocation;
}

test("renders label text", () => {
  render(<ToolInvocationBadge tool={makeTool({})} />);
  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});

test("renders spinner when pending", () => {
  const { container } = render(<ToolInvocationBadge tool={makeTool({ state: "call" })} />);
  expect(container.querySelector(".animate-spin")).not.toBeNull();
});

test("renders green dot when done", () => {
  const tool = makeTool({ state: "result", result: { success: true } } as Partial<ToolInvocation>);
  const { container } = render(<ToolInvocationBadge tool={tool} />);
  expect(container.querySelector(".animate-spin")).toBeNull();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
});
