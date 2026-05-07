import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function SplashScreen({ theme }: { theme: AppTheme }) {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDot((current) => (current + 1) % 3);
    }, 420);

    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <View
        pointerEvents="none"
        style={[
          styles.glowTop,
          {
            backgroundColor: theme.mode === 'dark' ? '#2A1E52' : '#D9CBFF',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowBottom,
          {
            backgroundColor: theme.mode === 'dark' ? '#17342A' : '#D4F2E0',
          },
        ]}
      />

      <View style={styles.centerWrap}>
        <View
          style={[
            styles.markShell,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <View
            style={[
              styles.markCore,
              {
                backgroundColor: theme.colors.primarySoft,
              },
            ]}
          >
            <Ionicons name="sparkles-outline" size={34} color={theme.colors.primary} />
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>
            Preparing workspace
          </Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>Codex</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Your local coding copilot, warmed up and ready to work.
        </Text>

        <View style={styles.loaderRow}>
          {[0, 1, 2].map((dot) => {
            const isActive = dot === activeDot;
            return (
              <View
                key={dot}
                style={[
                  styles.loaderDot,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceMuted,
                    transform: [{ scale: isActive ? 1.12 : 0.92 }],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
          Syncing configuration and recent sessions
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -70,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.52,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 0.4,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  markShell: {
    width: 118,
    height: 118,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
  markCore: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    marginTop: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  title: {
    marginTop: 24,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.8,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
  },
  loaderDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 26,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
