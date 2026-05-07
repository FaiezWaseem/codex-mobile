import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AgentConfig } from '../types';

const STORAGE_KEY = 'codex.agent-config';

type AppConfigContextValue = {
  config: AgentConfig | null;
  hasConfig: boolean;
  isReady: boolean;
  saveConfig: (config: AgentConfig) => Promise<void>;
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

function normalizeConfig(config: AgentConfig): AgentConfig {
  return {
    ...config,
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
    bearerToken: config.bearerToken.trim(),
    model: config.model?.trim() || 'gpt-5.4-mini',
  };
}

export function AppConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
          setIsReady(true);
          return;
        }

        const parsed = JSON.parse(raw) as AgentConfig;

        if (parsed.baseUrl && parsed.bearerToken) {
          setConfig(normalizeConfig(parsed));
        }
      } finally {
        setIsReady(true);
      }
    }

    void loadConfig();
  }, []);

  const saveConfig = useCallback(async (nextConfig: AgentConfig) => {
    const normalized = normalizeConfig(nextConfig);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    setConfig(normalized);
  }, []);

  const value = useMemo(
    () => ({
      config,
      hasConfig: Boolean(config?.baseUrl && config?.bearerToken),
      isReady,
      saveConfig,
    }),
    [config, isReady, saveConfig],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const context = useContext(AppConfigContext);

  if (!context) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }

  return context;
}
