from api.session import AuthSession
from utils.constants import (
    USERNAME,
    HOMEPAGE_HOST,
    HOMEPAGE_PATH
)

from asyncio import get_event_loop

def completed(future):
    future.get_loop().create_task(auth_sess.close())
    print("COMPLETED", future.result())

loop = get_event_loop()
auth_sess = AuthSession(USERNAME, loop=loop)
url = "https://" + HOMEPAGE_HOST + HOMEPAGE_PATH + "?weekOffset=0"
task = loop.create_task(
    auth_sess.do_api_request(url, include_session_params=True)
)
task.add_done_callback(completed)
loop.run_until_complete(task)
