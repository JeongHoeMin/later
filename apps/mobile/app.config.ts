import type { ConfigContext, ExpoConfig } from 'expo/config';

// 소셜 로그인 키에 의존하는 config plugin만 여기서 추가한다. 나머지 설정은 app.json에 둔다.
// 키가 없으면 해당 plugin을 건너뛰어 다른 작업의 prebuild·start를 막지 않는다.
const env = process.env;

function socialLoginPlugins(): NonNullable<ExpoConfig['plugins']> {
  const plugins: NonNullable<ExpoConfig['plugins']> = [];
  const missing: string[] = [];

  if (env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY) {
    plugins.push([
      '@react-native-seoul/kakao-login',
      { kakaoAppKey: env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY },
    ]);
  } else {
    missing.push('EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY');
  }

  // iOS URL scheme은 iOS client ID를 역순으로 쓴 값이다.
  const iosClientId = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const iosUrlScheme = iosClientId.split('.').reverse().join('.');
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme },
    ]);
  } else {
    plugins.push('@react-native-google-signin/google-signin');
    missing.push('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
  }

  if (missing.length > 0) {
    console.warn(`[app.config] 소셜 로그인 설정 누락: ${missing.join(', ')}`);
  }
  return plugins;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? '나중에',
  slug: config.slug ?? 'mobile',
  plugins: [...(config.plugins ?? []), ...socialLoginPlugins()],
});
