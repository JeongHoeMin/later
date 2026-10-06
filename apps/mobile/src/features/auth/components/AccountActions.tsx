import { useState } from 'react';
import { Alert, Button } from 'react-native';

type Props = {
  onLogout: () => void;
  onWithdraw: () => Promise<boolean>;
};

export function AccountActions({ onLogout, onWithdraw }: Props) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  async function runWithdraw() {
    setIsWithdrawing(true);
    const ok = await onWithdraw();
    // 성공하면 로그인 화면으로 바뀌어 이 컴포넌트가 사라진다.
    if (!ok) {
      setIsWithdrawing(false);
      Alert.alert(
        '회원 탈퇴',
        '지금은 탈퇴를 처리할 수 없어요. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  function confirmWithdraw() {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 계정과 연결된 소셜 로그인, 모든 기기의 로그인이 즉시 삭제되고 복구할 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => void runWithdraw(),
        },
      ],
    );
  }

  return (
    <>
      <Button title="로그아웃" onPress={onLogout} disabled={isWithdrawing} />
      <Button
        title="회원 탈퇴"
        color="#dc2626"
        onPress={confirmWithdraw}
        disabled={isWithdrawing}
      />
    </>
  );
}
