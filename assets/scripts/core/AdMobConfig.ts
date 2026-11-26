import { sys } from 'cc';

export interface PlatformAdUnits {
    appId: string;
    rewarded: string;
    interstitial: string;
    banner: string;
}

/**
 * Google AdMob Configuration for Screw Out: Sweet Jam (Android & iOS).
 *
 * - Android is wired with Production AdMob IDs (`USE_TEST_ADS_ANDROID = false`).
 * - iOS stays on official Google Test IDs (`USE_TEST_ADS_IOS = true`) until
 *   iOS production AdMob App ID & Ad Unit IDs are provided.
 */
export const ADMOB_CONFIG = {
    USE_TEST_ADS_ANDROID: false,
    USE_TEST_ADS_IOS: false,

    // Official Google AdMob Test IDs (safe for dev & QA devices)
    TEST_ANDROID: {
        appId: 'ca-app-pub-3940256099942544~3347511713',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        banner: 'ca-app-pub-3940256099942544/9214589741',
    } as PlatformAdUnits,

    TEST_IOS: {
        appId: 'ca-app-pub-3940256099942544~1458002511',
        rewarded: 'ca-app-pub-3940256099942544/1712485313',
        interstitial: 'ca-app-pub-3940256099942544/4411468910',
        banner: 'ca-app-pub-3940256099942544/2435281174',
    } as PlatformAdUnits,

    // Production Android AdMob IDs (Google Play)
    PROD_ANDROID: {
        appId: 'ca-app-pub-2271052258925299~9087225241',
        rewarded: 'ca-app-pub-2271052258925299/4683790855',
        interstitial: 'ca-app-pub-2271052258925299/4987043180',
        banner: '',
    } as PlatformAdUnits,

    // Production iOS AdMob IDs (App Store)
    PROD_IOS: {
        appId: 'ca-app-pub-2271052258925299~1755530130',
        rewarded: 'ca-app-pub-2271052258925299/1563958447',
        interstitial: 'ca-app-pub-2271052258925299/9442448467',
        banner: '',
    } as PlatformAdUnits,
};

export function isAdMobTestMode(): boolean {
    return sys.os === sys.OS.IOS ? ADMOB_CONFIG.USE_TEST_ADS_IOS : ADMOB_CONFIG.USE_TEST_ADS_ANDROID;
}

export function getActiveAdMobUnits(): PlatformAdUnits {
    const isIOS = sys.os === sys.OS.IOS;
    if (isAdMobTestMode()) {
        return isIOS ? ADMOB_CONFIG.TEST_IOS : ADMOB_CONFIG.TEST_ANDROID;
    }
    return isIOS ? ADMOB_CONFIG.PROD_IOS : ADMOB_CONFIG.PROD_ANDROID;
}
