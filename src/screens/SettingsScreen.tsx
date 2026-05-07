import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, SettingsRow } from '../components';
import type { AppTheme } from '../theme/tokens';
import type { ThemeMode } from '../types';

type UsageWindow = {
  usedPercent?: number;
  windowDurationMins?: number;
  resetsAt?: number;
};

type UsageSession = {
  sessionId: string;
  lastTokenUsage?: {
    total?: {
      totalTokens?: number;
    };
  } | null;
};

type UsageResponse = {
  ok: boolean;
  source?: string;
  cachedAt?: string;
  accountRateLimits?: {
    planType?: string | null;
    primary?: UsageWindow;
    secondary?: UsageWindow;
  };
  sessions?: UsageSession[];
};

function formatResetTime(unixSeconds?: number) {
  if (!unixSeconds) {
    return 'No reset time';
  }

  return new Date(unixSeconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCachedAt(value?: string) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function UsageMeter({
  theme,
  label,
  window,
}: {
  theme: AppTheme;
  label: string;
  window?: UsageWindow;
}) {
  const usedPercent = Math.max(0, Math.min(window?.usedPercent ?? 0, 100));
  const hours = Math.round((window?.windowDurationMins ?? 0) / 60);

  return (
    <View style={styles.meterBlock}>
      <View style={styles.meterHeader}>
        <Text style={[styles.meterLabel, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.meterValue, { color: theme.colors.textMuted }]}>{usedPercent}%</Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
        <View
          style={[
            styles.meterFill,
            {
              backgroundColor: theme.colors.primary,
              width: `${usedPercent}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.meterMeta, { color: theme.colors.textMuted }]}>
        {hours > 0 ? `${hours}h window` : `${window?.windowDurationMins ?? 0}m window`} • resets{' '}
        {formatResetTime(window?.resetsAt)}
      </Text>
    </View>
  );
}

export function SettingsScreen({
  baseUrl,
  bearerToken,
  theme,
  mode,
  onOpenConfig,
  onSetMode,
  onClose,
}: {
  baseUrl: string;
  bearerToken: string;
  theme: AppTheme;
  mode: ThemeMode;
  onOpenConfig: () => void;
  onSetMode: (mode: ThemeMode) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['92%'], []);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={0.72}
      />
    ),
    [],
  );

  const loadUsage = useCallback(async () => {
    if (!baseUrl.trim() || !bearerToken.trim()) {
      setUsage(null);
      setUsageError('Relay is not configured.');
      return;
    }

    setIsLoadingUsage(true);
    setUsageError(null);

    try {
      const response = await fetch(`${baseUrl}/v1/usage`, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Usage request failed (${response.status})`);
      }

      const payload = (await response.json()) as UsageResponse;
      setUsage(payload);
    } catch (error) {
      setUsageError(
        error instanceof Error ? error.message : 'Unable to load Codex usage right now.',
      );
    } finally {
      setIsLoadingUsage(false);
    }
  }, [baseUrl, bearerToken]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const sessionsWithUsage = usage?.sessions?.filter((session) => session.lastTokenUsage?.total)
    ?? [];
  const totalTrackedTokens = sessionsWithUsage.reduce(
    (sum, session) => sum + (session.lastTokenUsage?.total?.totalTokens ?? 0),
    0,
  );

  return (
    <View style={styles.overlay}>
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        animateOnMount
        topInset={insets.top}
        bottomInset={insets.bottom}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: theme.colors.border }]}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.background }]}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(12, insets.top * 0.2),
              paddingBottom: Math.max(30, insets.bottom + 24),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <BottomSheetView>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Settings</Text>
              <IconButton theme={theme} icon="close" onPress={() => bottomSheetRef.current?.close()} />
            </View>

            <View
              style={[
                styles.usageCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.usageHeader}>
                <View>
                  <Text style={[styles.usageEyebrow, { color: theme.colors.textMuted }]}>
                    Codex usage
                  </Text>
                  <Text style={[styles.usageTitle, { color: theme.colors.text }]}>
                    {usage?.accountRateLimits?.planType?.toUpperCase() || 'PLAN'}
                  </Text>
                </View>
                {isLoadingUsage ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <View
                    style={[
                      styles.sourcePill,
                      { backgroundColor: theme.colors.primarySoft },
                    ]}
                  >
                    <Text style={[styles.sourcePillText, { color: theme.colors.primary }]}>
                      {usage?.source || 'offline'}
                    </Text>
                  </View>
                )}
              </View>

              {usageError ? (
                <Text style={[styles.usageError, { color: theme.colors.textMuted }]}>
                  {usageError}
                </Text>
              ) : null}

              {!usageError ? (
                <>
                  <View style={styles.statsGrid}>
                    <View
                      style={[
                        styles.statTile,
                        { backgroundColor: theme.colors.surfaceElevated },
                      ]}
                    >
                      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                        Sessions
                      </Text>
                      <Text style={[styles.statValue, { color: theme.colors.text }]}>
                        {usage?.sessions?.length ?? 0}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statTile,
                        { backgroundColor: theme.colors.surfaceElevated },
                      ]}
                    >
                      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                        Tracked tokens
                      </Text>
                      <Text style={[styles.statValue, { color: theme.colors.text }]}>
                        {formatCompactNumber(totalTrackedTokens)}
                      </Text>
                    </View>
                  </View>

                  <UsageMeter
                    theme={theme}
                    label="Primary window"
                    window={usage?.accountRateLimits?.primary}
                  />
                  <UsageMeter
                    theme={theme}
                    label="Weekly window"
                    window={usage?.accountRateLimits?.secondary}
                  />

                  <Text style={[styles.cachedAtText, { color: theme.colors.textMuted }]}>
                    Cached at {formatCachedAt(usage?.cachedAt)}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.themePanel}>
              <Text style={[styles.themeLabel, { color: theme.colors.text }]}>Theme</Text>
              <View
                style={[styles.themeToggle, { backgroundColor: theme.colors.surfaceMuted }]}
              >
                {(['system', 'light', 'dark'] as const).map((item) => {
                  const selected = item === mode;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => onSetMode(item)}
                      style={[
                        styles.themeOption,
                        selected && { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.themeOptionText,
                          { color: selected ? theme.colors.text : theme.colors.textMuted },
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ paddingHorizontal: 12 }}>
              <SettingsRow
                theme={theme}
                label="Agent Config"
                value={baseUrl.trim() ? 'Configured' : 'Not set'}
                onPress={onOpenConfig}
              />
              <SettingsRow
                theme={theme}
                label="Usage source"
                value={usage?.source || (isLoadingUsage ? 'Loading' : 'Unavailable')}
                onPress={() => void loadUsage()}
              />
            </View>
          </BottomSheetView>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  handleIndicator: {
    width: 72,
    height: 8,
    borderRadius: 999,
  },
  sheetBackground: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 32
  },
  scrollContent: {
    paddingHorizontal: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    padding: 12
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 'auto',
    marginRight: 12,
  },
  usageCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  usageEyebrow: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  usageTitle: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  sourcePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sourcePillText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  usageError: {
    fontSize: 15,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  statTile: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  meterBlock: {
    marginTop: 10,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  meterLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  meterValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  meterTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
  },
  meterMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  cachedAtText: {
    fontSize: 13,
    marginTop: 16,
  },
  themePanel: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  themeLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  themeToggle: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 6,
  },
  themeOption: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 16,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
});
