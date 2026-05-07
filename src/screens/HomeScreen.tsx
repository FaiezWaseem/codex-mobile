import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
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
import { CapabilityChip, ChatMessageBubble, Composer, IconButton } from '../components';
import { capabilities, profile } from '../data/mock';
import type { AppTheme } from '../theme/tokens';
import type { ChatMessage } from '../types';

export function HomeScreen({
  theme,
  onOpenTasks,
  onOpenSettings,
  input,
  isStreaming,
  messages,
  onChangeInput,
  onSendMessage,
}: {
  theme: AppTheme;
  onOpenTasks: () => void;
  onOpenSettings: () => void;
  input: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  onChangeInput: (value: string) => void;
  onSendMessage: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

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
        <View style={styles.topBar}>
          <View style={styles.ghostButton}>
            <IconButton theme={theme} icon="chevron-back" onPress={onOpenTasks} />
          </View>
          <Pressable onPress={onOpenSettings} style={styles.ghostButton}>
            <Ionicons name="person-circle-outline" size={34} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={[styles.heroText, { color: theme.colors.text }]}>
            Hey <Text>{String.fromCodePoint(0x1F44B)}</Text> {profile.name}{'\n'}
            How can Codex help today?
          </Text>
        </View>

        <View style={styles.capabilities}>
          {messages.length === 0
            ? capabilities.map((item) => (
                <CapabilityChip
                  key={item.id}
                  theme={theme}
                  icon={item.icon as never}
                  label={item.label}
                />
              ))
            : null}
        </View>

        {messages.length > 0 ? (
          <View style={styles.chatThread}>
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} theme={theme} message={message} />
            ))}
          </View>
        ) : null}

        <View style={styles.helperBlock}>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            {isStreaming
              ? 'Codex is streaming a dummy reply...'
              : 'Send a message to start a mock chat with streaming.'}
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomArea,
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
          onSend={onSendMessage}
          disabled={isStreaming}
        />
        {/* <View style={styles.footerRow}>
          <View style={styles.cloudTag}>
            <Ionicons name="cloud-outline" size={18} color={theme.colors.textMuted} />
            <Text style={[styles.cloudText, { color: theme.colors.text }]}>Cloud</Text>
          </View>
          <Pressable onPress={onOpenTasks} style={styles.linkButton}>
            <Text style={[styles.linkText, { color: theme.colors.primary }]}>View tasks</Text>
          </Pressable>
        </View> */}
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
    paddingTop: 128,
    paddingBottom: 280,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 14,
  },
  ghostButton: {
    width: 52,
    alignItems: 'flex-end',
  },
  hero: {
    paddingHorizontal: 30,
    paddingTop: 35,
  },
  heroText: {
    fontSize: 28,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontWeight: '400',
  },
  capabilities: {
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  chatThread: {
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  helperBlock: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cloudTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloudText: {
    fontSize: 18,
  },
  linkButton: {
    padding: 6,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
