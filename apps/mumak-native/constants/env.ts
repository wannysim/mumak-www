import { type AppEnvironment, isAppEnvironment } from '@mumak/shared/types/app-environment';

export function resolveEnvironment(raw: string | undefined, isDev: boolean): AppEnvironment {
  const value = raw ?? (isDev ? 'development' : 'production');

  if (!isAppEnvironment(value)) {
    throw new Error(`Invalid EXPO_PUBLIC_APP_ENV "${value}". Expected one of: development, preview, production.`);
  }

  return value;
}

export type AppEnv = {
  environment: AppEnvironment;
  apiBaseUrl: string | undefined;
};

export const Env: AppEnv = {
  environment: resolveEnvironment(process.env.EXPO_PUBLIC_APP_ENV, __DEV__),
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
};
