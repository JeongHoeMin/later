import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { SessionRestoreScreen } from './src/features/auth/SessionRestoreScreen';
import { useAuthSession } from './src/features/auth/session/useAuthSession';
import { SharePocScreen } from './src/features/share/SharePocScreen';

export default function App() {
  const { state, retryRestore, signedIn, signOut, withdraw } = useAuthSession();

  return (
    <SafeAreaProvider>
      {state.status === 'signedIn' ? (
        <SharePocScreen onLogout={signOut} onWithdraw={withdraw} />
      ) : state.status === 'signedOut' ? (
        <LoginScreen onAuthenticated={signedIn} />
      ) : (
        <SessionRestoreScreen
          failed={state.status === 'restoreFailed'}
          onRetry={retryRestore}
        />
      )}
    </SafeAreaProvider>
  );
}
