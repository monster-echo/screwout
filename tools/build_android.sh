#!/usr/bin/env bash
# Build the signed AAB for Google Play (Screw Out: Sweet Jam).
#
#   STAGE=release ./tools/build_android.sh   # signed bundleRelease AAB
#   STAGE=debug   ./tools/build_android.sh   # CI dry run: assembleDebug
#
# Flow (proven Arrow Clear pipeline): Cocos Creator CLI generates the Gradle
# project from tools/build-config-android.json, gradle.properties gets target
# SDK / ABI / release signing keys, the manifest gets portrait locked, and
# versions are injected through AGP's android.injected.* properties. On top
# of that the AdMob Java bridge (com/screwout/ads/AdMobBridge) is copied into
# the generated app module, hooked into AppActivity.onCreate, given the
# APPLICATION_ID meta-data and the play-services-ads dependency (all
# idempotent — Cocos regenerates the project on every build).
#
# Signing values come from release.env (git-ignored) locally or from secrets
# on CI: KEYSTORE, KEYSTORE_PASS, KEYSTORE_USER (alias), KEY_PASS.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT/release.env" ]]; then
	# shellcheck disable=SC1091
	source "$ROOT/release.env"
fi
STAGE="${STAGE:-release}"
TARGET_SDK="${TARGET_SDK:-36}"
MIN_SDK="${MIN_SDK:-24}"
APP_ABI="${APP_ABI:-arm64-v8a}"
APP_NAME="${APP_NAME:-screwout}"
KEY_PASS="${KEY_PASS:-${KEYSTORE_PASS:-}}"
# Official Google test App ID; paste the production one before going live.
ADMOB_APP_ID="${ADMOB_APP_ID:-ca-app-pub-2271052258925299~9087225241}"

eval "$(python3 "$ROOT/tools/set_versions.py" get)"
VERSION="${VERSION:-$version}"
BUILD="${BUILD:-$build}"
BUILD_DIR="$ROOT/build/android"
PROJ_DIR="$BUILD_DIR/proj"
OUT_DIR="$ROOT/export/android"

find_cocos() {
	for candidate in \
		"${COCOS:-}" \
		"/Applications/Cocos/Creator/3.8.6/CocosCreator.app/Contents/MacOS/CocosCreator" \
		"$HOME/cocos-creator/CocosCreator.app/Contents/MacOS/CocosCreator"; do
		[[ -n "$candidate" && -x "$candidate" ]] && { echo "$candidate"; return; }
	done
}

CC_BIN="$(find_cocos || true)"
if [[ -z "$CC_BIN" ]]; then
	echo "Cocos Creator 3.8.6 not found. Set COCOS=/path/to/CocosCreator binary." >&2
	exit 1
fi

# Cocos 3.8.6 engine headers predate clang 17+ (Android NDK r28 clang); patch
# the installed editor's copy in place. Idempotent.
patch_engine_headers() {
	local header
	header="$(dirname "$(dirname "$CC_BIN")")/Resources/resources/3d/engine/native/cocos/core/event/EventTarget.h"
	if [[ -f "$header" ]] && grep -q -- '->template addEventListener(' "$header"; then
		sed -i.bak 's/->template addEventListener(/->addEventListener(/g' "$header" \
			&& rm -f "$header.bak"
		echo "patched engine header for new clang: $header"
	fi
}
patch_engine_headers

echo "== resolve Android SDK/NDK for Cocos"
ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
# Cocos 3.8.x supports NDK up to r27 (r28's libc++ dropped symbols the engine
# bindings still use); prefer the newest supported NDK.
ANDROID_NDK="${ANDROID_NDK:-$(find "$ANDROID_SDK/ndk" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -V | awk -F/ '$NF + 0 <= 27.99' | tail -1 || true)}"
if [[ -z "$ANDROID_NDK" ]]; then
	ANDROID_NDK="$(find "$ANDROID_SDK/ndk" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -V | tail -1 || true)"
	[[ -n "$ANDROID_NDK" ]] && echo "::warning::only NDK r28+ found; Cocos 3.8.x supports up to r27 — build may fail"
fi
if [[ ! -d "$ANDROID_SDK" ]]; then
	echo "Android SDK not found at $ANDROID_SDK (set ANDROID_HOME)" >&2
	exit 1
fi
if [[ -z "$ANDROID_NDK" ]]; then
	echo "No Android NDK under $ANDROID_SDK/ndk" >&2
	exit 1
