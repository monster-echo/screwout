import { native, sys } from 'cc';
import { DataManager } from './DataManager';
import { getActiveAdMobUnits, isAdMobTestMode } from './AdMobConfig';

export type RewardedPlacement =
    | 'unlock_box'
    | 'revive'
    | 'skill_refill'
    | 'unlock_theme';

export type AdMobCallbackEvent =
    | 'sdk_ready'
    | 'rewarded_loaded'
    | 'rewarded_complete'
    | 'rewarded_dismissed'
    | 'rewarded_failed'
    | 'interstitial_shown'
    | 'interstitial_dismissed'
    | 'interstitial_failed';

/**
 * Google AdMob (GMA SDK + UMP Consent + iOS ATT) Monetization Manager
 * for Apple App Store (iOS) and Google Play (Android).
 *
 * Native bridges:
 * - Android: native/android/admob/AdMobBridge.java  (com/screwout/ads/AdMobBridge)
 * - iOS:     native/ios/admob/AdMobBridge.mm        (AdMobBridge)
 */
export class MonetizationManager {
    private static _ins: MonetizationManager | null = null;
    public static get ins(): MonetizationManager {
        if (!this._ins) {
            this._ins = new MonetizationManager();
        }
        return this._ins;
    }

    public static readonly PRIVACY_POLICY_URL = 'https://screw-out-sweet-jam.rwecho.workers.dev/privacy';
    public static readonly APP_VERSION = '1.0.0';

    private static readonly ANDROID_BRIDGE = 'com/screwout/ads/AdMobBridge';
    private static readonly IOS_BRIDGE = 'AdMobBridge';

    private _initialized = false;
    private _lastInterstitialMs = 0;
    private readonly _interstitialCooldownMs = 60_000;
    private _toastCallback: ((msg: string) => void) | null = null;
    private _pendingRewardCb: (() => void) | null = null;
    private _pendingPlacement: RewardedPlacement | null = null;

    constructor() {
        // Unified native -> JS callback invoked by Android AdMobBridge.java & iOS AdMobBridge.mm
        (globalThis as any).__SCREW_OUT_ADMOB_CB__ = (event: AdMobCallbackEvent, detail = '') => {
            this.handleNativeAdEvent(event, detail);
        };
    }

    public setToastCallback(cb: (msg: string) => void): void {
        this._toastCallback = cb;
    }

    /**
     * Initialize Google AdMob SDK + UMP GDPR/CCPA Consent + iOS ATT.
     * Preloads Rewarded & Interstitial ads automatically on native platforms.
     */
    public initAdMob(): void {
        if (this._initialized) return;
        this._initialized = true;

        const units = getActiveAdMobUnits();
        this.trackEvent('admob_init', { testMode: isAdMobTestMode() });

        if (!sys.isNative) return;
        try {
            if (sys.os === sys.OS.ANDROID) {
                native.reflection.callStaticMethod(
                    MonetizationManager.ANDROID_BRIDGE,
                    'init',
                    '(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V',
                    units.rewarded,
                    units.interstitial,
                    units.banner,
                );
            } else if (sys.os === sys.OS.IOS) {
                native.reflection.callStaticMethod(
                    MonetizationManager.IOS_BRIDGE,
                    'initWithRewarded:interstitial:banner:',
                    units.rewarded,
                    units.interstitial,
                    units.banner,
                );
            }
        } catch (err) {
            console.warn('[AdMob] Native bridge not linked yet:', err);
        }
    }

    /** Backwards-compatible alias called by GameApp on startup. */
    public requestPrivacyConsent(): void {
        this.initAdMob();
    }

    /** Open Google UMP Privacy Options form (required for EEA/UK users in Settings). */
    public showPrivacyOptions(): void {
        this.trackEvent('admob_privacy_options');
        if (sys.isNative) {
            try {
                if (sys.os === sys.OS.ANDROID) {
                    native.reflection.callStaticMethod(MonetizationManager.ANDROID_BRIDGE, 'showPrivacyOptions', '()V');
                    return;
                } else if (sys.os === sys.OS.IOS) {
                    native.reflection.callStaticMethod(MonetizationManager.IOS_BRIDGE, 'showPrivacyOptions');
                    return;
                }
            } catch {
                // Fall through to privacy URL
            }
        }
        this.openPrivacyPolicy();
    }

    public openPrivacyPolicy(): void {
        this.trackEvent('open_privacy_policy');
        sys.openURL(MonetizationManager.PRIVACY_POLICY_URL);
        if (!sys.isNative) {
            this._toastCallback?.('Opened Privacy Policy');
        }
    }

