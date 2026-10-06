import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LogoMark } from '../../shared/brand/LogoMark';
import { colors } from '../../shared/theme/colors';

type Props = {
  failed: boolean;
  onRetry: () => void;
};

// 앱 시작 시 저장된 세션을 확인하는 동안과, 서버에 닿지 못해 확인하지 못했을 때의 화면.
export function SessionRestoreScreen({ failed, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LogoMark size={72} />
      {failed ? (
        <>
          <Text style={styles.message} accessibilityRole="alert">
            서버에 연결하지 못했어요.{'\n'}잠시 후 다시 시도해 주세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.button}
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator
          color={colors.yellow}
          accessibilityLabel="로그인 상태 확인 중"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: colors.navy,
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: colors.textMuted,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.yellow,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
});
