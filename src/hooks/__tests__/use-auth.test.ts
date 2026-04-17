import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
  });

  it("returns signIn, signUp, and isLoading=false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });

  describe("signIn", () => {
    it("calls signInAction with email and password", async () => {
      mockSignInAction.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "secret");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "secret");
    });

    it("returns the result from signInAction", async () => {
      const serverResult = { success: false, error: "Invalid credentials" };
      mockSignInAction.mockResolvedValue(serverResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual(serverResult);
    });

    it("sets isLoading to true during sign in and false after", async () => {
      let resolveSignIn!: (v: any) => void;
      mockSignInAction.mockReturnValue(new Promise((res) => { resolveSignIn = res; }));

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("user@example.com", "secret");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when signInAction throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "secret").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("on success — post sign-in routing", () => {
      it("creates project from anon work and redirects when anon messages exist", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({
          messages: [{ role: "user", content: "hello" }],
          fileSystemData: { "/": { type: "directory" } },
        });
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "secret");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: "user", content: "hello" }],
            data: { "/": { type: "directory" } },
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
        expect(mockGetProjects).not.toHaveBeenCalled();
      });

      it("does NOT use anon work when messages array is empty", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-id" }] as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "secret");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-id");
      });

      it("redirects to the most recent project when user has existing projects", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "recent-project" },
          { id: "older-project" },
        ] as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "secret");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      it("creates a new project and redirects when user has no projects", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-id" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "secret");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
      });

      it("does not navigate when sign in fails", async () => {
        mockSignInAction.mockResolvedValue({ success: false });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "wrong");
        });

        expect(mockPush).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });
  });

  describe("signUp", () => {
    it("calls signUpAction with email and password", async () => {
      mockSignUpAction.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith("newuser@example.com", "password");
    });

    it("returns the result from signUpAction", async () => {
      const serverResult = { success: false, error: "Email already taken" };
      mockSignUpAction.mockResolvedValue(serverResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("taken@example.com", "password");
      });

      expect(returnValue).toEqual(serverResult);
    });

    it("sets isLoading to true during sign up and false after", async () => {
      let resolveSignUp!: (v: any) => void;
      mockSignUpAction.mockReturnValue(new Promise((res) => { resolveSignUp = res; }));

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when signUpAction throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("runs post-sign-in routing on success", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "first-project" }] as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });

    it("does not navigate when sign up fails", async () => {
      mockSignUpAction.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
