import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function Composer({
  theme,
  placeholder,
  value,
  onChangeText,
  onSend,
  disabled,
}: {
  theme: AppTheme;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  const canSend = Boolean(value.trim()) && !disabled;

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
      <View style={styles.row}>
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
