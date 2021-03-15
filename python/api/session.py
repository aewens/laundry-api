from aiohttp import ClientSession, CookieJar

from utils.constants import (
  AUTH_URL,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  MAX_REDIRECTS
)

from collections import namedtuple
from asyncio import get_event_loop
from time import time
from urllib.parse import urljoin
from re import compile as regex

MINUTE = 60
HOUR = 60 * MINUTE
MIN_AUTH_LENGTH = 5 * MINUTE
MAX_AUTH_LENGTH = 1 * HOUR

def extract_and_mutate_params(attr, params):
    ret = dict()
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
    def __init__(self, username, loop=None):
        self.username = username
        self._session = ClientSession(cookie_jar=CookieJar())

        self._auth_state = None
        self._auth_refresh_promise = None

        self._loop = loop
        if self._loop is None:
            # If no event loop was given, create one and start it
            self._loop = get_event_loop()
            self._loop.run_forever()

    async def spawn(self, fn):
        return self._loop.create_task(fn())

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
        kwargs["allow_redirects"] = follow_redirects

        url = req_url

        res = None
        redirects = 0
        while True:
            async with self._session as sess:
                async with sess.get(url, **kwargs) as res:
                    if res.status not in [301, 302]:
                        break

                    if res.headers.get("location") is None:
                        raise Exception("""
                        Invalid redirect, location header not provided.
                        """.strip())

            new_url = urljoin(url, res.headers.get("location"))
            pattern = regex(r"error\.aspx$")
            if pattern.search(new_url) is not None:
                if auth_time + MIN_AUTH_LENGTH > time():
                    raise Exception("Server responded with an error")

                await self.refresh_auth()

                args = follow_redirects, include_session_params
                res = await self.do_api_request(req_url, *args, **kwargs)
                return res

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

    async def _do_refresh_auth(self):
        params = dict()
        params["username"] = self.username

        kwargs = dict()
        kwargs["params"] = params
        kwargs["allow_redirects"] = True

        url = AUTH_URL

        res = None
        redirects = None
        while True:
            async with self._session as sess:
                async with sess.get(url, **kwargs) as res:
                    location = res.headers.get("location")
                    if res.status != 302 or location is None:
                        raise Exception(f"""
                        Authentication failed, loop when to non-redirect
                        """.strip())

            url = urljoin(url, location)
            if url == f"{HOMEPAGE_HOST}/{HOMEPAGE_PATH}":
                break

            if redirects >= MAX_REDIRECTS:
                raise Exception("Maximum redirects reached")

            redirects = redirects + 1

        mutate = extract_and_mutate_params(["weekOffset"], params)
        week_offset = mutate.get("weekOffset")
        if week_offset is None or not week_offset.isnumeric():
            raise Exception("weekOffset did not resolve to numeric")

        self._auth_state = AuthState(int(week_offset), params, time())

        return self._auth_state


    async def _reset_promise(self):
        self._auth_refresh_promise = None

    async def _refresh_auth(self):
        if self._auth_refresh_promise is None:
            self._auth_refresh_promise = self.spawn(self._do_refresh_auth())
            self._auth_refresh_promise.add_done_callback(self._reset_promise)

        return self._auth_refresh_promise
