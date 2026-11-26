#!/usr/bin/env python3
"""Single source of truth for the release version and build number.

The canonical values live in release/version.json ({"version": "X.Y.Z",
"build": N}). Build scripts read them with `get`; a human bumps them with
`set` before tagging. The build number must strictly increase with every
store upload — collisions fail the upload.

    eval "$(python3 tools/set_versions.py get)"          # version= build=
    python3 tools/set_versions.py set --version 1.0.1 --build 2
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / 'release/version.json'


def load() -> dict:
    if not VERSION_FILE.is_file():
        raise SystemExit(f'Missing {VERSION_FILE}')
    data = json.loads(VERSION_FILE.read_text())
    if not re.fullmatch(r'\d+\.\d+\.\d+', str(data.get('version', ''))):
        raise SystemExit(f'Invalid version in {VERSION_FILE}: {data.get("version")!r}')
    if not isinstance(data.get('build'), int) or data['build'] < 1:
        raise SystemExit(f'Invalid build in {VERSION_FILE}: {data.get("build")!r}')
    return data


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('get')
    sp = sub.add_parser('set')
    sp.add_argument('--version', required=True)
    sp.add_argument('--build', required=True, type=int)
    args = ap.parse_args()

    if args.cmd == 'get':
        data = load()
        print(f"version={data['version']}")
        print(f"build={data['build']}")
        return 0

    if not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        print(f'--version must be X.Y.Z, got {args.version!r}')
        return 1
    data = {'version': args.version, 'build': args.build}
    VERSION_FILE.write_text(json.dumps(data, indent=2) + '\n')
    print(f'{VERSION_FILE.relative_to(ROOT)} -> {args.version} build {args.build}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
