import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatMessageBubble, Composer, IconButton, MediaManagerModal } from '../components';
import { AVAILABLE_MODELS, AVAILABLE_REASONING_EFFORTS } from '../hooks/useRelayChat';
import type { AppTheme } from '../theme/tokens';
import type { ChatMessage, ReasoningEffort, Task } from '../types';

export function TaskDetailScreen({
  theme,
  task,
  onBack,
  baseUrl,
  input,
  pendingAttachments,
  bearerToken,
  selectedModel,
  selectedReasoningEffort,
  isRecordingAudio,
  isStreaming,
  isTranscribingAudio,
  messages,
  onChangeInput,
  onSelectModel,
  onSelectReasoningEffort,
  onAddAttachment,
  onAddExistingMediaAttachment,
  onRemoveAttachment,
  onToggleVoiceInput,
  onSendMessage,
  voiceDurationMillis,
}: {
  theme: AppTheme;
  task: Task;
  onBack: () => void;
  baseUrl: string;
  input: string;
  pendingAttachments: Parameters<typeof Composer>[0]['attachments'];
  bearerToken: string;
  selectedModel: string;
  selectedReasoningEffort: ReasoningEffort;
  isRecordingAudio: boolean;
  isStreaming: boolean;
  isTranscribingAudio: boolean;
  messages: ChatMessage[];
  onChangeInput: (value: string) => void;
  onSelectModel: (model: string) => void;
  onSelectReasoningEffort: (reasoningEffort: ReasoningEffort) => void;
  onAddAttachment: () => void | Promise<void>;
  onAddExistingMediaAttachment: (media: {
    id?: string;
    fileName?: string;
    name?: string;
    contentType?: string;
    mimeType?: string;
    downloadUrl?: string;
    fileUrl?: string;
    uri?: string;
    previewUrl?: string;
  }) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onToggleVoiceInput: () => void | Promise<void>;
  onSendMessage: () => void;
  voiceDurationMillis: number;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 40);

    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.fixedHeader,
          {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          
          <IconButton theme={theme} icon="chevron-back" onPress={onBack} />
          <View style={styles.headerTextWrap}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
              {task.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {task.category}
            </Text>
          </View>
          <View
            style={[
              styles.headerActions,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.text} />
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.promptCard, { backgroundColor: theme.colors.surfaceMuted }]}>
          <Text style={[styles.promptText, { color: theme.colors.text }]}>{task.prompt}</Text>
          <View style={[styles.moreBar, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Text style={[styles.moreText, { color: theme.colors.textMuted }]}>Show more</Text>
          </View>
        </View>

        <View style={styles.agentRow}>
          <View style={[styles.agentIcon, { backgroundColor: theme.colors.primarySoft }]}>
            <Ionicons name="albums-outline" size={28} color={theme.colors.primary} />
          </View>
          <Text style={[styles.agentName, { color: theme.colors.text }]}>Codex</Text>
        </View>

        <Text style={[styles.duration, { color: theme.colors.textMuted }]}>
          Worked for {task.duration}
        </Text>

        <View style={styles.summarySection}>
          <Text style={[styles.summaryHeading, { color: theme.colors.text }]}>Summary</Text>
          <Text style={[styles.summarySubheading, { color: theme.colors.text }]}>
            What you have now (delivered)
          </Text>
          {task.summary.map((item) => (
            <Text key={item} style={[styles.summaryItem, { color: theme.colors.text }]}>
              . {item}
            </Text>
          ))}
        </View>

        <View style={styles.chatSection}>
          <Text style={[styles.chatSectionTitle, { color: theme.colors.text }]}>Chat</Text>
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              theme={theme}
              message={message}
              imageAuthToken={bearerToken}
            />
          ))}
          <Text style={[styles.chatHint, { color: theme.colors.textMuted }]}>
            {isStreaming
              ? 'Streaming dummy assistant reply...'
              : 'Reply here to continue the task conversation.'}
          </Text>
        </View>
      </ScrollView>

      <Pressable
        style={[
          styles.jumpButton,
          { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow },
        ]}
      >
        <Ionicons name="arrow-down" size={24} color={theme.colors.text} />
      </Pressable>

      <View
        style={[
          styles.composerWrap,
          {
            backgroundColor: theme.colors.background,
            paddingBottom: Math.max(4, insets.bottom),
          },
        ]}
      >
        <Composer
          theme={theme}
          placeholder="Type a message or hold to talk..."
          value={input}
          onChangeText={onChangeInput}
          attachments={pendingAttachments}
          imageAuthToken={bearerToken}
          availableModels={AVAILABLE_MODELS}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          availableReasoningEfforts={AVAILABLE_REASONING_EFFORTS}
          selectedReasoningEffort={selectedReasoningEffort}
          onSelectReasoningEffort={onSelectReasoningEffort}
          onAddAttachment={() => setIsMediaManagerOpen(true)}
          onRemoveAttachment={onRemoveAttachment}
          isRecording={isRecordingAudio}
          isTranscribingAudio={isTranscribingAudio}
          voiceDurationMillis={voiceDurationMillis}
          onToggleVoiceInput={onToggleVoiceInput}
          onSend={onSendMessage}
          disabled={isStreaming}
        />
        <MediaManagerModal
          visible={isMediaManagerOpen}
          theme={theme}
          baseUrl={baseUrl}
          bearerToken={bearerToken}
          onClose={() => setIsMediaManagerOpen(false)}
          onSelectMedia={onAddExistingMediaAttachment}
          onUploadNew={async () => {
            setIsMediaManagerOpen(false);
            await onAddAttachment();
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 100,
    paddingBottom: 220,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    paddingTop: 44,
    paddingHorizontal: 22,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 10,
  },
  promptCard: {
    marginHorizontal: 84,
    marginTop: 44,
    borderRadius: 28,
    overflow: 'hidden',
  },
  promptText: {
    fontSize: 24,
    lineHeight: 42,
    paddingHorizontal: 30,
    paddingTop: 28,
    paddingBottom: 34,
  },
  moreBar: {
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  moreText: {
    fontSize: 16,
    fontWeight: '500',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
    gap: 14,
  },
  agentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 24,
    fontWeight: '500',
  },
  duration: {
    marginTop: 30,
    marginHorizontal: 30,
    textAlign: 'center',
    fontSize: 18,
  },
  summarySection: {
    paddingHorizontal: 30,
    paddingTop: 34,
  },
  summaryHeading: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 18,
  },
  summarySubheading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },
  summaryItem: {
    fontSize: 18,
    lineHeight: 34,
    marginBottom: 14,
  },
  chatSection: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  chatSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  chatHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  jumpButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -28,
    bottom: 150,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  composerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
