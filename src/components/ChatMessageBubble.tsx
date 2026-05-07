import { StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';
import type { ChatMessage } from '../types';

export function ChatMessageBubble({
  theme,
  message,
}: {
  theme: AppTheme;
  message: ChatMessage;
}) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.row,
        {
          alignItems: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderColor: isUser ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.content,
            {
              color: isUser ? '#FFFFFF' : theme.colors.text,
            },
          ]}
        >
          {message.content || (message.streaming ? '...' : '')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: 12,
  },
  bubble: {
    maxWidth: '82%',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  userBubble: {
    borderRadius: 24,
    borderBottomRightRadius: 8,
  },
  assistantBubble: {
    borderRadius: 24,
    borderBottomLeftRadius: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
});
