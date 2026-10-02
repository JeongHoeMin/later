import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../../shared/theme/colors';
import type { SocialProvider } from '../types';
import { ProviderLogo } from './ProviderLogo';

// 각 사 브랜드 가이드의 버튼 색 (Google은 다크 테마 버튼)
const variants: Record<
  SocialProvider,
  { label: string; background: string; text: string; border?: string }
> = {
  kakao: {
    label: '카카오로 계속하기',
    background: '#FEE500',
    text: 'rgba(0, 0, 0, 0.85)',
  },
  apple: { label: 'Apple로 계속하기', background: '#FFFFFF', text: '#000000' },
  google: {
    label: 'Google로 계속하기',
    background: '#131314',
    text: '#E3E3E3',
    border: '#8E918F',
  },
};

type Props = {
  provider: SocialProvider;
  onPress: (provider: SocialProvider) => void;
  isRecent?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
};

export function SocialLoginButton({
  provider,
  onPress,
  isRecent = false,
  isLoading = false,
  disabled = false,
}: Props) {
  const variant = variants[provider];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant.label}
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled || isLoading}
      onPress={() => onPress(provider)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variant.background,
          borderColor: variant.border ?? variant.background,
        },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={variant.text} />
      ) : (
        <View style={styles.content}>
          <ProviderLogo provider={provider} />
          <Text style={[styles.label, { color: variant.text }]}>
            {variant.label}
          </Text>
        </View>
      )}

      {isRecent && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>최근 사용</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.yellow,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3D2F00',
  },
});
