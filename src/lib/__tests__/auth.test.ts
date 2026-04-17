// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function importAuth() {
  return await import("../auth");
}

test("createSession sets an httpOnly cookie with a JWT", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // valid JWT format
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession cookie has sameSite lax and correct path", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession cookie expires approximately 7 days from now", async () => {
  const before = Date.now();
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession JWT payload contains userId and email", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("createSession JWT is signed with HS256", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  expect(header.alg).toBe("HS256");
});

test("createSession secure flag is false outside production", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(false);
});

test("createSession only sets one cookie", async () => {
  const { createSession } = await importAuth();
  await createSession("user-123", "test@example.com");
  expect(mockCookieStore.set).toHaveBeenCalledOnce();
});

test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);
  const { getSession } = await importAuth();
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an invalid token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
  const { getSession } = await importAuth();
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const { createSession, getSession } = await importAuth();

  await createSession("user-abc", "hello@example.com");
  const [, token] = mockCookieStore.set.mock.calls[0];
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-abc");
  expect(session?.email).toBe("hello@example.com");
  expect(session?.expiresAt).toBeDefined();
});

test("deleteSession removes the cookie", async () => {
  const { deleteSession } = await importAuth();
  await deleteSession();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns null when no cookie is on the request", async () => {
  const { verifySession } = await importAuth();
  const req = new NextRequest("http://localhost/");
  const session = await verifySession(req);
  expect(session).toBeNull();
});

test("verifySession returns null for an invalid token on the request", async () => {
  const { verifySession } = await importAuth();
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: "auth-token=bad.token.value" },
  });
  const session = await verifySession(req);
  expect(session).toBeNull();
});

test("verifySession returns the session payload for a valid token on the request", async () => {
  const { createSession, verifySession } = await importAuth();

  await createSession("user-xyz", "verify@example.com");
  const [, token] = mockCookieStore.set.mock.calls[0];

  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });
  const session = await verifySession(req);
  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-xyz");
  expect(session?.email).toBe("verify@example.com");
});
