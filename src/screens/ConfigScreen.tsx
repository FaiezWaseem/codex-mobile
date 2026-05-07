import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '../theme/tokens';
import type { AgentConfig } from '../types';

type ConfigDraft = {
  baseUrl: string;
  bearerToken: string;
};

export function ConfigScreen({
  theme,
  initialConfig,
  required,
  onSave,
  onClose,
}: {
  theme: AppTheme;
  initialConfig?: AgentConfig | null;
  required: boolean;
  onSave: (config: ConfigDraft) => Promise<void>;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? '');
  const [bearerToken, setBearerToken] = useState(initialConfig?.bearerToken ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSave = Boolean(baseUrl.trim() && bearerToken.trim()) && !submitting;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSave({
        baseUrl,
        bearerToken,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.shell,
          {
            paddingTop: Math.max(28, insets.top + 16),
            paddingBottom: Math.max(24, insets.bottom + 10),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Agent Setup</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Add your relay base URL and bearer token to enable real agent chat.
            </Text>
          </View>
          {!required && onClose ? (
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: theme.colors.primary }]}>Close</Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.text }]}>Base URL</Text>
          <TextInput
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://127.0.0.1:9856"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.input,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
          />

          <Text style={[styles.label, styles.labelSpacing, { color: theme.colors.text }]}>
            Bearer Token
          </Text>
          <TextInput
            value={bearerToken}
            onChangeText={setBearerToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="relay token"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.input,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
          />

          <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
            The app stores this locally with AsyncStorage and reuses it on launch.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[
              styles.saveButton,
              {
                backgroundColor: canSave ? theme.colors.primary : theme.colors.surfaceMuted,
              },
            ]}
          >
            <Text
              style={[
                styles.saveButtonText,
                { color: canSave ? '#FFFFFF' : theme.colors.textMuted },
              ]}
            >
              {submitting ? 'Saving...' : 'Save Configuration'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
    paddingRight: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    paddingVertical: 6,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  labelSpacing: {
    marginTop: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 12,
  },
  saveButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
