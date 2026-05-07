import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, ProfileCard, SettingsRow } from '../components';
import { profile } from '../data/mock';
import type { AppTheme } from '../theme/tokens';
import type { ThemeMode } from '../types';

export function SettingsScreen({
  baseUrl,
  theme,
  mode,
  onOpenConfig,
  onSetMode,
  onClose,
}: {
  baseUrl: string;
  theme: AppTheme;
  mode: ThemeMode;
  onOpenConfig: () => void;
  onSetMode: (mode: ThemeMode) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['92%'], []);

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

            <ProfileCard
              theme={theme}
              name={profile.name}
              email={profile.email}
              plan={profile.plan}
              avatar={profile.avatar}
            />

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
              <SettingsRow theme={theme} label="Account" />
              <SettingsRow theme={theme} label="About Codex" />
              <SettingsRow theme={theme} label="Log out" />
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
