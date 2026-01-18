const DEFAULT_API_BASE_URL = 'https://hrt-service.transmtf.com/api';

type RuntimeEnv = {
  VITE_API_BASE_URL?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  __ENV__?: {
    VITE_API_BASE_URL?: string;
    VITE_TURNSTILE_SITE_KEY?: string;
  };
};

const runtimeEnv = globalThis as RuntimeEnv;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  runtimeEnv.VITE_API_BASE_URL ||
  runtimeEnv.__ENV__?.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL;

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  runtimeEnv.VITE_TURNSTILE_SITE_KEY ||
  runtimeEnv.__ENV__?.VITE_TURNSTILE_SITE_KEY ||
  '';
