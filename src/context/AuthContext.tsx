import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserProfile,
  RegisterPayload,
  LoginPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
  DeleteAccountPayload,
} from "../types";
import {
  getStoredUser,
  getStoredSessionToken,
  fetchCurrentUserApi,
  loginApi,
  registerApi,
  googleAuthApi,
  logoutApi,
  updateProfileApi,
  changePasswordApi,
  deleteAccountApi,
  claimWorkspacesApi,
} from "../utils/authClient";
import { getOrCreateUserId } from "../utils/usageManager";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signInWithGoogle: (payload: {
    credential?: string;
    googleId?: string;
    email?: string;
    fullName?: string;
    profilePhotoUrl?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: UpdateProfilePayload) => Promise<UserProfile>;
  changePassword: (payload: ChangePasswordPayload) => Promise<string>;
  deleteAccount: (payload: DeleteAccountPayload) => Promise<void>;
  // Modal visibility states
  isAuthModalOpen: boolean;
  openAuthModal: (tab?: "signin" | "signup" | "forgot" | "verify" | "reset") => void;
  closeAuthModal: () => void;
  authModalTab: "signin" | "signup" | "forgot" | "verify" | "reset";
  setAuthModalTab: (tab: "signin" | "signup" | "forgot" | "verify" | "reset") => void;
  isSettingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  isTermsModalOpen: boolean;
  openTermsModal: (tab?: "terms" | "privacy" | "security") => void;
  closeTermsModal: () => void;
  termsModalTab: "terms" | "privacy" | "security";
  resetTokenForModal: string;
  setResetTokenForModal: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup" | "forgot" | "verify" | "reset">("signin");
  const [resetTokenForModal, setResetTokenForModal] = useState<string>("");

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);
  const [termsModalTab, setTermsModalTab] = useState<"terms" | "privacy" | "security">("terms");

  // Check URL query parameters for verification or reset tokens on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token") || params.get("verification_token");
    const resetToken = params.get("reset_token");

    if (resetToken) {
      setResetTokenForModal(resetToken);
      setAuthModalTab("reset");
      setIsAuthModalOpen(true);
    } else if (verifyToken) {
      setAuthModalTab("verify");
      setIsAuthModalOpen(true);
    }
  }, []);

  // Fetch current user on mount to validate session
  const refreshUser = useCallback(async () => {
    try {
      const token = getStoredSessionToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const fetched = await fetchCurrentUserApi();
      setUser(fetched);
    } catch (err) {
      console.warn("Failed to refresh user:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signIn = async (payload: LoginPayload) => {
    const res = await loginApi(payload);
    setUser(res.user);
    // Optionally migrate guest workspaces
    try {
      const guestId = getOrCreateUserId();
      if (guestId && guestId !== res.user.id) {
        await claimWorkspacesApi(guestId);
      }
    } catch {}
  };

  const signUp = async (payload: RegisterPayload) => {
    const res = await registerApi(payload);
    setUser(res.user);
    // Migrate guest workspaces created before registration
    try {
      const guestId = getOrCreateUserId();
      if (guestId && guestId !== res.user.id) {
        await claimWorkspacesApi(guestId);
      }
    } catch {}
  };

  const signInWithGoogle = async (payload: {
    credential?: string;
    googleId?: string;
    email?: string;
    fullName?: string;
    profilePhotoUrl?: string;
  }) => {
    const res = await googleAuthApi(payload);
    setUser(res.user);
    try {
      const guestId = getOrCreateUserId();
      if (guestId && guestId !== res.user.id) {
        await claimWorkspacesApi(guestId);
      }
    } catch {}
  };

  const signOut = async () => {
    await logoutApi();
    setUser(null);
  };

  const updateProfile = async (updates: UpdateProfilePayload): Promise<UserProfile> => {
    const updated = await updateProfileApi(updates);
    setUser(updated);
    return updated;
  };

  const changePassword = async (payload: ChangePasswordPayload): Promise<string> => {
    return await changePasswordApi(payload);
  };

  const deleteAccount = async (payload: DeleteAccountPayload): Promise<void> => {
    await deleteAccountApi(payload);
    setUser(null);
    setIsSettingsModalOpen(false);
  };

  const openAuthModal = (tab: "signin" | "signup" | "forgot" | "verify" | "reset" = "signin") => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const openSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const openTermsModal = (tab: "terms" | "privacy" | "security" = "terms") => {
    setTermsModalTab(tab);
    setIsTermsModalOpen(true);
  };

  const closeTermsModal = () => {
    setIsTermsModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshUser,
        updateProfile,
        changePassword,
        deleteAccount,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalTab,
        setAuthModalTab,
        isSettingsModalOpen,
        openSettingsModal,
        closeSettingsModal,
        isTermsModalOpen,
        openTermsModal,
        closeTermsModal,
        termsModalTab,
        resetTokenForModal,
        setResetTokenForModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
