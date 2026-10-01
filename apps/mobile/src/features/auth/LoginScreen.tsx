import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '../../shared/brand/LogoMark';
import { colors } from '../../shared/theme/colors';
import { SocialLoginButton } from './components/SocialLoginButton';
import type { SocialProvider } from './types';

const PROVIDERS: SocialProvider[] = ['kakao', 'apple', 'google'];

type Props = {
  onLogin: (provider: SocialProvider) => void;
  lastUsedProvider?: SocialProvider | null;
  loadingProvider?: SocialProvider | null;
  onPressTerms?: () => void;
  onPressPrivacy?: () => void;
};

export function LoginScreen({
  onLogin,
  lastUsedProvider = null,
  loadingProvider = null,
  onPressTerms,
  onPressPrivacy,
}: Props) {
  const insets = useSafeAreaInsets();
  const isBusy = loadingProvider !== null;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <StatusBar style="light" />

      <View style={styles.hero}>
        <View style={styles.logo}>
          <LogoMark size={72} />
        </View>
        <Text style={styles.headline} accessibilityRole="header">
          공유만 하세요.{'\n'}찾는 건 <Text style={styles.accent}>나중에</Text>.
        </Text>
        <Text style={styles.description}>
          흩어진 링크·영상·스크린샷을{'\n'}말하듯 검색해 다시 찾아요
        </Text>
      </View>

      <View style={styles.actions}>
        {PROVIDERS.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            onPress={onLogin}
            isRecent={provider === lastUsedProvider}
            isLoading={provider === loadingProvider}
            disabled={isBusy && provider !== loadingProvider}
          />
        ))}

        <Text style={styles.terms}>
          계속하면{' '}
          <Text style={styles.link} onPress={onPressTerms}>
            이용약관
          </Text>{' '}
          및{' '}
          <Text style={styles.link} onPress={onPressPrivacy}>
            개인정보처리방침
          </Text>
          에{'\n'}동의하는 것으로 간주됩니다
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    // 글리프 좌측 여백(약 26%)만큼 당겨 제목과 왼쪽 정렬
    marginLeft: -19,
  },
  headline: {
    marginTop: 12,
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.white,
  },
  accent: {
    color: colors.yellow,
  },
  description: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
  },
  actions: {
    gap: 12,
  },
  terms: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textSubtle,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
