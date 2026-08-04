import type { Response } from 'supertest';

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

type ApiResponseBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export function expectSuccess<T>(res: Response): T {
  const body = res.body as ApiResponseBody<T>;
  if (!body.success) {
    throw new Error(`Expected a success response but got error: ${JSON.stringify(body)}`);
  }
  return body.data;
}

export function expectError(res: Response): ApiErrorBody['error'] {
  const body = res.body as ApiResponseBody<unknown>;
  if (body.success) {
    throw new Error(`Expected an error response but got success: ${JSON.stringify(body)}`);
  }
  return body.error;
}
