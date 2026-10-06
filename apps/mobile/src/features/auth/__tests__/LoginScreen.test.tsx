import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from '../LoginScreen';
import { loginWithProvider, type LoginResult } from '../loginWithProvider';
import { SocialLoginError } from '../social/SocialLoginError';

jest.mock('../loginWithProvider', () => ({ loginWithProvider: jest.fn() }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderScreen(onAuthenticated = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LoginScreen onAuthenticated={onAuthenticated} />
    </SafeAreaProvider>,
  );
  return { onAuthenticated };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => jest.clearAllMocks());

it('카카오·네이버·구글 버튼과 iOS에서 Apple 버튼을 표시한다', async () => {
  await renderScreen();

  for (const label of [
    '카카오로 계속하기',
    '네이버로 계속하기',
    'Google로 계속하기',
    'Apple로 계속하기',
  ]) {
    expect(button(label)).toBeOnTheScreen();
  }
});

it('로그인 중에는 다른 버튼을 비활성화하고 성공하면 세션을 전달한다', async () => {
  const pending = deferred<LoginResult>();
  jest.mocked(loginWithProvider).mockReturnValue(pending.promise);
  const { onAuthenticated } = await renderScreen();

  // v14의 fireEvent는 핸들러 promise를 기다리므로 진행 중 상태를 보려면 await하지 않는다.
  const pressed = fireEvent.press(button('네이버로 계속하기'));

  await waitFor(() => expect(button('카카오로 계속하기')).toBeDisabled());
  expect(loginWithProvider).toHaveBeenCalledWith('naver');

  pending.resolve({ type: 'success', session: { userId: 'user-1' } });
  await pressed;

  expect(onAuthenticated).toHaveBeenCalledWith({ userId: 'user-1' });
});

it('취소하면 오류 없이 다시 누를 수 있는 상태로 돌아온다', async () => {
  jest.mocked(loginWithProvider).mockResolvedValue({ type: 'cancelled' });
  const { onAuthenticated } = await renderScreen();

  await fireEvent.press(button('카카오로 계속하기'));

  await waitFor(() => expect(button('Google로 계속하기')).toBeEnabled());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(onAuthenticated).not.toHaveBeenCalled();
});

it.each([
  ['failed', 'Google 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.'],
  ['rejected', 'Google 로그인을 확인하지 못했어요. 다시 로그인해 주세요.'],
  ['unavailable', '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.'],
  ['not_configured', 'Google 로그인 설정이 필요해요.'],
] as const)(
  '%s 오류는 안내 문구를 보여주고 다시 시도할 수 있다',
  async (reason, message) => {
    jest
      .mocked(loginWithProvider)
      .mockRejectedValueOnce(new SocialLoginError('google', reason))
      .mockResolvedValueOnce({ type: 'cancelled' });
    await renderScreen();

    await fireEvent.press(button('Google로 계속하기'));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);

    await fireEvent.press(button('Google로 계속하기'));

    await waitFor(() => expect(loginWithProvider).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  },
);
