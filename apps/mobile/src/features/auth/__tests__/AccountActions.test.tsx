import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { AccountActions } from '../components/AccountActions';

const alertSpy = jest.spyOn(Alert, 'alert');

function lastAlertButton(text: string): AlertButton {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] ?? [];
  const found = buttons.find((b) => b.text === text);
  if (!found) throw new Error(`alert button ${text} not found`);
  return found;
}

beforeEach(() => alertSpy.mockReset());

async function renderActions(onWithdraw = jest.fn()) {
  const onLogout = jest.fn();
  await render(<AccountActions onLogout={onLogout} onWithdraw={onWithdraw} />);
  return { onLogout, onWithdraw };
}

it('로그아웃 버튼은 onLogout을 호출한다', async () => {
  const { onLogout } = await renderActions();

  fireEvent.press(screen.getByRole('button', { name: '로그아웃' }));

  expect(onLogout).toHaveBeenCalledTimes(1);
});

it('회원 탈퇴는 확인 대화상자에서 취소하면 호출하지 않는다', async () => {
  const { onWithdraw } = await renderActions();

  fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
  lastAlertButton('취소').onPress?.();

  expect(onWithdraw).not.toHaveBeenCalled();
});

it('확인 대화상자에서 탈퇴를 누르면 onWithdraw를 호출한다', async () => {
  const { onWithdraw } = await renderActions(jest.fn().mockResolvedValue(true));

  fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
  lastAlertButton('탈퇴').onPress?.();

  await waitFor(() => expect(onWithdraw).toHaveBeenCalledTimes(1));
  expect(alertSpy).toHaveBeenCalledTimes(1);
});

it('탈퇴에 실패하면 잠시 후 다시 시도 안내를 표시한다', async () => {
  await renderActions(jest.fn().mockResolvedValue(false));

  fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
  lastAlertButton('탈퇴').onPress?.();

  await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
  expect(alertSpy.mock.calls[1][1]).toContain('잠시 후 다시 시도');
});
