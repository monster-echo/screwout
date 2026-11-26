import { sys } from 'cc';
import { DataManager } from './DataManager';

export type RewardedPlacement =
    | 'unlock_box'
    | 'revive'
    | 'skill_refill';

/**
 * Pure IAA (Rewarded Video + Interstitial) Monetization Bridge for Overseas iOS / Android.
 * Wire native AppLovin MAX / Google AdMob callbacks in the `sys.isNative` branches.
 */
export class MonetizationManager {
    private static _ins: MonetizationManager | null = null;
    public static get ins(): MonetizationManager {
        if (!this._ins) {
            this._ins = new MonetizationManager();
        }
        return this._ins;
    }

    private _lastInterstitialMs = 0;
    private readonly _interstitialCooldownMs = 60_000;
    private _toastCallback: ((msg: string) => void) | null = null;

    public setToastCallback(cb: (msg: string) => void): void {
        this._toastCallback = cb;
    }

    public trackEvent(eventName: string, params: Record<string, string | number | boolean> = {}): void {
        console.log('[Analytics]', JSON.stringify({
            event: eventName,
            platform: sys.os,
            level: DataManager.ins.level,
            ...params,
        }));
    }

    /** Show Rewarded Video Ad (AppLovin MAX / AdMob). */
    public showRewardedAd(placement: RewardedPlacement, onRewarded: () => void): void {
        this.trackEvent('ad_rewarded_request', { placement });
        if (sys.isNative) {
            // Native iOS/Android AppLovin MAX / AdMob Rewarded Ad bridge hook
            this.trackEvent('ad_rewarded_complete', { placement, mode: 'native_stub' });
            onRewarded();
            return;
        }
        // Web preview mock: immediate reward with clean toast
        this._toastCallback?.('Ad completed! Reward granted.');
        this.trackEvent('ad_rewarded_complete', { placement, mode: 'web_mock' });
        onRewarded();
    }

    /** Show Interstitial Ad on natural breaks from Level 3+ with 60s cooldown. */
    public maybeShowInterstitial(reason: 'level_win' | 'level_retry'): void {
        if (DataManager.ins.level < 3) return;
        const now = Date.now();
        if (now - this._lastInterstitialMs < this._interstitialCooldownMs) return;
        this._lastInterstitialMs = now;
        this.trackEvent('ad_interstitial_show', { reason });
    }
}
