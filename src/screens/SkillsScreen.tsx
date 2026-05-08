import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components';
import type { AppTheme } from '../theme/tokens';

type RelaySkill = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
};

type RelayDirectoryResponse<T> = {
  items?: T[];
  data?: T[];
  skills?: T[];
};

function buildRelayUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const relayBaseUrl = normalizedBaseUrl.endsWith('/v1')
    ? normalizedBaseUrl.slice(0, -3)
    : normalizedBaseUrl;

  return `${relayBaseUrl}${path}`;
}

function getRelayItems<T>(payload: RelayDirectoryResponse<T> | T[] | null | undefined): T[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.skills || payload.items || payload.data || [];
}

export function SkillsScreen({
  theme,
  baseUrl,
  bearerToken,
  onBack,
}: {
  theme: AppTheme;
  baseUrl: string;
  bearerToken: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState<RelaySkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    if (!baseUrl.trim() || !bearerToken.trim()) {
      console.log('[skills] relay not configured', {
        hasBaseUrl: Boolean(baseUrl.trim()),
        hasBearerToken: Boolean(bearerToken.trim()),
      });
      setError('Relay is not configured.');
      setSkills([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestUrl = buildRelayUrl(baseUrl, '/v1/skills');
      console.log('[skills] fetching', {
        baseUrl,
        requestUrl,
      });

      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      console.log('[skills] response', {
        requestUrl,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[skills] error response body', {
          requestUrl,
          status: response.status,
          body: errorText,
        });
        throw new Error(`Skills request failed (${response.status})`);
      }

      const payload = (await response.json()) as RelayDirectoryResponse<RelaySkill> | RelaySkill[];
      const nextSkills = getRelayItems(payload);

      console.log('[skills] payload summary', {
        requestUrl,
        isArray: Array.isArray(payload),
        topLevelKeys: Array.isArray(payload) ? [] : Object.keys(payload),
        count: nextSkills.length,
        firstSkill: nextSkills[0] ?? null,
      });

      setSkills(nextSkills);
    } catch (nextError) {
      console.log('[skills] load failed', {
        error: nextError instanceof Error ? nextError.message : String(nextError),
      });
      setError(nextError instanceof Error ? nextError.message : 'Unable to load skills right now.');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, bearerToken]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadSkills();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSkills]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return skills;
    }

    return skills.filter((skill) =>
      [skill.title, skill.name, skill.id, skill.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, skills]);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(20, insets.top + 8),
            paddingBottom: Math.max(30, insets.bottom + 18),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <IconButton theme={theme} icon="chevron-back" onPress={onBack} />
          <View style={styles.headerText}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>Skills</Text>
            <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
              Browse relay-discovered skills
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.searchShell,
            {
              backgroundColor: theme.colors.input,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search skills"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
            {filteredSkills.length} skill{filteredSkills.length === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
            Pull down to refresh the available skill list from the relay.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
              Loading skills...
            </Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Unable to load skills</Text>
            <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>{error}</Text>
            <Pressable
              onPress={() => void loadSkills()}
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : filteredSkills.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>No skills found</Text>
            <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>
              {query.trim() ? 'Try a different search term.' : 'The relay did not return any skills.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredSkills.map((skill) => (
              <View
                key={skill.id || skill.name || skill.title}
                style={[
                  styles.skillCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.skillTitle, { color: theme.colors.text }]}>
                  {skill.title || skill.name || skill.id || 'Untitled skill'}
                </Text>
                {skill.id ? (
                  <Text style={[styles.skillMeta, { color: theme.colors.primary }]}>
                    {skill.id}
                  </Text>
                ) : null}
                <Text style={[styles.skillDescription, { color: theme.colors.textMuted }]}>
                  {skill.description || 'No description available.'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    fontSize: 16,
    marginLeft: 10,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  centerState: {
    alignItems: 'center',
    paddingTop: 28,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listWrap: {
    gap: 12,
  },
  skillCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  skillTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  skillMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  skillDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
