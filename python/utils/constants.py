from typing import NamedTuple
from os import getenv, exit
from sys import stderr

class Status(NamedTuple):
    Own = "own"
    Available = "available"
    NotYetAvailable = "notYetAvailable"
    Expired = "expired"
    Taken = "taken"

StatusMap = {
    "images/icon_own.png": Status.Own,
    "images/icon_plus.png": Status.Available,
    "images/icon_plus_not.png": Status.NotYetAvailable,
    "images/icon_expired.png": Status.Expired,
    "images/icon_no.png": Status.Taken,
}

raw_max_redirects = getenv("MAX_REDIRECTS")
max_redirects_num = raw_max_redirects.isnumeric()
MAX_REDIRECTS = abs(int(raw_max_redirects)) if max_redirects_numeric() else 5
AUTH_URL = getenv("AUTH_URL")
HOMEPAGE_HOST = getenv("HOMEPAGE_HOST")
HOMEPAGE_PATH = getenv("HOMEPAGE_PATH")
COMMAND_PATH = getenv("COMMAND_PATH")
USERNAME = getenv("USERNAME")

env_varss = [
    AUTH_URL,
    HOMEPAGE_HOST,
    HOMEPAGE_PATH,
    COMMAND_PATH,
    USERNAME
]
if None in env_vars:
    envs = ", ".join([
        "AUTH_URL",
        "HOMEPAGE_HOST",
        "HOMEPAGE_PATH",
        "COMMAND_PATH",
        "USERNAME"
    ])
    message = "The following environment variables are required: "
    print(message + envs, file=stderr)
    exit(1)
