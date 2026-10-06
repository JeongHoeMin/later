import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../../../shared/api/apiClient';
import { onSessionExpired } from '../authorizedRequest';
import { logout } from '../logout';
import { restoreSession } from '../restoreSession';
import { useAuthSession } from '../useAuthSession';
import { withdraw } from '../withdraw';

jest.mock('../restoreSession', () => ({ restoreSession: jest.fn() }));
jest.mock('../logout', () => ({ logout: jest.fn() }));
jest.mock('../withdraw', () => ({ withdraw: jest.fn() }));
jest.mock('../authorizedRequest', () => ({ onSessionExpired: jest.fn() }));

const restore = jest.mocked(restoreSession);
const signedIn = {
  type: 'signedIn',
  session: { userId: 'u1' },
} as const;

let expire: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(onSessionExpired).mockImplementation((listener) => {
    expire = listener;
    return jest.fn();
  });
});

async function renderAuth() {
  return renderHook(() => useAuthSession());
}

it('복원 중에는 restoring, 복원 결과가 로그인이면 signedIn이다', async () => {
  restore.mockResolvedValue(signedIn);

  const { result } = await renderAuth();

  await waitFor(() =>
    expect(result.current.state).toEqual({
      status: 'signedIn',
      session: { userId: 'u1' },
    }),
  );
});

it('저장된 세션이 없으면 signedOut이다', async () => {
  restore.mockResolvedValue({ type: 'signedOut' });

  const { result } = await renderAuth();

  await waitFor(() =>
    expect(result.current.state).toEqual({ status: 'signedOut' }),
  );
});

it('복원 확인이 실패하면 restoreFailed이고 재시도할 수 있다', async () => {
  restore.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
  restore.mockResolvedValueOnce(signedIn);

  const { result } = await renderAuth();
  await waitFor(() =>
    expect(result.current.state).toEqual({ status: 'restoreFailed' }),
  );

  await act(async () => result.current.retryRestore());

  await waitFor(() => expect(result.current.state.status).toBe('signedIn'));
  expect(restore).toHaveBeenCalledTimes(2);
});

it('로그인 성공·로그아웃이 상태에 반영된다', async () => {
  restore.mockResolvedValue({ type: 'signedOut' });
  jest.mocked(logout).mockResolvedValue();
  const { result } = await renderAuth();
  await waitFor(() => expect(result.current.state.status).toBe('signedOut'));

  await act(async () => result.current.signedIn({ userId: 'u2' }));
  expect(result.current.state).toEqual({
    status: 'signedIn',
    session: { userId: 'u2' },
  });

  await act(async () => result.current.signOut());
  expect(logout).toHaveBeenCalledTimes(1);
  expect(result.current.state).toEqual({ status: 'signedOut' });
});

it('탈퇴 성공이면 signedOut, 실패하면 상태를 유지하고 false를 반환한다', async () => {
  restore.mockResolvedValue(signedIn);
  const { result } = await renderAuth();
  await waitFor(() => expect(result.current.state.status).toBe('signedIn'));

  jest.mocked(withdraw).mockRejectedValueOnce(new ApiError(500, 'X'));
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.withdraw();
  });
  expect(ok).toBe(false);
  expect(result.current.state.status).toBe('signedIn');

  jest.mocked(withdraw).mockResolvedValueOnce();
  await act(async () => {
    ok = await result.current.withdraw();
  });
  expect(ok).toBe(true);
  expect(result.current.state).toEqual({ status: 'signedOut' });
});

it('세션 만료 알림을 받으면 signedOut이다', async () => {
  restore.mockResolvedValue(signedIn);
  const { result } = await renderAuth();
  await waitFor(() => expect(result.current.state.status).toBe('signedIn'));

  await act(async () => expire());

  expect(result.current.state).toEqual({ status: 'signedOut' });
});
