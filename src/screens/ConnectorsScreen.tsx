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

type RelayConnector = {
  id?: string;
  name?: string;
  category?: string;
  authentication?: string;
  installation?: string;
  source?: string;
  path?: string;
};

type RelayDirectoryResponse<T> = {
  items?: T[];
  data?: T[];
  connectors?: T[];
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

  return payload.connectors || payload.items || payload.data || [];
}

export function ConnectorsScreen({
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
  const [connectors, setConnectors] = useState<RelayConnector[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnectors = useCallback(async () => {
    if (!baseUrl.trim() || !bearerToken.trim()) {
      console.log('[connectors] relay not configured', {
        hasBaseUrl: Boolean(baseUrl.trim()),
        hasBearerToken: Boolean(bearerToken.trim()),
      });
      setError('Relay is not configured.');
      setConnectors([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestUrl = buildRelayUrl(baseUrl, '/v1/connectors');
      console.log('[connectors] fetching', {
        baseUrl,
        requestUrl,
      });

      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      console.log('[connectors] response', {
        requestUrl,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[connectors] error response body', {
          requestUrl,
          status: response.status,
          body: errorText,
        });
        throw new Error(`Connectors request failed (${response.status})`);
      }

      const payload = (await response.json()) as
        | RelayDirectoryResponse<RelayConnector>
        | RelayConnector[];
      const nextConnectors = getRelayItems(payload);

      console.log('[connectors] payload summary', {
        requestUrl,
        isArray: Array.isArray(payload),
        topLevelKeys: Array.isArray(payload) ? [] : Object.keys(payload),
        count: nextConnectors.length,
        firstConnector: nextConnectors[0] ?? null,
      });

      setConnectors(nextConnectors);
    } catch (nextError) {
      console.log('[connectors] load failed', {
        error: nextError instanceof Error ? nextError.message : String(nextError),
      });
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to load connectors right now.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, bearerToken]);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadConnectors();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadConnectors]);

  const filteredConnectors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return connectors;
    }

    return connectors.filter((connector) =>
      [
        connector.name,
        connector.id,
        connector.category,
        connector.authentication,
        connector.installation,
        connector.source,
        connector.path,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [connectors, query]);

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
            <Text style={[styles.heading, { color: theme.colors.text }]}>Connectors</Text>
            <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
              Browse relay-discovered connectors
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
            placeholder="Search connectors"
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
            {filteredConnectors.length} connector{filteredConnectors.length === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
            Pull down to refresh the available connector list from the relay.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
              Loading connectors...
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
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              Unable to load connectors
            </Text>
            <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>{error}</Text>
            <Pressable
              onPress={() => void loadConnectors()}
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : filteredConnectors.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              No connectors found
            </Text>
            <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>
              {query.trim()
                ? 'Try a different search term.'
                : 'The relay did not return any connectors.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredConnectors.map((connector) => (
              <View
                key={connector.id || connector.name}
                style={[
                  styles.connectorCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.connectorTitle, { color: theme.colors.text }]}>
                  {connector.name || connector.id || 'Untitled connector'}
                </Text>
                {connector.id ? (
                  <Text style={[styles.connectorMetaPrimary, { color: theme.colors.primary }]}>
                    {connector.id}
                  </Text>
                ) : null}
                <Text style={[styles.connectorMeta, { color: theme.colors.textMuted }]}>
                  {connector.category || 'Uncategorized'} • {connector.authentication || 'Unknown auth'}
                </Text>
                <Text style={[styles.connectorMeta, { color: theme.colors.textMuted }]}>
                  {connector.installation || 'Unknown install'} • {connector.source || 'Unknown source'}
                </Text>
                {connector.path ? (
                  <Text style={[styles.connectorPath, { color: theme.colors.textMuted }]}>
                    {connector.path}
                  </Text>
                ) : null}
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
  connectorCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  connectorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  connectorMetaPrimary: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  connectorMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  connectorPath: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