fi
echo "sdk: $ANDROID_SDK"
echo "ndk: $ANDROID_NDK"
RESOLVED="$ROOT/.tmp/build-config-android.json"
mkdir -p "$ROOT/.tmp"
python3 - "$ROOT/tools/build-config-android.json" "$RESOLVED" \
	"$ANDROID_SDK" "$ANDROID_NDK" "$ROOT" <<'PY'
import json, os, sys
src, dst, sdk, ndk, root = sys.argv[1:]
with open(src) as f:
    cfg = json.load(f)
splash = cfg.get('splashScreen', {}).get('logo', {})
if splash.get('image') and not os.path.isabs(splash['image']):
    splash['image'] = os.path.join(root, splash['image'])
android = cfg.setdefault('packages', {}).setdefault('android', {})
android['sdkPath'] = sdk
android['ndkPath'] = ndk
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
PY

echo "== Cocos CLI build -> Gradle project"
# Exit code 36 is Cocos' documented CLI-build success.
set +e
"$CC_BIN" --project "$ROOT" --build "configPath=$RESOLVED"
rc=$?
set -e
if [[ $rc != 36 && $rc != 0 ]]; then
	echo "Cocos CLI build failed with exit code $rc (36=ok, 32=bad params, 34=build error)" >&2
	exit 1
fi
python3 "$ROOT/tools/apply_custom_splash.py"
if [[ ! -d "$PROJ_DIR" ]]; then
	echo "No Gradle project at $PROJ_DIR" >&2
	exit 1
fi
echo "project: $PROJ_DIR"

GRADLE_PROPS="$PROJ_DIR/gradle.properties"
touch "$GRADLE_PROPS"
set_prop() {
	# | delimiter: keystore paths contain / and would break s///
	if grep -q "^$1=" "$GRADLE_PROPS"; then
		sed -i.bak "s|^$1=.*|$1=$2|" "$GRADLE_PROPS" && rm -f "$GRADLE_PROPS.bak"
	else
		printf '%s=%s\n' "$1" "$2" >> "$GRADLE_PROPS"
	fi
}

echo "== patch gradle.properties / manifest"
set_prop PROP_TARGET_SDK_VERSION "$TARGET_SDK"
set_prop PROP_MIN_SDK_VERSION "$MIN_SDK"
set_prop PROP_APP_ABI "$APP_ABI"
# The engine template pins AGP 8.0.2, whose bundled aapt2 cannot parse the
# resource tables of android.jar from SDK 35+ ("RES_TABLE_TYPE_TYPE entry
# offsets overlap"); AGP 8.13.0 also supports compileSdk 36, which Play
# requires of new apps since 2026-08.
sed -i.bak "s/classpath 'com.android.tools.build:gradle:8.0.2'/classpath 'com.android.tools.build:gradle:8.13.0'/" \
	"$PROJ_DIR/build.gradle" && rm -f "$PROJ_DIR/build.gradle.bak"
echo "AGP: 8.13.0"

# Cocos template pins Gradle 8.0.2; AGP 8.13 needs Gradle 8.13.
if [[ -f "$PROJ_DIR/gradle/wrapper/gradle-wrapper.properties" ]]; then
	sed -i.bak 's|gradle-8\.0\.2-bin.zip|gradle-8.13-bin.zip|' \
		"$PROJ_DIR/gradle/wrapper/gradle-wrapper.properties" \
		&& rm -f "$PROJ_DIR/gradle/wrapper/gradle-wrapper.properties.bak"
	echo "Gradle wrapper: 8.13"
fi

if [[ "$STAGE" == "release" ]]; then
	if [[ -z "${KEYSTORE:-}" || -z "${KEYSTORE_PASS:-}" || -z "${KEYSTORE_USER:-}" ]]; then
		echo "Signing not configured: set KEYSTORE / KEYSTORE_PASS / KEYSTORE_USER" >&2
		exit 1
	fi
	set_prop RELEASE_STORE_FILE "$KEYSTORE"
	set_prop RELEASE_STORE_PASSWORD "$KEYSTORE_PASS"
	set_prop RELEASE_KEY_ALIAS "$KEYSTORE_USER"
	set_prop RELEASE_KEY_PASSWORD "$KEY_PASS"
fi

# The :app module lives under NATIVE_DIR (native/engine/android).
NATIVE_DIR="$(sed -n 's/^NATIVE_DIR=//p' "$GRADLE_PROPS" | head -1)"
MAIN_MANIFEST=""
for candidate in "$NATIVE_DIR/app/AndroidManifest.xml" "$PROJ_DIR/app/AndroidManifest.xml"; do
	[[ -n "$candidate" && -f "$candidate" ]] && { MAIN_MANIFEST="$candidate"; break; }
