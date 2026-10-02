import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { SharePocScreen } from './src/features/share/SharePocScreen';

export default function App() {
  // TODO: 소셜 로그인 SDK·토큰 관리 연동 전까지 임시 상태로 화면 전환
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <SafeAreaProvider>
      {isLoggedIn ? (
        <SharePocScreen />
      ) : (
        <LoginScreen onLogin={() => setIsLoggedIn(true)} />
      )}
    </SafeAreaProvider>
  );
}
