import {
  Alert,
  AppState,
  Button,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import LaterShare, {
  type SharedItem,
} from '../../../modules/later-share/src/LaterShareModule';
import { AccountActions } from '../auth/components/AccountActions';

type Props = {
  onLogout: () => void;
  onWithdraw: () => Promise<boolean>;
};

export function SharePocScreen({ onLogout, onWithdraw }: Props) {
  const [items, setItems] = useState<SharedItem[]>([]);

  async function refresh() {
    try {
      setItems(await LaterShare.getItems());
    } catch {
      Alert.alert('오류', '저장 목록을 불러오지 못했어요.');
    }
  }

  async function enableNotifications() {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
      Alert.alert('안내', '기기의 앱 설정에서 알림을 확인할 수 있어요.');
      return;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    Alert.alert(
      '저장 알림',
      result === PermissionsAndroid.RESULTS.GRANTED
        ? '저장 완료 알림을 받을 수 있어요.'
        : '저장은 가능하지만 알림은 표시되지 않아요.',
    );
  }

  useEffect(() => {
    void refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => subscription.remove();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>나중에</Text>

      <Button title="저장 알림 허용" onPress={enableNotifications} />
      <Button title="목록 새로고침" onPress={refresh} />
      <AccountActions onLogout={onLogout} onWithdraw={onWithdraw} />

      {items.length === 0 && <Text>아직 저장한 내용이 없어요.</Text>}

      {items.map((item) => (
        <Text key={item.id} selectable style={styles.card}>
          {item.text}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  // type: {
  //   fontSize: 12,
  //   color: '#666',
  // },
  // content: {
  //   fontSize: 16,
  //   lineHeight: 24,
  // },
});
