import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import type { AppTheme } from '../theme/tokens';
import type { PendingImageAttachment } from '../hooks/useRelayChat';

export function Composer({
  theme,
  placeholder,
  value,
  onChangeText,
  attachments,
  availableModels,
  selectedModel,
  onSelectModel,
  onAddAttachment,
  onRemoveAttachment,
  onSend,
  disabled,
}: {
  theme: AppTheme;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  attachments?: PendingImageAttachment[];
  availableModels?: readonly string[];
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  onAddAttachment?: () => void | Promise<void>;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  const canSend = (Boolean(value.trim()) || Boolean(attachments?.length)) && !disabled;

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    Keyboard.dismiss();
    onSend();
  };

  return (
    <View
      style={[
        styles.composerShell,
        {
          backgroundColor: theme.colors.input,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      {availableModels && availableModels.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modelStrip}
        >
          {availableModels.map((model) => {
            const selected = model === selectedModel;
            return (
              <Pressable
                key={model}
                onPress={() => onSelectModel?.(model)}
                style={[
                  styles.modelChip,
                  {
                    backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modelChipText,
                    { color: selected ? theme.colors.primary : theme.colors.textMuted },
                  ]}
                >
                  {model}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {attachments && attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentStrip}
        >
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentCard}>
              <Image source={{ uri: attachment.localUri }} style={styles.attachmentImage} />
              <Pressable
                onPress={() => onRemoveAttachment?.(attachment.id)}
                style={[styles.attachmentRemove, { backgroundColor: theme.colors.surface }]}
              >
                <Ionicons name="close" size={12} color={theme.colors.text} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => void onAddAttachment?.()}
          disabled={disabled}
          style={[
            styles.attachButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          <Ionicons name="image-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          autoCorrect={false}
          textAlignVertical="top"
          returnKeyType="default"
          style={[styles.composerInput, { color: theme.colors.text }]}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? theme.colors.primary : theme.colors.surfaceMuted,
              opacity: canSend ? 1 : 0.9,
            },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color={canSend ? '#FFFFFF' : theme.colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerShell: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  modelStrip: {
    gap: 8,
    paddingBottom: 10,
  },
  modelChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modelChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentStrip: {
    gap: 10,
    paddingBottom: 10,
  },
  attachmentCard: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  composerInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 24,
    maxHeight: 100,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
