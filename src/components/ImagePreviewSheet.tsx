import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import type { AppTheme } from '../theme/tokens';

function shouldAttachAuthHeaders(uri: string | undefined, token: string | undefined) {
  return Boolean(token && uri && /^https?:\/\//i.test(uri));
}

export function ImagePreviewSheet({
  visible,
  theme,
  imageUri,
  imageAuthToken,
  title,
  onClose,
}: {
  visible: boolean;
  theme: AppTheme;
  imageUri?: string | null;
  imageAuthToken?: string;
  title?: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
                {title || 'Image preview'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Tap outside to close
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
            >
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <View
            style={[
              styles.imageFrame,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {imageUri ? (
              <Image
                source={{
                  uri: imageUri,
                  headers: shouldAttachAuthHeaders(imageUri, imageAuthToken)
                    ? {
                        Authorization: `Bearer ${imageAuthToken}`,
                      }
                    : undefined,
                }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    minHeight: '92%',
    maxHeight: '96%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFrame: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