    public triggerHaptic(style: 'light' | 'medium' = 'light'): void {
        if (!DataManager.ins.vibrateEnabled) return;
        if (sys.isNative) {
            try {
                if (sys.os === sys.OS.ANDROID) {
                    native.reflection.callStaticMethod(MonetizationManager.ANDROID_BRIDGE, 'vibrate', '(Ljava/lang/String;)V', style);
                } else if (sys.os === sys.OS.IOS) {
                    native.reflection.callStaticMethod(MonetizationManager.IOS_BRIDGE, 'vibrate:', style);
                }
            } catch {
                // Ignore if native bridge not linked
            }
        } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(style === 'medium' ? 18 : 10);
        }
    }

    public trackEvent(eventName: string, params: Record<string, string | number | boolean> = {}): void {
        console.log('[Analytics]', JSON.stringify({
            event: eventName,
            platform: sys.os,
            level: DataManager.ins.level,
            theme: DataManager.ins.activeTheme,
            ...params,
        }));
    }

    /** Show Google AdMob Rewarded Video Ad. Grants reward ONLY upon completion. */
    public showRewardedAd(placement: RewardedPlacement, onRewarded: () => void): void {
        this.trackEvent('ad_rewarded_request', { placement });
        if (sys.isNative) {
            try {
                this._pendingRewardCb = onRewarded;
                this._pendingPlacement = placement;
                if (sys.os === sys.OS.ANDROID) {
                    native.reflection.callStaticMethod(
                        MonetizationManager.ANDROID_BRIDGE,
                        'showRewarded',
                        '(Ljava/lang/String;)V',
                        placement,
                    );
                    return;
                } else if (sys.os === sys.OS.IOS) {
                    native.reflection.callStaticMethod(
                        MonetizationManager.IOS_BRIDGE,
                        'showRewarded:',
                        placement,
                    );
                    return;
                }
            } catch {
                this._pendingRewardCb = null;
                this._pendingPlacement = null;
            }
            // Fallback when running native debug build without AdMobBridge linked
            this.trackEvent('ad_rewarded_complete', { placement, mode: 'native_stub' });
            onRewarded();
            return;
        }
        // Web preview mock: immediate reward with clean toast
        this._toastCallback?.('Ad completed! Reward granted.');
        this.trackEvent('ad_rewarded_complete', { placement, mode: 'web_mock' });
        onRewarded();
    }

    /** Show Google AdMob Interstitial Ad on natural breaks from Level 3+ with 60s cooldown. */
    public maybeShowInterstitial(reason: 'level_win' | 'level_retry'): void {
        if (DataManager.ins.level < 3) return;
        const now = Date.now();
        if (now - this._lastInterstitialMs < this._interstitialCooldownMs) return;
        this._lastInterstitialMs = now;
        this.trackEvent('ad_interstitial_request', { reason });
        if (sys.isNative) {
            try {
                if (sys.os === sys.OS.ANDROID) {
                    native.reflection.callStaticMethod(
                        MonetizationManager.ANDROID_BRIDGE,
                        'showInterstitial',
                        '(Ljava/lang/String;)V',
                        reason,
                    );
                } else if (sys.os === sys.OS.IOS) {
                    native.reflection.callStaticMethod(
                        MonetizationManager.IOS_BRIDGE,
                        'showInterstitial:',
                        reason,
                    );
                }
            } catch {
                // Ignore if native bridge not linked
            }
        }
    }

    /** Optional Anchored Adaptive Banner controls (bottom of screen). */
    public showBanner(): void {
        if (!sys.isNative) return;
        try {
            if (sys.os === sys.OS.ANDROID) {
                native.reflection.callStaticMethod(MonetizationManager.ANDROID_BRIDGE, 'showBanner', '()V');
            } else if (sys.os === sys.OS.IOS) {
                native.reflection.callStaticMethod(MonetizationManager.IOS_BRIDGE, 'showBanner');
            }
        } catch {
            // Ignore if native bridge not linked
        }
    }

    public hideBanner(): void {
        if (!sys.isNative) return;
        try {
            if (sys.os === sys.OS.ANDROID) {
                native.reflection.callStaticMethod(MonetizationManager.ANDROID_BRIDGE, 'hideBanner', '()V');
            } else if (sys.os === sys.OS.IOS) {
                native.reflection.callStaticMethod(MonetizationManager.IOS_BRIDGE, 'hideBanner');
            }
        } catch {
            // Ignore if native bridge not linked
        }
    }

    private handleNativeAdEvent(event: AdMobCallbackEvent, detail: string): void {
        this.trackEvent(`admob_${event}`, { detail });
        if (event === 'rewarded_complete') {
            const cb = this._pendingRewardCb;
            const placement = this._pendingPlacement || detail;
            this._pendingRewardCb = null;
            this._pendingPlacement = null;
            this.trackEvent('ad_rewarded_complete', { placement, mode: 'admob_native' });
            if (cb) cb();
        } else if (event === 'rewarded_dismissed') {
            if (this._pendingRewardCb) {
                this._pendingRewardCb = null;
                this._pendingPlacement = null;
                this._toastCallback?.('Watch the full ad to claim your reward.');
            }
        } else if (event === 'rewarded_failed') {
            this._pendingRewardCb = null;
            this._pendingPlacement = null;
            this._toastCallback?.('Ad is loading, please try again shortly.');
        }
    }
}
