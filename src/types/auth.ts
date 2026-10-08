export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  emailVerified: boolean;
  profilePhotoUrl?: string | null;
  region?: string | null;
  ageConfirmed: boolean;
  termsAcceptedVersion: string;
  termsAcceptedAt: number;
  marketingConsent: boolean;
  authProvider: "local" | "google" | "both";
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: UserProfile;
}

export interface RegisterPayload {
  email: string;
  password: string;
  confirmPassword?: string;
  fullName: string;
  displayName?: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  marketingConsent?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  displayName?: string;
  profilePhotoUrl?: string | null;
  region?: string | null;
  marketingConsent?: boolean;
}

export interface DeleteAccountPayload {
  password?: string;
  confirmPhrase?: string;
}
