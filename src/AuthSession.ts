import { CookieJar } from 'cookiejar';
import { RequestOptions } from 'https';
import { request, RequestResponse } from 'src/utils/request';
import {
  AUTH_URL,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  MAX_REDIRECTS,
} from 'src/utils/constants';

// 5 minutes
const MIN_AUTH_LENGTH = 1000 * 60 * 5;

// 1 hour
const MAX_AUTH_LENGTH = 1000 * 60 * 60;

function extractAndMutateSearchParams<T extends string>(
  attr: readonly T[],
  params: URLSearchParams,
): {
  [key in T]: string | null;
} {
  const ret = {} as {
    [key in T]: string | null;
  };
  for (const key of attr) {
    ret[key] = params.get(key);
    params.delete(key);
  }
  return ret;
}

interface AuthState {
  weekOffset: number;
  searchParams: URLSearchParams;
  authTime: number;
}

function attachAuthParams(
  url: URL,
  authState: AuthState,
  includeSessionSearchParams?: string[] | boolean,
) {
  if (includeSessionSearchParams === true) {
    const authParams = new URLSearchParams(authState.searchParams);
    for (const key of url.searchParams.keys()) {
      authParams.delete(key);
    }
    for (const [key, val] of authParams.entries()) {
      url.searchParams.append(key, val);
    }
  }
  if (Array.isArray(includeSessionSearchParams)) {
    const authParams = new URLSearchParams(authState.searchParams);
    for (const key of url.searchParams.keys()) {
      authParams.delete(key);
    }
    for (const [key, val] of authParams.entries()) {
      if (key in includeSessionSearchParams) url.searchParams.append(key, val);
    }
  }
}

export default class AuthSession {
  private cookieJar: CookieJar;

  readonly username: string;

  private authRefreshPromise: Promise<AuthState> | null = null;

  private authState: AuthState | null = null;

  constructor(username: string) {
    this.username = username;
    this.cookieJar = new CookieJar();
  }

  public async doApiRequest(
    reqUrl: URL | string,
    fullOptions: RequestOptions & {
      followRedirects?: boolean;
      includeSessionSearchParams?: string[] | boolean;
    },
  ): Promise<RequestResponse> {
    let { authState } = this;
    if (
      authState == null ||
      authState.authTime + MAX_AUTH_LENGTH < Date.now()
    ) {
      authState = await this.refreshAuth();
    }
    const {
      followRedirects,
      includeSessionSearchParams,
      ...options
    } = fullOptions;
    let url = reqUrl instanceof URL ? reqUrl : new URL(reqUrl);
    attachAuthParams(url, authState, includeSessionSearchParams);
    console.log(url);
    let res: RequestResponse;
    let redirects = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      res = await request(url, options, this.cookieJar);
      if (res.statusCode === 302 || res.statusCode === 301) {
        if (res.headers.location == null) {
          throw new Error('Invalid redirect, location header not provided.');
        }
        const newUrl = new URL(res.headers.location, url);
        if (/error\.aspx$/i.test(newUrl.pathname)) {
          if (authState.authTime + MIN_AUTH_LENGTH > Date.now()) {
            throw new Error('Server responded with an error');
          } else {
            // eslint-disable-next-line no-await-in-loop
            await this.refreshAuth();
            // eslint-disable-next-line no-continue
            return this.doApiRequest(reqUrl, fullOptions);
          }
        }
        if (!followRedirects) {
          break;
        }
        url = newUrl;
        attachAuthParams(url, authState, includeSessionSearchParams);
      } else {
        break;
      }
      if (redirects >= MAX_REDIRECTS) {
        throw new Error(
          `Request failed, too many redirects: ${
            reqUrl instanceof URL ? reqUrl.href : reqUrl
          }`,
        );
      }
      redirects += 1;
    }
    return res;
  }

  private async doRefreshAuth(): Promise<AuthState> {
    let url: URL = new URL(AUTH_URL);
    url.searchParams.set('username', this.username);
    let res: RequestResponse;
    let redirects = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      res = await request(url, undefined, this.cookieJar);
      if (res.statusCode === 302 && res.headers.location != null) {
        url = new URL(res.headers.location, url);
        if (url.host === HOMEPAGE_HOST && url.pathname === HOMEPAGE_PATH) {
          break;
        }
      } else {
        throw new Error('Authentication failed, loop went to non-redirect');
      }
      if (redirects >= MAX_REDIRECTS) {
        throw new Error('Maximum Redirects reached');
      }
      redirects += 1;
    }
    const { searchParams } = url;
    const { weekOffset } = extractAndMutateSearchParams(
      ['weekOffset'],
      searchParams,
    );
    const weekOffsetNum = (() => {
      if (!weekOffset) return 0;
      return Number.parseInt(weekOffset, 10);
    })();
    if (Number.isNaN(weekOffsetNum)) {
      throw new Error('WeekOffset resolved to NaN');
    }
    this.authState = {
      weekOffset: weekOffsetNum,
      searchParams,
      authTime: Date.now(),
    };
    return this.authState;
  }

  private refreshAuth(): Promise<AuthState> {
    if (this.authRefreshPromise == null) {
      this.authRefreshPromise = this.doRefreshAuth().finally(() => {
        this.authRefreshPromise = null;
      });
    }
    return this.authRefreshPromise;
  }
}
