export interface ApiError {
  status: number;
  code: string;
  message: string;
  retry_after?: number; // seconds
  field_errors?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}
