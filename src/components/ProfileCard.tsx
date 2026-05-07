import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme/tokens';

export function ProfileCard({
  theme,
  name,
  email,
  plan,
  avatar,
}: {
  theme: AppTheme;
  name: string;
  email: string;
  plan: string;
  avatar: string;
}) {
  return (
    <View style={styles.profileWrap}>
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <View style={styles.profileNameRow}>
        <Text style={[styles.profileName, { color: theme.colors.text }]}>{name}</Text>
        <View style={[styles.planPill, { backgroundColor: theme.colors.success }]}>
          <Text style={styles.planText}>{plan}</Text>
        </View>
      </View>
      <Text style={[styles.profileEmail, { color: theme.colors.textMuted }]}>{email}</Text>
      <Pressable
        style={[styles.editButton, { backgroundColor: theme.colors.surfaceElevated }]}
      >
        <Text style={[styles.editButtonText, { color: theme.colors.text }]}>Edit profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  profileWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 22,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '700',
  },
  planPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  planText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 18,
  },
  editButton: {
    borderRadius: 18,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  editButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
});
