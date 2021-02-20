/* eslint-disable no-console */
import '../../loadenv';

export const {
  MAX_REDIRECTS,
  AUTH_URL,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  USERNAME,
} = (() => {
  const maxRedirStr = process.env.MAX_REDIRECTS;
  const maxRedirNum =
    maxRedirStr == null ? NaN : Number.parseInt(maxRedirStr, 10);
  const rawAuthUrl = process.env.AUTH_URL;
  const rawHomepageHost = process.env.HOMEPAGE_HOST;
  const rawHomepagePath = process.env.HOMEPAGE_PATH;
  const rawUsername = process.env.USERNAME;
  if (!rawUsername) {
    console.error('USERNAME env var not provided');
    process.exit(1);
  }
  if (!rawAuthUrl) {
    console.error('AUTH_URL env var not provided');
    process.exit(1);
  }
  if (!rawHomepageHost) {
    console.error('HOMEPAGE_HOST env var not provided');
    process.exit(1);
  }
  if (!rawHomepagePath) {
    console.error('HOMEPAGE_PATH env var not provided');
    process.exit(1);
  }

  return {
    MAX_REDIRECTS: maxRedirNum >= 0 ? maxRedirNum : 5,
    AUTH_URL: rawAuthUrl,
    HOMEPAGE_HOST: rawHomepageHost,
    HOMEPAGE_PATH: rawHomepagePath,
    USERNAME: rawUsername,
  };
})();
