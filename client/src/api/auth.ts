import { apiFetch } from './http';

// Auth API response types
export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
}

export interface RegisterResponse {
  message: string;
}

export interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  fullName: string | null;
  language: string | null;
  timezone: string | null;
  createdAt: string;
}

export interface UpdateMePayload {
  fullName?: string;
  email?: string;
  language?: string;
  timezone?: string;
}

// Auth service
export const authService = {
  /**
   * Register a new user
   * @throws Error with message if registration fails
   */
  async register(email: string, password: string, fullName?: string): Promise<RegisterResponse> {
    const response = await apiFetch('/auth/register', {
      method: 'POST',
      auth: false,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, ...(fullName ? { fullName } : {}) }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Email already exists');
      }
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },

  /**
   * Login with email and password
   * @throws Error with message if login fails
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      auth: false,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  /**
   * Get current user information
   */
  async getMe(): Promise<User> {
    const response = await apiFetch('/auth/me', { method: 'GET' });

    if (!response.ok) {
      throw new Error('Failed to get user information');
    }

    return response.json();
  },

  /**
   * Logout user
   * Revokes refresh tokens on the backend
   */
  async logout(): Promise<void> {
    const response = await apiFetch('/auth/logout', { method: 'POST' });

    if (!response.ok) {
      throw new Error('Logout failed');
    }
  },

  /**  
   * PATCH /auth/me - Update user profile information
   * @throws Error with message if update fails
   */
  async updateMe(profileData: UpdateMePayload): Promise<User> {
    const response = await apiFetch('/auth/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Failed to update user information' }));
      throw new Error(error.message || 'Failed to update user information');
    }

    return response.json();
  },

  /**
   * PATCH /auth/me/password - Change own password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiFetch('/auth/me/password', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to change password' }));
      throw new Error(error.message || 'Failed to change password');
    }
  },

  /**
   * GET /auth/verify-email?token=xxx — verify email from link in inbox
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await apiFetch(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: 'GET', auth: false },
    );

    const data = await response.json().catch(() => ({ message: 'Unknown error' }));
    if (!response.ok) {
      throw new Error(data.message || 'Email verification failed');
    }
    return data as { message: string };
  },
};
