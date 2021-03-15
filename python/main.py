from api.session import AuthSession

from asyncio import get_event_loop

def completed(future):
    print("COMPLETED", future.result())

loop = get_event_loop()
auth_sess = AuthSession("test", loop=loop)
task = loop.create_task(auth_sess.do_api_request("http://example.com"))
task.add_done_callback(completed)
loop.run_until_complete(task)
