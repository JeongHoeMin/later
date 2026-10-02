export const APPLE_LOGIN_ATTEMPT_ID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

export function isAppleLoginAttemptId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    new RegExp(APPLE_LOGIN_ATTEMPT_ID_PATTERN).test(value)
  );
}
