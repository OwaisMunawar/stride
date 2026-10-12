import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { type AppServices } from './AppServices';

const ServicesContext = createContext<AppServices | null>(null);

/**
 * Provides the service container. The app passes a factory; tests pass a
 * ready-made container built on an in-memory database and fake engines.
 */
export function ServicesProvider({
  create,
  services: provided,
  fallback,
  renderError,
  children,
}: {
  create?: () => Promise<AppServices>;
  services?: AppServices;
  fallback?: ReactNode;
  renderError?: (error: Error) => ReactNode;
  children: ReactNode;
}) {
  const [services, setServices] = useState<AppServices | null>(provided ?? null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (provided || !create) return;
    let alive = true;
    let created: AppServices | null = null;
    create().then(
      (result) => {
        created = result;
        if (alive) setServices(result);
        else result.dispose();
      },
      (cause: unknown) =>
        alive && setError(cause instanceof Error ? cause : new Error(String(cause))),
    );
    return () => {
      alive = false;
      created?.dispose();
    };
  }, [create, provided]);

  if (error) return renderError?.(error) ?? null;
  if (!services) return fallback ?? null;
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): AppServices {
  const services = use(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
