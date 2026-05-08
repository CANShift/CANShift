// LogScreen.tsx — BLE and system event log

import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../components/ui'
import { Colors, Typography, Spacing } from '../theme'
import { useLogStore, type LogEntry, type LogLevel } from '../stores/log.store'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: Colors.textDim,
  warn: Colors.warning,
  error: Colors.danger,
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  return (
    <View style={styles.row}>
      <Text style={styles.timestamp}>{formatTime(entry.timestamp)}</Text>
      <Text style={[styles.level, { color: LEVEL_COLOR[entry.level] }]}>
        {entry.level.toUpperCase()}
      </Text>
      <Text style={styles.message} numberOfLines={3}>
        {entry.message}
      </Text>
    </View>
  )
}

export default function LogScreen() {
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onPress={clear} className="px-1">
            <Text className="text-sm text-primary">Clear</Text>
          </Button>
        )}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => <LogEntryRow entry={item} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No events yet</Text>}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: Typography.md, fontWeight: '600', color: Colors.text },
  list: { paddingVertical: Spacing.xs },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontSize: Typography.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  timestamp: { fontSize: Typography.xs, color: Colors.textMuted, width: 66, flexShrink: 0 },
  level: { fontSize: Typography.xs, fontWeight: '700', width: 38, flexShrink: 0 },
  message: { flex: 1, fontSize: Typography.xs, color: Colors.text, lineHeight: 17 },
})