done
if [[ -z "$MAIN_MANIFEST" ]]; then
	echo "app AndroidManifest.xml not found (NATIVE_DIR=$NATIVE_DIR)" >&2
	exit 1
fi

echo "== AdMob + bridge integration"
# 1. Copy the bridge (package com.screwout.ads) into the generated app module.
#    Any stale copy elsewhere under app/src (e.g. src/com/screwout/ads) would
#    compile twice as the same class — purge it first.
find "$NATIVE_DIR/app/src" -path '*com/screwout/ads*' -type d \
    ! -path '*/src/main/java/com/screwout/ads*' -exec rm -rf {} + 2>/dev/null || true
JAVA_DIR="$NATIVE_DIR/app/src/main/java/com/screwout/ads"
mkdir -p "$JAVA_DIR"
cp "$ROOT/native/android/admob/AdMobBridge.java" "$JAVA_DIR/"

# 2. AdMob APPLICATION_ID meta-data inside <application>.
if ! grep -q "com.google.android.gms.ads.APPLICATION_ID" "$MAIN_MANIFEST"; then
	META_LINE="        <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$ADMOB_APP_ID\" />"
	awk -v line="$META_LINE" 'BEGIN{done=0} /<application/{print; if(!done){print line; done=1; next} next} {print}' \
		"$MAIN_MANIFEST" > "$MAIN_MANIFEST.tmp" && mv "$MAIN_MANIFEST.tmp" "$MAIN_MANIFEST"
	echo "manifest: AdMob APPLICATION_ID injected"
fi

# 3. play-services-ads dependency in app/build.gradle.
APP_GRADLE="$NATIVE_DIR/app/build.gradle"
if [[ ! -f "$APP_GRADLE" ]]; then
	echo "app/build.gradle not found at $APP_GRADLE" >&2
	exit 1
fi
if ! grep -q "play-services-ads" "$APP_GRADLE"; then
	sed -i.bak "s|^dependencies {|dependencies {\n    implementation 'com.google.android.gms:play-services-ads:24.4.0'|" \
		"$APP_GRADLE" && rm -f "$APP_GRADLE.bak"
	echo "app/build.gradle: play-services-ads added"
else
	sed -i.bak "s|com.google.android.gms:play-services-ads:[0-9.]*|com.google.android.gms:play-services-ads:24.4.0|" \
		"$APP_GRADLE" && rm -f "$APP_GRADLE.bak"
	echo "app/build.gradle: play-services-ads pinned to 24.4.0"
fi

# AGP 8.7 cross-checks android.ndkVersion against android.ndkPath; declare both.
NDK_VERSION="$(basename "$ANDROID_NDK")"
set_prop PROP_NDK_VERSION "$NDK_VERSION"
sed -i.bak "s|ndkPath PROP_NDK_PATH|ndkPath PROP_NDK_PATH\n    ndkVersion PROP_NDK_VERSION|" "$APP_GRADLE" \
	&& rm -f "$APP_GRADLE.bak" || true
echo "app/build.gradle: ndkVersion $NDK_VERSION"

# 4. Hook attachActivity into AppActivity.onCreate.
APP_ACTIVITY="$(find "$NATIVE_DIR/app/src" -name "AppActivity.java" -print -quit)"
if [[ -z "$APP_ACTIVITY" ]]; then
	echo "AppActivity.java not found under $NATIVE_DIR/app/src" >&2
	exit 1
fi
if ! grep -q "AdMobBridge.attachActivity" "$APP_ACTIVITY"; then
	python3 - "$APP_ACTIVITY" <<'PY'
import sys
p = sys.argv[1]
src = open(p).read()
hook = "        com.screwout.ads.AdMobBridge.attachActivity(this);\n"
lines = src.splitlines(keepends=True)
out = []
for line in lines:
    out.append(line)
    if "super.onCreate(" in line:
        out.append(hook)
open(p, "w").write("".join(out))
PY
	echo "AppActivity: AdMobBridge.attachActivity hooked"
fi

# 5. Version code/name in the generated defaultConfig. BSD sed has no \+.
sed -i.bak "s/versionCode [0-9][0-9]*/versionCode $BUILD/" "$APP_GRADLE"
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$APP_GRADLE"
rm -f "$APP_GRADLE.bak"
echo "app/build.gradle: version $VERSION ($BUILD)"

# 6. Portrait lock.
if grep -q 'android:screenOrientation=' "$MAIN_MANIFEST"; then
	sed -i.bak 's/android:screenOrientation="[^"]*"/android:screenOrientation="portrait"/' \
		"$MAIN_MANIFEST" && rm -f "$MAIN_MANIFEST.bak"
	echo "manifest: portrait locked"
