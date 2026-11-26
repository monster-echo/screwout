#!/usr/bin/env python3
"""Poll App Store Connect until an uploaded build finishes processing.

Waits for the build to appear, then for processingState VALID. Fails the run
on FAILED/INVALID so a broken upload is caught in CI instead of at submit time.

Env: APPSTORE_KEY_ID, APPSTORE_ISSUER, APPSTORE_PRIVATE_KEY (p8 contents).
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

import jwt

API = 'https://api.appstoreconnect.apple.com/v1'


def token():
    key = os.environ['APPSTORE_PRIVATE_KEY'].replace('\\n', '\n')
    now = int(time.time())
    return jwt.encode({'iss': os.environ['APPSTORE_ISSUER'], 'iat': now,
                       'exp': now + 900, 'aud': 'appstoreconnect-v1'}, key,
                      algorithm='ES256', headers={'kid': os.environ['APPSTORE_KEY_ID']})


def get(path):
    req = urllib.request.Request(API + path, headers={
        'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b'{}')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bundle', default='tech.zhongbei.screwout')
    ap.add_argument('--build', required=True)
    args = ap.parse_args()

    apps = get('/apps?' + urllib.parse.urlencode({'filter[bundleId]': args.bundle}))
    app_id = apps['data'][0]['id']
    q = urllib.parse.urlencode({'filter[app]': app_id,
                                'filter[version]': args.build, 'limit': 10})
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        builds = get('/builds?' + q).get('data', [])
        if builds:
            state = builds[0]['attributes']['processingState']
            print(f'ASC build {args.build}: {state}', flush=True)
            if state == 'VALID':
                return 0
            if state in ('FAILED', 'INVALID'):
                return 2
        else:
            print(f'waiting for build {args.build} to appear in ASC', flush=True)
        time.sleep(30)
    print('processing still pending after 20 minutes')
    return 2


if __name__ == '__main__':
    sys.exit(main())
