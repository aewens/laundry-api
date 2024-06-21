from aiohttp import ClientSession, CookieJar

from utils.constants import (
  AUTH_URL,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  MAX_REDIRECTS
)

from collections import namedtuple
from asyncio import get_event_loop, Future, Task
from time import time
from urllib.parse import urljoin, urlsplit, parse_qs
from re import compile as regex
from copy import deepcopy

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
    "params",
    "auth_time"
])

def simplify_qs(qs):
    return {k: v[-1] for k, v in qs.items()}

def attach_auth_params(url, auth_state, include_session_params=False):
    params = dict()

    auth_params = deepcopy(auth_state.params)
    for key in parse_qs(urlsplit(url).query).keys():
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
        self._session = ClientSession(cookie_jar=CookieJar(), requote_redirect_url = False)

        self._auth_state = AuthState(dict(), 0)
        self._auth_refresh_promise = None

        self._loop = loop
        if self._loop is None:
            # If no event loop was given, create one and start it
            self._loop = get_event_loop()
            self._loop.run_forever()

    def spawn(self, fn):
        task = self._loop.create_task(fn())
        return task

    async def do_api_request(
        self,
        req_url,
        follow_redirects=False,
        include_session_params=False,
        **kwargs
    ):
        auth_state = self._auth_state
        if auth_state is not None:
            auth_time = self._auth_state.auth_time

        if auth_state is None or auth_time + MAX_AUTH_LENGTH < time():
            auth_state = await self._refresh_auth()

        params = attach_auth_params(req_url, auth_state, include_session_params)
        kwargs["params"] = params
        kwargs["allow_redirects"] = follow_redirects

        url = req_url
        res = None
        redirects = 0
        while True:
            async with self._session.get(url, **kwargs) as res:
                if res.status not in [301, 302]:
                    break

                if res.headers.get("location") is None:
                    raise Exception("""
                    Invalid redirect, location header not provided.
                    """.strip())

            new_url = urljoin(url, res.headers.get("location"))
            pattern = regex(r"Error\.aspx(?:$|\?|#)")
            if pattern.search(new_url) is not None:
                if auth_time + MIN_AUTH_LENGTH > time():
                    raise Exception("Server responded with an error")

                await self._refresh_auth()

                args = follow_redirects, include_session_params
                res = await self.do_api_request(req_url, *args, **kwargs)
                return res

            if not follow_redirects:
                break

            url = new_url
            params = attach_auth_params(url, auth_state,
                include_session_params)
            kwargs["params"] = params.items()

            if redirects >= MAX_REDIRECTS:
                raise Exception(f"""
                Request failed, too many redirects: {req_url}
                """.strip())

            redirects = redirects + 1

        return res

    async def close(self):
        if not self._session.closed:
            await self._session.close()

    async def _do_refresh_auth(self):
        params = dict()
        params["username"] = self.username

        kwargs = dict()
        kwargs["params"] = params
        kwargs["allow_redirects"] = False

        url = AUTH_URL

        res = None
        redirects = 0
        while True:
            async with self._session.get(url, **kwargs) as res:
                if "params" in kwargs: del kwargs["params"]
                location = res.headers.get("location")
                if res.status != 302 or location is None:
                    raise Exception(f"""
                    Authentication failed, loop when to non-redirect
                    """.strip())

            url = urljoin(url, location)
            parsed_url = urlsplit(url)
            if parsed_url.netloc == HOMEPAGE_HOST and parsed_url.path == HOMEPAGE_PATH:
                break

            if redirects >= MAX_REDIRECTS:
                raise Exception("Maximum redirects reached")

            redirects = redirects + 1

        params = simplify_qs(parse_qs(urlsplit(url).query))
        mutate = extract_and_mutate_params(["weekOffset"], params)
        week_offset = mutate.get("weekOffset")
        if week_offset is None or not week_offset.isnumeric():
            raise Exception("weekOffset did not resolve to numeric")

        self._auth_state = AuthState(params, time())
        return self._auth_state

    def _reset_promise(self, future):
        self._auth_refresh_promise = None

    def _handle_future(self, future):
        exception = future.exception()
        if exception is None:
            self._auth_refresh_promise.set_result(future.result())

        else:
            self._auth_refresh_promise.set_exception(exception)

    async def _refresh_auth(self):
        if self._auth_refresh_promise is None:
            future = self._loop.create_future()
            self._auth_refresh_promise = future
            future.add_done_callback(self._reset_promise)
            task = self._loop.create_task(self._do_refresh_auth())
            task.add_done_callback(self._handle_future)

        return await self._auth_refresh_promise
