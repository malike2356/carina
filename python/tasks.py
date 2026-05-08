import os
from celery import Celery

redis_url = f"redis://{os.getenv('REDIS_HOST', 'redis')}:{os.getenv('REDIS_PORT', 6379)}/0"

app = Celery("carina", broker=redis_url, backend=redis_url)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/London",
    enable_utc=True,
)


@app.task
def health_check():
    return {"status": "ok"}
