/* eslint-disable no-console */
import 'src/../loadenv';
import { load } from 'cheerio';

export type Root = typeof load extends (attr: never) => infer T ? T : never;
export type Cheerio = Root extends (...args: never[]) => infer T ? T : never;

export enum Status {
  Own = 'own',
  Available = 'available',
  NotYetAvailable = 'notYetAvailable',
  Expired = 'expired',
  Taken = 'taken',
}

export const statusMap = {
  'images/icon_own.png': Status.Own,
  'images/icon_plus.png': Status.Available,
  'images/icon_plus_not.png': Status.NotYetAvailable,
  'images/icon_expired.png': Status.Expired,
  'images/icon_no.png': Status.Taken,
} as const;
export type RawStatus = keyof typeof statusMap;

export const {
  MAX_REDIRECTS,
  AUTH_URL,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  COMMAND_PATH,
  USERNAME,
} = (() => {
  const maxRedirStr = process.env.MAX_REDIRECTS;
  const maxRedirNum =
    maxRedirStr == null ? NaN : Number.parseInt(maxRedirStr, 10);
  const rawAuthUrl = process.env.AUTH_URL;
  const rawHomepageHost = process.env.HOMEPAGE_HOST;
  const rawHomepagePath = process.env.HOMEPAGE_PATH;
  const rawCommandPath = process.env.COMMAND_PATH;
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

  if (!rawCommandPath) {
    console.error('COMMAND_PATH env var not provided');
    process.exit(1);
  }

  return {
    MAX_REDIRECTS: maxRedirNum >= 0 ? maxRedirNum : 5,
    AUTH_URL: rawAuthUrl,
    HOMEPAGE_HOST: rawHomepageHost,
    HOMEPAGE_PATH: rawHomepagePath,
    COMMAND_PATH: rawCommandPath,
    USERNAME: rawUsername,
  };
})();
