import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_URL, HTTP_STATUS, STORAGE_KEYS } from '@/lib/constants';

/**
 * API Client for Aegis Platform
 * Handles authentication, token refresh, error handling, and request/response interceptors
 */

// API error response type
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add authentication token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in debug mode
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh and errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in debug mode
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === HTTP_STATUS.UNAUTHORIZED && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get refresh token
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (!refreshToken) {
          // No refresh token, redirect to login
          redirectToLogin();
          return Promise.reject(error);
        }

        // Attempt to refresh token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        console.error('[Token Refresh Failed]', refreshError);
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    handleApiError(error);

    return Promise.reject(error);
  }
);

/**
 * Handle API errors and show appropriate messages
 */
function handleApiError(error: AxiosError<ApiErrorResponse>) {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;

    console.error(`[API Error ${status}]`, data);

    // Log specific error details in debug mode
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.error('[API Error Details]', {
        url: error.config?.url,
        method: error.config?.method,
        status,
        code: data?.error?.code,
        message: data?.error?.message,
        details: data?.error?.details,
      });
    }

    // Handle specific status codes
    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        console.warn('Bad request - validation error');
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        console.warn('Unauthorized - authentication required');
        break;
      case HTTP_STATUS.FORBIDDEN:
        console.warn('Forbidden - insufficient permissions');
        break;
      case HTTP_STATUS.NOT_FOUND:
        console.warn('Resource not found');
        break;
      case HTTP_STATUS.CONFLICT:
        console.warn('Resource conflict');
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        console.warn('Rate limit exceeded');
        break;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        console.error('Internal server error');
        break;
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        console.error('Service unavailable');
        break;
      default:
        console.error(`Unexpected error status: ${status}`);
    }
  } else if (error.request) {
    // Request made but no response received
    console.error('[Network Error]', error.message);
  } else {
    // Error setting up the request
    console.error('[Request Setup Error]', error.message);
  }
}

/**
 * Redirect to login page and clear auth data
 */
function redirectToLogin() {
  // Clear auth data
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);

  // Redirect to login (or admin login based on current path)
  const isAdminRoute = window.location.pathname.startsWith('/admin');
  window.location.href = isAdminRoute ? '/admin/login' : '/login';
}

/**
 * Type-safe API client methods
 */

export const api = {
  /**
   * GET request
   */
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.get<T>(url, config);
  },

  /**
   * POST request
   */
  post: <T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> => {
    return apiClient.post<T>(url, data, config);
  },

  /**
   * PUT request
   */
  put: <T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> => {
    return apiClient.put<T>(url, data, config);
  },

  /**
   * PATCH request
   */
  patch: <T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> => {
    return apiClient.patch<T>(url, data, config);
  },

  /**
   * DELETE request
   */
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.delete<T>(url, config);
  },
};

export default apiClient;
