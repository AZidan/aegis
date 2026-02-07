/**
 * API-related type definitions
 * Corresponds to the API contract in docs/api-contract.md
 */

// Common pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Common sort types
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

// API error response
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// Filter types
export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

// Success response for operations
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// Async operation response
export interface AsyncOperationResponse {
  operationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
}
