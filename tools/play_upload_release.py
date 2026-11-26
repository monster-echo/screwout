#!/usr/bin/env python3
"""Upload a signed AAB to Google Play: internal (completed) + production (draft).

Pure API via a service-account JWT (PyJWT only, no Google client libraries).
Flow: edits.insert -> bundles.upload -> tracks(internal completed,
production draft) -> edits.commit -> new edit read-back to verify the bundle
landed on both tracks. Release notes are mandatory per version and live at
release/play-store/release-notes/<version>/<locale>.txt (en-US required,
stems are Play language codes like en-US, zh-CN).

Env: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the service-account JSON, verbatim).
Exit 0 on success, 2 on any failure. production stays a draft: promoting and
sending for review is tools/play_submit_review.py (or the console).
"""
import argparse
import json
import os
import pathlib
import sys
import time
import urllib.request

NOTES_ROOT = pathlib.Path(__file__).resolve().parent.parent / 'release/play-store/release-notes'


def auth(sa):
    import jwt
    now = int(time.time())
    assertion = jwt.encode(
        {'iss': sa['client_email'],
         'scope': 'https://www.googleapis.com/auth/androidpublisher',
         'aud': sa['token_uri'], 'iat': now, 'exp': now + 3600},
        sa['private_key'], algorithm='RS256')
    body = ('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='
            + assertion).encode()
    req = urllib.request.Request(sa['token_uri'], data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    return json.load(urllib.request.urlopen(req, timeout=60))['access_token']


def load_notes(version: str) -> list:
    base = NOTES_ROOT / version
    if not base.is_dir():
        raise SystemExit(
            f'Missing what-is-new notes: {base}/ with at least en-US.txt. '
            'Every release version must ship user-facing notes.')
    notes = []
    for f in sorted(base.glob('*.txt')):
        text = f.read_text().strip()[:500]
        if text:
            notes.append({'language': f.stem, 'text': text})
    if not any(n['language'] == 'en-US' for n in notes):
        raise SystemExit('en-US.txt what-is-new notes are mandatory.')
    return notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--package', default='tech.zhongbei.screwout')
    ap.add_argument('--aab', required=True)
    ap.add_argument('--version', required=True)
    args = ap.parse_args()

    key = json.loads(os.environ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'])
    api = ('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
           + args.package)
    upload = ('https://androidpublisher.googleapis.com/upload/androidpublisher/v3/'
              'applications/' + args.package)
    token = auth(key)
    headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

    def call(method, path, data=None, ctype='application/json'):
        payload = json.dumps(data).encode() if isinstance(data, (dict, list)) else (data or b'')
        req = urllib.request.Request(api + path, data=payload, method=method,
                                     headers=dict(headers, **{'Content-Type': ctype}))
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}

    edit = call('POST', '/edits')['id']
    print('edit', edit)

    aab = pathlib.Path(args.aab).read_bytes()
    req = urllib.request.Request(f'{upload}/edits/{edit}/bundles?uploadType=media',
                                 data=aab, method='POST',
                                 headers=dict(headers, **{'Content-Type': 'application/octet-stream'}))
    with urllib.request.urlopen(req, timeout=600) as resp:
        bundle = json.load(resp)
    code = str(bundle['versionCode'])
    print('AAB versionCode', code)

    notes = load_notes(args.version)
    internal = {'name': f'{args.version} ({code}) internal',
                'versionCodes': [code], 'status': 'completed', 'releaseNotes': notes}
    production = {'name': f'{args.version} ({code})',
                  'versionCodes': [code], 'status': 'draft', 'releaseNotes': notes}
    call('PUT', f'/edits/{edit}/tracks/internal',
         {'track': 'internal', 'releases': [internal]})
    call('PUT', f'/edits/{edit}/tracks/production',
         {'track': 'production', 'releases': [production]})
    call('POST', f'/edits/{edit}:commit')

    # Read back on a fresh edit: commit failures discard the whole edit, so a
    # successful read is the real confirmation.
    check = call('POST', '/edits')['id']
    try:
        for track in ('internal', 'production'):
            tr = call('GET', f'/edits/{check}/tracks/{track}')
            codes = [c for r in tr.get('releases', [])
                     for c in r.get('versionCodes', [])]
            if code not in codes:
                raise SystemExit(f'committed bundle missing from {track} track')
    finally:
        call('DELETE', f'/edits/{check}')
    print(f'Play upload verified on internal+production for versionCode {code}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
