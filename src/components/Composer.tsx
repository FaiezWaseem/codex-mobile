import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import type { AppTheme } from '../theme/tokens';
import type { PendingAttachment } from '../hooks/useRelayChat';
import type { ReasoningEffort } from '../types';

function formatVoiceDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatModelLabel(model: string) {
  return model
    .replace(/^gpt-/, '')
    .split('-')
    .map((part) => (part === 'mini' ? 'Mini' : part === 'codex' ? 'Codex' : part))
    .join(' ');
}

function formatReasoningLabel(reasoningEffort: ReasoningEffort) {
  if (reasoningEffort === 'xhigh') {
    return 'XHigh';
  }

  return reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1);
}

export function Composer({
  theme,
  placeholder,
  value,
  onChangeText,
  attachments,
  imageAuthToken,
  availableModels,
  selectedModel,
  onSelectModel,
  availableReasoningEfforts,
  selectedReasoningEffort,
  onSelectReasoningEffort,
  onAddAttachment,
  onRemoveAttachment,
  isRecording,
  isTranscribingAudio,
  voiceDurationMillis,
  onToggleVoiceInput,
  onSend,
  disabled,
}: {
  theme: AppTheme;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  attachments?: PendingAttachment[];
  imageAuthToken?: string;
  availableModels?: readonly string[];
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  availableReasoningEfforts?: readonly ReasoningEffort[];
  selectedReasoningEffort?: ReasoningEffort;
  onSelectReasoningEffort?: (reasoningEffort: ReasoningEffort) => void;
  onAddAttachment?: () => void | Promise<void>;
  onRemoveAttachment?: (attachmentId: string) => void;
  isRecording?: boolean;
  isTranscribingAudio?: boolean;
  voiceDurationMillis?: number;
  onToggleVoiceInput?: () => void | Promise<void>;
  onSend: () => void;
  disabled?: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<'model' | 'reasoning' | null>(null);
  const canSend = (Boolean(value.trim()) || Boolean(attachments?.length)) && !disabled;
  const canRecord = !disabled && !isTranscribingAudio;
  const shouldShowSendButton = Boolean(value.trim()) || Boolean(attachments?.length);
  const selectedModelLabel = selectedModel ? formatModelLabel(selectedModel) : 'Select model';
  const selectedReasoningLabel = selectedReasoningEffort
    ? formatReasoningLabel(selectedReasoningEffort)
    : 'Reasoning';

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    Keyboard.dismiss();
    onSend();
  };

  const handlePrimaryAction = () => {
    if (shouldShowSendButton) {
      handleSend();
      return;
    }

    void onToggleVoiceInput?.();
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
      {(availableModels && availableModels.length > 0) ||
      (availableReasoningEfforts && availableReasoningEfforts.length > 0) ? (
        <View style={styles.modelStrip}>
          <View style={styles.selectorRow}>
            {availableModels && availableModels.length > 0 ? (
              <View style={styles.selectorSlot}>
                <Pressable
                  onPress={() => setOpenMenu((current) => (current === 'model' ? null : 'model'))}
                  style={[
                    styles.modelTrigger,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="flash-outline" size={15} color={theme.colors.textMuted} />
                  <Text
                    numberOfLines={1}
                    style={[styles.modelTriggerText, { color: theme.colors.text }]}
                  >
                    {selectedModelLabel}
                  </Text>
                  <Ionicons
                    name={openMenu === 'model' ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
                {openMenu === 'model' ? (
                  <View
                    style={[
                      styles.modelMenu,
                      styles.inlineMenu,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        shadowColor: theme.colors.shadow,
                      },
                    ]}
                  >
                    {availableModels.map((model, index) => {
                      const selected = model === selectedModel;
                      const isLast = index === availableModels.length - 1;

                      return (
                        <Pressable
                          key={model}
                          onPress={() => {
                            onSelectModel?.(model);
                            setOpenMenu(null);
                          }}
                          style={[
                            styles.modelOption,
                            !isLast && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modelOptionText,
                              { color: selected ? theme.colors.primary : theme.colors.text },
                            ]}
                          >
                            {formatModelLabel(model)}
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {availableReasoningEfforts && availableReasoningEfforts.length > 0 ? (
              <View style={styles.selectorSlot}>
                <Pressable
                  onPress={() =>
                    setOpenMenu((current) => (current === 'reasoning' ? null : 'reasoning'))
                  }
                  style={[
                    styles.modelTrigger,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="options-outline" size={15} color={theme.colors.textMuted} />
                  <Text
                    numberOfLines={1}
                    style={[styles.modelTriggerText, { color: theme.colors.text }]}
                  >
                    {selectedReasoningLabel}
                  </Text>
                  <Ionicons
                    name={openMenu === 'reasoning' ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
                {openMenu === 'reasoning' ? (
                  <View
                    style={[
                      styles.modelMenu,
                      styles.inlineMenu,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        shadowColor: theme.colors.shadow,
                      },
                    ]}
                  >
                    {availableReasoningEfforts.map((reasoningEffort, index) => {
                      const selected = reasoningEffort === selectedReasoningEffort;
                      const isLast = index === availableReasoningEfforts.length - 1;

                      return (
                        <Pressable
                          key={reasoningEffort}
                          onPress={() => {
                            onSelectReasoningEffort?.(reasoningEffort);
                            setOpenMenu(null);
                          }}
                          style={[
                            styles.modelOption,
                            !isLast && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modelOptionText,
                              { color: selected ? theme.colors.primary : theme.colors.text },
                            ]}
                          >
                            {formatReasoningLabel(reasoningEffort)}
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {attachments && attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentStrip}
        >
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentCard}>
              {attachment.source === 'local' || attachment.localUri ? (
                <Image
                  source={{
                    uri: attachment.source === 'local' ? attachment.localUri : attachment.localUri!,
                    headers:
                      attachment.source === 'remote' && imageAuthToken
                        ? {
                            Authorization: `Bearer ${imageAuthToken}`,
                          }
                        : undefined,
                  }}
                  style={styles.attachmentImage}
                />
              ) : (
                <View
                  style={[
                    styles.remoteAttachmentPlaceholder,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons name="image-outline" size={18} color={theme.colors.textMuted} />
                  <Text
                    numberOfLines={2}
                    style={[styles.remoteAttachmentLabel, { color: theme.colors.textMuted }]}
                  >
                    {attachment.fileName || 'Media'}
                  </Text>
                </View>
              )}
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
      {isRecording || isTranscribingAudio ? (
        <View style={styles.voiceStatusRow}>
          <View
            style={[
              styles.voiceDot,
              { backgroundColor: isRecording ? '#EF4444' : theme.colors.primary },
            ]}
          />
          <Text style={[styles.voiceStatusText, { color: theme.colors.textMuted }]}>
            {isRecording
              ? `Recording ${formatVoiceDuration(voiceDurationMillis ?? 0)}`
              : 'Transcribing voice note...'}
          </Text>
        </View>
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
          onPress={handlePrimaryAction}
          disabled={
            shouldShowSendButton
              ? !canSend
              : (!canRecord && !isRecording) || Boolean(isTranscribingAudio)
          }
          style={[
            styles.sendButton,
            {
              backgroundColor: shouldShowSendButton
                ? canSend
                  ? theme.colors.primary
                  : theme.colors.surfaceMuted
                : isRecording
                  ? '#FEE2E2'
                  : theme.colors.surface,
              opacity: shouldShowSendButton
                ? canSend
                  ? 1
                  : 0.9
                : (!canRecord && !isRecording) || Boolean(isTranscribingAudio)
                  ? 0.65
                  : 1,
            },
          ]}
        >
          <Ionicons
            name={
              shouldShowSendButton ? 'arrow-up' : isRecording ? 'stop' : 'mic-outline'
            }
            size={18}
            color={
              shouldShowSendButton
                ? canSend
                  ? '#FFFFFF'
                  : theme.colors.textMuted
                : isRecording
                  ? '#DC2626'
                  : theme.colors.textMuted
            }
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
    paddingBottom: 10,
    position: 'relative',
    zIndex: 20,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  selectorSlot: {
    position: 'relative',
    maxWidth: 132,
  },
  modelTrigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: 132,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modelTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  modelMenu: {
    minWidth: 148,
    maxWidth: 180,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  inlineMenu: {
    position: 'absolute',
    bottom: 44,
    left: 0,
  },
  modelOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentStrip: {
    gap: 10,
    paddingBottom: 10,
  },
  voiceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voiceStatusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  remoteAttachmentPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  remoteAttachmentLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '600',
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
