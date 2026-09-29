import { StatusBar } from 'expo-status-bar';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIncomingShare } from 'expo-sharing';

export default function App() {
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />

      <Text style={styles.title}>나중에</Text>
      {sharedPayloads.length === 0 ? (
        <Text>
          다른 앱에서 링크나 텍스트를 공유하고 '나중에'를 선택해 주세요
        </Text>
      ) : (
        <>
          <Text>공유 받은 내용</Text>

          {sharedPayloads.map((payload, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.type}>{payload.shareType ?? 'text'}</Text>

              <Text selectable style={styles.content}>
                {payload.value ?? ''}
              </Text>
            </View>
          ))}

          <Button title="내용 지우기" onPress={clearSharedPayloads} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  type: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
});
