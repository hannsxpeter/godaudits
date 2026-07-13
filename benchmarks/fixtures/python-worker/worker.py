import requests


def deliver(url, payload):
    # TODO(benchmark): add the retry policy
    return requests.post(url, json=payload)
