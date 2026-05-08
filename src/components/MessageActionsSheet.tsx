import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, Share } from 'react-native';
import type { AppTheme } from '../theme/tokens';
import type { ChatAttachment } from '../types';

export function MessageActionsSheet({
  visible,
  theme,
  messageId,
  content,
  attachments,
  onDeleteMessage,
  onClose,
}: {
  visible: boolean;
  theme: AppTheme;
  messageId?: string;
  content?: string;
  attachments?: ChatAttachment[];
  onDeleteMessage?: (messageId: string) => void;
  onClose: () => void;
}) {
  const snapPoints = useMemo(() => ['40%'], []);

  const renderBackdrop = useCallback(
    (props: ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.52}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (!visible) {
    return null;
  }

  async function handleCopy() {
    if (!content?.trim()) {
      return;
    }

    await Clipboard.setStringAsync(content);
    onClose();
  }

  async function handleShare() {
    const shareLines = [
      content?.trim(),
      ...(attachments?.map((attachment) => attachment.uri) ?? []),
    ].filter(Boolean);

    if (shareLines.length === 0) {
      return;
    }

    await Share.share({
      message: shareLines.join('\n\n'),
    });
    onClose();
  }

  return (
    <View pointerEvents="box-none" style={styles.overlayHost}>
      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        onClose={onClose}
        enablePanDownToClose
        animateOnMount
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: theme.colors.textMuted }}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
      >
        <BottomSheetView
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>Message</Text>
          <Pressable
            onPress={() => void handleCopy()}
            style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleShare()}
            style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (messageId) {
                onDeleteMessage?.(messageId);
              }
              onClose();
            }}
            style={styles.actionRow}
          >
            <Text style={[styles.actionText, { color: '#DC2626' }]}>Delete</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingBottom: 26,
    overflow: 'hidden',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  actionRow: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
