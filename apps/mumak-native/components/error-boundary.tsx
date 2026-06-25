import { type ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">문제가 발생했어요</ThemedText>
      <ThemedText style={styles.message}>{error.message}</ThemedText>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
        <ThemedText type="defaultSemiBold">다시 시도</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  message: {
    textAlign: 'center',
    opacity: 0.7,
  },
  retry: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
