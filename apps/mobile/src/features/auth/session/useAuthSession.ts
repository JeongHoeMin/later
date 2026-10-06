import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from '../types';
import { onSessionExpired } from './authorizedRequest';
import { logout } from './logout';
import { restoreSession } from './restoreSession';
import { withdraw as withdrawAccount } from './withdraw';

export type AuthState =
  | { status: 'restoring' }
  | { status: 'restoreFailed' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: AuthSession };

const SIGNED_OUT = { status: 'signedOut' } as const;

// 앱 전체의 로그인 상태. 시작 시 저장된 세션을 복원하고, 갱신 거부(세션 만료)를 받으면 로그인 화면으로 돌아간다.
export function useAuthSession() {
  const [state, setState] = useState<AuthState>({ status: 'restoring' });

  const restore = useCallback(async () => {
    setState({ status: 'restoring' });
    try {
      const result = await restoreSession();
      setState(
        result.type === 'signedIn'
          ? { status: 'signedIn', session: result.session }
          : SIGNED_OUT,
      );
    } catch (error) {
      if (__DEV__) console.warn('[auth] 세션 복원 실패', error);
      setState({ status: 'restoreFailed' });
    }
  }, []);

  useEffect(() => {
    void restore();
    return onSessionExpired(() => setState(SIGNED_OUT));
  }, [restore]);

  const signedIn = useCallback((session: AuthSession) => {
    setState({ status: 'signedIn', session });
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setState(SIGNED_OUT);
  }, []);

  // 실패하면 로그인 상태를 유지하고 false를 돌려 화면이 재시도 안내를 표시하게 한다.
  const withdraw = useCallback(async () => {
    try {
      await withdrawAccount();
    } catch (error) {
      if (__DEV__) console.warn('[auth] 회원 탈퇴 실패', error);
      return false;
    }
    setState(SIGNED_OUT);
    return true;
  }, []);

  return {
    state,
    retryRestore: () => void restore(),
    signedIn,
    signOut,
    withdraw,
  };
}