else
	sed -i.bak "s|android:label=\"[^\"]*\"|&\n            android:screenOrientation=\"portrait\"|" "$MAIN_MANIFEST" \
		&& rm -f "$MAIN_MANIFEST.bak" && echo "manifest: portrait attribute added"
fi

# 7. The engine's :libcocos2dx manifest injects com.android.vending.BILLING on
#    every build; this app has no in-app products, so force-remove the
#    permission with tools:node="remove" (merged last, wins over the engine).
if ! grep -q 'xmlns:tools=' "$MAIN_MANIFEST"; then
	sed -i.bak 's|<manifest |<manifest xmlns:tools="http://schemas.android.com/tools" |' \
		"$MAIN_MANIFEST" && rm -f "$MAIN_MANIFEST.bak"
fi
if ! grep -q 'com.android.vending.BILLING" tools:node="remove"' "$MAIN_MANIFEST"; then
	sed -i.bak '/com.android.vending.BILLING/d' "$MAIN_MANIFEST" && rm -f "$MAIN_MANIFEST.bak"
	sed -i.bak 's|<application|    <uses-permission android:name="com.android.vending.BILLING" tools:node="remove" />\n    <application|' \
		"$MAIN_MANIFEST" && rm -f "$MAIN_MANIFEST.bak"
	echo "manifest: BILLING force-removed (tools:node=remove)"
fi

GRADLE="$PROJ_DIR/gradlew"
if [[ ! -x "$GRADLE" ]]; then
	GRADLE="gradle"
	echo "no gradlew wrapper in $PROJ_DIR, using system gradle"
fi

# Gradle 8.x cannot run on very new JDKs; prefer a 17/21 toolchain.
for candidate in \
	/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
	/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; do
	if [[ -x "$candidate/bin/java" ]]; then
		export JAVA_HOME="$candidate"
		break
	fi
done
echo "JAVA_HOME: ${JAVA_HOME:-<ambient>}"

echo "== gradle $STAGE build"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
if [[ "$STAGE" == "debug" ]]; then
	(cd "$PROJ_DIR" && "$GRADLE" assembleDebug --no-daemon)
	APK="$(find "$PROJ_DIR" -path '*/outputs/apk/debug/*.apk' -print -quit)"
	if [[ -z "$APK" ]]; then
		echo "assembleDebug produced no APK" >&2
		exit 1
	fi
	cp "$APK" "$OUT_DIR/$APP_NAME-debug.apk"
	echo
	echo "Debug APK: $OUT_DIR/$APP_NAME-debug.apk (dry run OK, no signing attempted)"
	exit 0
fi

# AGP injected properties: versions and signing without editing generated files.
(cd "$PROJ_DIR" && "$GRADLE" bundleRelease --no-daemon \
	-Pandroid.injected.version.code="$BUILD" \
	-Pandroid.injected.version.name="$VERSION" \
	-Pandroid.injected.signing.store.file="$KEYSTORE" \
	-Pandroid.injected.signing.store.password="$KEYSTORE_PASS" \
	-Pandroid.injected.signing.key.alias="$KEYSTORE_USER" \
	-Pandroid.injected.signing.key.password="$KEY_PASS")

AAB="$(find "$PROJ_DIR" -path '*/outputs/bundle/release/*.aab' -print -quit)"
if [[ -z "$AAB" ]]; then
	echo "bundleRelease produced no AAB" >&2
	exit 1
fi
cp "$AAB" "$OUT_DIR/$APP_NAME-release.aab"

echo "== verify versionCode"
AAPT2="$(find "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}" \
	-build-tools -name aapt2 -type f -print 2>/dev/null | sort -V | tail -1 || true)"
if [[ -n "$AAPT2" ]]; then
	CODE="$("$AAPT2" dump badging "$OUT_DIR/$APP_NAME-release.aab" 2>/dev/null \
		| head -1 | sed -n 's/.*versionCode=.\([0-9]*\).*/\1/p')"
	if [[ "$CODE" == "$BUILD" ]]; then
		echo "versionCode $CODE matches build $BUILD"
	else
		echo "versionCode mismatch: AAB says '$CODE', expected '$BUILD'" >&2
		exit 1
	fi
else
	echo "::warning::aapt2 not found; skipped the versionCode check"
fi

echo
echo "Signed AAB: $OUT_DIR/$APP_NAME-release.aab (version $VERSION build $BUILD)"
