#!/usr/bin/env python3
"""Attach per-version What's New notes to the App Store version.

Reads release/app-store/release-notes/<version>/<locale>.txt and PATCHes
whatsNewText onto the matching App Store Connect version localization,
creating the version / localization records when needed. File stems must
use ASC locale codes directly (en-US, zh-Hans, ...).

Env: APPSTORE_KEY_ID, APPSTORE_ISSUER, APPSTORE_PRIVATE_KEY (p8 contents).
Exit 0 on success, 2 on any failure (notes are mandatory per release).
"""
import argparse
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

import jwt  # PyJWT[crypto]

API = 'https://api.appstoreconnect.apple.com/v1'
NOTES_ROOT = pathlib.Path(__file__).resolve().parent.parent / 'release/app-store/release-notes'


def token():
    key = os.environ['APPSTORE_PRIVATE_KEY'].replace('\\n', '\n')
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ['APPSTORE_ISSUER'], 'iat': now, 'exp': now + 900,
         'aud': 'appstoreconnect-v1'},
        key, algorithm='ES256', headers={'kid': os.environ['APPSTORE_KEY_ID']})


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(3):
        req = urllib.request.Request(API + path, data=data, method=method, headers={
            'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = {'raw': raw[:300].decode(errors='replace')}
            return e.code, parsed
        except Exception as e:  # transient network drops: retry
            last = e
            time.sleep(2 * (attempt + 1))
    return 0, {'raw': f'network error: {last}'}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bundle', default='tech.zhongbei.screwout')
    ap.add_argument('--version', required=True)
    args = ap.parse_args()

    s, apps = call('GET', '/apps?' + urllib.parse.urlencode({'filter[bundleId]': args.bundle}))
    app_id = (apps.get('data') or [{}])[0].get('id')
    if not app_id:
        print('ASC app record not found for', args.bundle)
        return 2

    q = urllib.parse.urlencode({'filter[versionString]': args.version, 'limit': 10})
    s, vers = call('GET', f'/apps/{app_id}/appStoreVersions?' + q)
    version = None
    for v in (vers.get('data') or []):
        if v['attributes'].get('platform') == 'IOS':
            version = v
            break
    if version is None:
        s, created = call('POST', '/appStoreVersions', {'data': {
            'type': 'appStoreVersions',
            'attributes': {'platform': 'IOS', 'versionString': args.version,
                           'releaseType': 'AFTER_APPROVAL'},
            'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})
        if s != 201:
            print('Could not create ASC version', args.version, 'HTTP', s, created)
            return 2
        version = created['data']
    vid = version['id']
    print(f'ASC version {args.version} [{version["attributes"].get("appStoreState")}] = {vid[:8]}')

    notes_dir = NOTES_ROOT / args.version
    if not notes_dir.is_dir():
        print(f'Missing what-is-new notes directory: {notes_dir}')
        return 2
    notes = []
    for f in sorted(notes_dir.glob('*.txt')):
        text = f.read_text().strip()
        if text:
            notes.append((f.stem, text))
    if not any(l == 'en-US' for l, _ in notes):
        print('en-US.txt what-is-new notes are mandatory.')
        return 2

    ok = True
    s, locs = call('GET', f'/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=30')
    existing = {l['attributes']['locale']: l['id'] for l in (locs.get('data') or [])}
    for locale, text in notes:
        loc_id = existing.get(locale)
        if loc_id is None:
            s, created = call('POST', '/appStoreVersionLocalizations', {'data': {
                'type': 'appStoreVersionLocalizations',
                'attributes': {'locale': locale},
                'relationships': {'appStoreVersion': {
                    'data': {'type': 'appStoreVersions', 'id': vid}}}}})
            if s != 201:
                print(f'{locale}: create localization -> HTTP {s}')
                print(json.dumps(created, ensure_ascii=False)[:300])
                ok = False
                continue
            loc_id = created['data']['id']
            print(f'{locale}: localization created')
        s, res = call('PATCH', f'/appStoreVersionLocalizations/{loc_id}', {'data': {
            'type': 'appStoreVersionLocalizations', 'id': loc_id,
            'attributes': {'whatsNew': text[:4000]}}})
        print(f'{locale}: whatsNew set -> HTTP {s}')
        if s != 200:
            print(json.dumps(res, ensure_ascii=False)[:300])
            ok = False
    return 0 if ok else 2


if __name__ == '__main__':
    sys.exit(main())
