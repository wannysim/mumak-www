export type AppEnvironment = 'development' | 'preview' | 'production';

export const APP_ENVIRONMENTS: readonly AppEnvironment[] = ['development', 'preview', 'production'];

const knownEnvironments: ReadonlySet<string> = new Set(APP_ENVIRONMENTS);

export function isAppEnvironment(value: string): value is AppEnvironment {
  return knownEnvironments.has(value);
}
