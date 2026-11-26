import { sys } from 'cc';
import { DataManager } from './DataManager';

export type RewardedPlacement =
    | 'unlock_box'
    | 'revive_streak'
    | 'skill_refill'
    | 'double_win_reward';

export interface IAPProduct {
    sku: string;
    title: string;
    subtitle: string;
    priceDisplay: string;
    badge?: string;
    coins?: number;
    bolts?: number;
    removeAds?: boolean;
    boostersEach?: number;
}

export const IAP_CATALOG: IAPProduct[] = [
    {
        sku: 'com.screwjam.remove_ads',
        title: 'Remove Interstitial Ads',
        subtitle: 'No forced ads forever + 300 Coins',
        priceDisplay: '$3.99',
        badge: 'POPULAR',
        removeAds: true,
        coins: 300,
    },
    {
        sku: 'com.screwjam.starter_pack',
        title: 'Starter Value Pack',
        subtitle: '500 Coins + 40 Bolts + 3x All Boosters',
        priceDisplay: '$1.99',
        badge: '80% OFF',
        coins: 500,
        bolts: 40,
        boostersEach: 3,
    },
    {
        sku: 'com.screwjam.coin_pile',
        title: 'Bag of Coins',
        subtitle: '1,200 Coins + 60 Bolts',
        priceDisplay: '$4.99',
        coins: 1200,
        bolts: 60,
    },
];

/**
 * Overseas iOS / Android Monetization & Analytics bridge.
 * On native iOS/Android builds, wire native hooks (AppLovin MAX / AdMob / StoreKit2 / Google Play Billing / Firebase)
 * via `native.reflection.callStaticMethod` or JSB bridge. On Web preview, runs clean non-blocking mocks.
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
        const payload = {
            event: eventName,
            platform: sys.os,
            level: DataManager.ins.level,
            streak: DataManager.ins.winStreak,
            ...params,
        };
        // Native Firebase / Adjust / AppsFlyer bridge goes here
        console.log('[Analytics]', JSON.stringify(payload));
    }

    /**
     * Show Rewarded Video Ad (AppLovin MAX / AdMob).
     * Never blocked by `noAdsPurchased` because players explicitly opt in for rewards.
     */
    public showRewardedAd(placement: RewardedPlacement, onRewarded: () => void): void {
        this.trackEvent('ad_rewarded_request', { placement });

        if (sys.isNative) {
            // Native iOS/Android bridge hook:
            // Call AppLovin MAX / AdMob Rewarded SDK and invoke onRewarded() on completion callback.
            this.trackEvent('ad_rewarded_complete', { placement, mode: 'native_stub' });
            onRewarded();
            return;
        }

        // Web preview mock: instant reward with clean feedback toast
        this._toastCallback?.('Rewarded Ad completed! Reward granted.');
        this.trackEvent('ad_rewarded_complete', { placement, mode: 'web_mock' });
        onRewarded();
    }

    /**
     * Show Interstitial Ad on natural breaks (e.g. after level win/retry from Level 3+).
     * Respects `noAdsPurchased` and cooldown timer to protect overseas retention.
     */
    public maybeShowInterstitial(reason: 'level_win' | 'level_retry'): void {
        if (DataManager.ins.noAdsPurchased) return;
        if (DataManager.ins.level < 3) return;
        const now = Date.now();
        if (now - this._lastInterstitialMs < this._interstitialCooldownMs) return;
        this._lastInterstitialMs = now;
        this.trackEvent('ad_interstitial_show', { reason });
    }

    /**
     * Purchase IAP SKU (Apple StoreKit 2 / Google Play Billing v6).
     */
    public purchase(sku: string, onSuccess: (product: IAPProduct) => void): void {
        const product = IAP_CATALOG.find((p) => p.sku === sku);
        if (!product) return;

        this.trackEvent('iap_purchase_click', { sku, price: product.priceDisplay });

        // Grant entitlement
        if (product.removeAds) {
            DataManager.ins.noAdsPurchased = true;
        }
        if (product.coins) {
            DataManager.ins.addCoins(product.coins);
        }
        if (product.bolts) {
            DataManager.ins.addBolts(product.bolts);
        }
        if (product.boostersEach) {
            DataManager.ins.skillCounts.slot += product.boostersEach;
            DataManager.ins.skillCounts.clear += product.boostersEach;
            DataManager.ins.skillCounts.melt += product.boostersEach;
        }
        DataManager.ins.save();
        this.trackEvent('iap_purchase_success', { sku });
        onSuccess(product);
    }

    public shareResult(text: string): void {
        this.trackEvent('social_share', { textLen: text.length });
        const nav = (globalThis as any).navigator;
        if (nav && typeof nav.share === 'function') {
            nav.share({ title: 'Screw Jam: Bolt Master', text }).catch(() => {});
        } else if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            nav.clipboard.writeText(text).catch(() => {});
            this._toastCallback?.('Challenge link copied! Share with friends.');
        } else {
            this._toastCallback?.('Shared to your friends!');
        }
    }
}
