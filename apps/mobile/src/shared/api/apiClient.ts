// Later API 공통 오류. 서버 오류 본문은 { error: { code, message } } 형식이다.
// status 0은 서버 응답을 받지 못한 경우(설정 누락·네트워크·시간 초과)다.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API ${status} ${code}`);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) throw new ApiError(0, 'API_NOT_CONFIGURED');
  return url.replace(/\/+$/, '');
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

// 요청·응답 본문에는 토큰과 비밀값이 들어가므로 로그로 남기지 않는다.
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const hasBody = options.body !== undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(hasBody && { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorCode(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
