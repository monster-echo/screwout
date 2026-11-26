#!/usr/bin/env python3
"""Repack misaligned static archives shipped with Cocos Creator 3.8.6.

The vendored iOS .a libraries contain 64-bit mach-o members whose data does
not start on an 8-byte boundary. Apple's new linker (Xcode 26+) silently
drops such members, so native links fail with undefined symbols; the old
-ld_classic escape hatch was removed in Xcode 27. The fix is to extract the
members and rebuild the archive with libtool, which normalises alignment.

Only archives that actually contain misaligned mach-o64 members are touched,
so the pass is idempotent and skips the healthy ones. Fat (universal)
archives are split with lipo, repacked per slice, and recombined.

Usage: python3 tools/repack_libs.py <dir-with-.a-files> [<dir> ...]

On success a `.repacked-screwout` marker is written into every scanned
directory; a second run with markers present exits immediately.
"""
import os
import shutil
import struct
import subprocess
import sys
import tempfile

AR_MAGIC = b'!<arch>\n'
FAT_MAGICS = (0xCAFEBABE, 0xBEBAFECA)
MH_MAGIC_64 = 0xFEEDFACF  # little-endian magic of 64-bit mach-o
MARKER = '.repacked-screwout'


def fat_slices(data: bytes):
    """[(offset, size)] of thin archive slices inside a (fat) file."""
    if struct.unpack('>I', data[:4])[0] not in FAT_MAGICS:
        return [(0, len(data))]
    count = struct.unpack('>I', data[4:8])[0]
    slices = []
    off = 8
    for _ in range(count):
        _, _, aoff, asize, _ = struct.unpack('>iiIII', data[off:off + 20])
        slices.append((aoff, asize))
        off += 20
    return slices


def slice_has_misaligned_macho64(data: bytes, offset: int, size: int) -> bool:
    pos = offset + 8  # skip "!<arch>\n"
    end = offset + size
    while pos + 60 <= end:
        header = data[pos:pos + 60]
        if header[58:60] != b'`\n':
            return False  # ran past the member table
        raw_name = header[:16].split()[0]
        member_size = int(header[48:58].split()[0])
        data_start = pos + 60
        if raw_name.startswith(b'#1/'):  # darwin embedded long name
            name_len = int(raw_name[3:])
            data_start += name_len
            member_size -= name_len
        if member_size >= 4 and data[data_start:data_start + 4] == struct.pack('<I', MH_MAGIC_64):
            if data_start % 8 != 0:
                return True
        pos = data_start + member_size
        if pos % 2:
            pos += 1
        if member_size <= 0:
            break
    return False


def archive_needs_repack(path: str) -> bool:
    with open(path, 'rb') as f:
        data = f.read()
    if data[:8] != AR_MAGIC and struct.unpack('>I', data[:4])[0] not in FAT_MAGICS:
        return False  # not an archive at all; leave it alone
    return any(slice_has_misaligned_macho64(data, off, size)
               for off, size in fat_slices(data))


def repack_archive(path: str, workdir: str) -> None:
    info = subprocess.run(['lipo', '-info', path],
                          capture_output=True, text=True).stdout
    if 'is architecture:' in info:
        archs = [info.strip().rsplit(': ', 1)[-1]]
    elif 'are:' in info:
        archs = info.split('are:')[-1].split()
    else:
        raise SystemExit(f'cannot parse lipo info for {path}: {info}')

    fixed = []
    for arch in archs:
        thin = os.path.join(workdir, f'{arch}.a')
        if len(archs) > 1:
            subprocess.run(['lipo', '-thin', arch, path, '-o', thin], check=True)
        else:
            shutil.copy(path, thin)
        members_dir = os.path.join(workdir, arch)
        os.makedirs(members_dir, exist_ok=True)
        subprocess.run(['ar', 'x', os.path.abspath(thin)], cwd=members_dir, check=True)
        objs = sorted(f for f in os.listdir(members_dir)
                      if f.endswith('.o') and not f.startswith(('._', '.', '__.')))
        if not objs:
            raise SystemExit(f'{path} [{arch}]: extracted no object members')
        out = os.path.join(workdir, f'{arch}-fixed.a')
        subprocess.run(['libtool', '-static', '-o', out] + objs,
                       cwd=members_dir, check=True)
        fixed.append(out)

    if len(fixed) == 1:
        shutil.copy(fixed[0], path)
    else:
        subprocess.run(['lipo', '-create'] + fixed + ['-output', path], check=True)


def main() -> int:
    roots = sys.argv[1:]
    if not roots:
        print('usage: repack_libs.py <dir> [<dir> ...]')
        return 2
    for root in roots:
        if not os.path.isdir(root):
            print(f'not a directory: {root}')
            return 2
        if os.path.exists(os.path.join(root, MARKER)):
            print(f'{root}: already repacked, skipping')
            continue
        archives = []
        for dirpath, _, files in os.walk(root):
            archives += [os.path.join(dirpath, f) for f in files if f.endswith('.a')]
        for path in archives:
            if not archive_needs_repack(path):
                print(f'ok  {os.path.relpath(path, root)}')
                continue
            with tempfile.TemporaryDirectory(prefix='repack-') as workdir:
                repack_archive(path, workdir)
            if archive_needs_repack(path):
                print(f'{path}: still misaligned after repack')
                return 1
            print(f'FIXED  {os.path.relpath(path, root)}')
        open(os.path.join(root, MARKER), 'w').close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
