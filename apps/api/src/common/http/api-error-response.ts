export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
};
