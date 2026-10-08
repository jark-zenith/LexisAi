import {
  UserProfile,
  RegisterPayload,
  LoginPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
  ResetPasswordPayload,
  DeleteAccountPayload,
} from "../types";

const TOKEN_KEY = "lexis_session_token";
const USER_KEY = "lexis_current_user";

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn("Could not save session to localStorage", err);
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.warn("Could not clear session", err);
  }
}

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function registerApi(payload: RegisterPayload): Promise<{ user: UserProfile; token: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to create account.");
  }

  setStoredSession(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function loginApi(payload: LoginPayload): Promise<{ user: UserProfile; token: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to sign in.");
  }

  setStoredSession(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function googleAuthApi(payload: {
  credential?: string;
  googleId?: string;
  email?: string;
  fullName?: string;
  profilePhotoUrl?: string;
}): Promise<{ user: UserProfile; token: string; isNewUser?: boolean }> {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to sign in with Google.");
  }

  setStoredSession(data.token, data.user);
  return { user: data.user, token: data.token, isNewUser: data.isNewUser };
}

export async function logoutApi(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (err) {
    console.warn("Logout error:", err);
  } finally {
    clearStoredSession();
  }
}

export async function fetchCurrentUserApi(): Promise<UserProfile | null> {
  const token = getStoredSessionToken();
  if (!token) return null;

  try {
    const res = await fetch("/api/auth/me", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearStoredSession();
      }
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    return getStoredUser();
  }
}

export async function updateProfileApi(updates: UpdateProfilePayload): Promise<UserProfile> {
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update profile.");
  }

  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<string> {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update password.");
  }

  return data.message || "Password updated successfully.";
}

export async function verifyEmailApi(token: string): Promise<UserProfile> {
  const res = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to verify email.");
  }

  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data.user;
}

export async function resendVerificationApi(email: string): Promise<string> {
  const res = await fetch("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to resend verification email.");
  }

  return data.message;
}

export async function forgotPasswordApi(email: string): Promise<string> {
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to submit password reset request.");
  }

  return data.message;
}

export async function resetPasswordApi(payload: ResetPasswordPayload): Promise<string> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to reset password.");
  }

  return data.message;
}

export async function claimWorkspacesApi(guestId: string): Promise<number> {
  const res = await fetch("/api/auth/claim-workspaces", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ guestId }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to link guest workspaces.");
  }

  return data.migratedCount || 0;
}

export async function deleteAccountApi(payload: DeleteAccountPayload): Promise<void> {
  const res = await fetch("/api/auth/account", {
    method: "DELETE",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to delete account.");
  }

  clearStoredSession();
}
