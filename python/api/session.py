#import { CookieJar } from 'cookiejar';
#import { RequestOptions } from 'https';
#import {
#  AUTH_URL,
#  HOMEPAGE_HOST,
#  HOMEPAGE_PATH,
#  MAX_REDIRECTS,
#} from 'src/utils/constants';
#import { request, RequestResponse } from './request';
from aiohttp import ClientSession, CookieJar

from collections import namedtuple
from asyncio import get_event_loop
from time import time
from urllib.parse import urljoin
from re import compile as regex

# 5 minutes
MIN_AUTH_LENGTH = 1000 * 60 * 5

# 1 hour
MAX_AUTH_LENGTH = 1000 * 60 * 60

def extract_and_mutate_search_params(attr, params):
    ret = {}
    for key in attr:
        params_key = params.get(key)
        if params_key is not None:
            ret[key] = params_key
            del params[key]

    return ret

AuthState = namedtuple("AuthState", [
    "week_offset",
    "params",
    "auth_time"
])

def attach_auth_params(auth_state, include_session_params=False):
    params = dict()

    # TODO - Patch this to work with back-end web framework being used
    auth_params = auth_state.params
    for key in url.params.keys():
        if key in auth_params:
            del auth_params[key]

    if include_session_params is True:
        for key, value in auth_params.items():
            params[key] = value

    elif isinstance(include_session_params, list):
        for key, value in auth_params.items():
            if key in include_session_params:
                params[key] = value

    return params

class AuthSession:
    def __init__(self, username):
        self.username = username
        self._session = ClientSession(cookie_jar=CookieJar())

        self._auth_state = None
        self._auth_refresh_promise = None

    async def do_api_request(
        self,
        req_url,
        follow_redirects=False,
        include_session_params=False,
        **kwargs
    ):
        auth_state = self._auth_state
        auth_time = self._auth_state.auth_time
        if auth_state is None or auth_time + MAX_AUTH_LENGTH < time():
            auth_state = await self.refresh_auth()

        params = attach_auth_params(req_url, auth_state, include_session_params)
        kwargs["params"] = params

        url = req_url

        res = None
        redirects = 0
        while True:
            async with self._session as sess:
                async with sess.get(url, follow_redirects, **kwargs) as res:
                    if res.status not in [301, 302]:
                        break

                    if res.headers.get("location") is None:
                        raise Exception("""
                        Invalid redirect, location header not provided.
                        """.strip())

                    new_url = urljoin(url, r.headers.get("location"))
                    pattern = regex(r"error\.aspx$")
                    if pattern.search(new_url) is not None:
                        if auth_time + MIN_AUTH_LENGTH > time():
                            raise Exception("Server responded with an error")

                        args = follow_redirect, include_session_params
                        await self.refresh_auth()
                        return self.do_api_request(req_url, *args, **kwargs)

                    if not follow_redirects:
                        break

                    url = new_url
                    params = attach_auth_params(url, auth_state,
                        include_session_params)
                    kwargs["params"] = params

                    if redirects >= MAX_REDIRECTS:
                        raise Exception(f"""
                        Request failed, too many redirects: {req_url}
                        """.strip())

                    redirects = redirects + 1

    return res

"""
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
"""
