package com.screwout.ads;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.CocosJavascriptJavaBridge;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * Google AdMob (GMA SDK + UMP Consent) Native Bridge for Cocos Creator 3.8.6 (Android).
 * Copy to: build/android/proj/app/src/com/screwout/ads/AdMobBridge.java
 */
public class AdMobBridge {
    private static final String TAG = "AdMobBridge";

    private static Activity sActivity;
    private static String sRewardedUnitId = "";
    private static String sInterstitialUnitId = "";
    private static String sBannerUnitId = "";

    private static boolean sMobileAdsInitialized = false;
    private static RewardedAd sRewardedAd = null;
    private static boolean sRewardedLoading = false;
    private static InterstitialAd sInterstitialAd = null;
    private static boolean sInterstitialLoading = false;
    private static AdView sBannerView = null;
    private static ConsentInformation sConsentInfo = null;

    private static final Handler sMainHandler = new Handler(Looper.getMainLooper());

    /** Call once from AppActivity.onCreate(Bundle) after super.onCreate(savedInstanceState). */
    public static void attachActivity(Activity activity) {
        sActivity = activity;
    }

    /** Invoked by TypeScript MonetizationManager.initAdMob(). */
    public static void init(final String rewardedId, final String interstitialId, final String bannerId) {
        sRewardedUnitId = rewardedId != null ? rewardedId : "";
        sInterstitialUnitId = interstitialId != null ? interstitialId : "";
        sBannerUnitId = bannerId != null ? bannerId : "";

        final Activity act = getActivity();
        if (act == null) {
            Log.w(TAG, "init called before attachActivity");
            return;
        }

        act.runOnUiThread(() -> {
            ConsentRequestParameters params = new ConsentRequestParameters.Builder()
                    .setTagForUnderAgeOfConsent(false)
                    .build();
            sConsentInfo = UserMessagingPlatform.getConsentInformation(act);
            sConsentInfo.requestConsentInfoUpdate(
                    act,
                    params,
                    () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(act, formError -> {
                        if (formError != null) {
                            Log.w(TAG, "UMP form error: " + formError.getMessage());
                        }
                        if (sConsentInfo.canRequestAds()) {
                            startMobileAdsSdk(act);
                        }
                    }),
                    requestError -> {
                        Log.w(TAG, "UMP request error: " + requestError.getMessage());
                        if (sConsentInfo != null && sConsentInfo.canRequestAds()) {
                            startMobileAdsSdk(act);
                        }
                    }
            );
            if (sConsentInfo.canRequestAds()) {
                startMobileAdsSdk(act);
            }
        });
    }

    private static void startMobileAdsSdk(Activity act) {
        if (sMobileAdsInitialized) return;
        sMobileAdsInitialized = true;
        MobileAds.initialize(act, status -> {
            Log.i(TAG, "AdMob SDK initialized");
            notifyJs("sdk_ready", "android");
            preloadRewarded(act);
            preloadInterstitial(act);
        });
    }

    private static void preloadRewarded(Activity act) {
        if (sRewardedLoading || sRewardedAd != null || sRewardedUnitId.isEmpty()) return;
        sRewardedLoading = true;
        AdRequest req = new AdRequest.Builder().build();
        RewardedAd.load(act, sRewardedUnitId, req, new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                sRewardedLoading = false;
                sRewardedAd = ad;
                notifyJs("rewarded_loaded", "");
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                sRewardedLoading = false;
                sRewardedAd = null;
                Log.w(TAG, "Rewarded failed to load: " + err.getMessage());
                sMainHandler.postDelayed(() -> {
                    Activity a = getActivity();
                    if (a != null) preloadRewarded(a);
                }, 15_000);
            }
        });
    }

    private static void preloadInterstitial(Activity act) {
        if (sInterstitialLoading || sInterstitialAd != null || sInterstitialUnitId.isEmpty()) return;
        sInterstitialLoading = true;
        AdRequest req = new AdRequest.Builder().build();
        InterstitialAd.load(act, sInterstitialUnitId, req, new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                sInterstitialLoading = false;
                sInterstitialAd = ad;
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                sInterstitialLoading = false;
                sInterstitialAd = null;
                Log.w(TAG, "Interstitial failed to load: " + err.getMessage());
                sMainHandler.postDelayed(() -> {
                    Activity a = getActivity();
                    if (a != null) preloadInterstitial(a);
                }, 20_000);
            }
        });
    }

    public static void showRewarded(final String placement) {
        final Activity act = getActivity();
        if (act == null) {
            notifyJs("rewarded_failed", placement);
            return;
        }
        act.runOnUiThread(() -> {
            if (sRewardedAd == null) {
                preloadRewarded(act);
                notifyJs("rewarded_failed", placement);
                return;
            }
            final RewardedAd ad = sRewardedAd;
            sRewardedAd = null;
            final boolean[] earned = { false };

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    if (!earned[0]) {
                        notifyJs("rewarded_dismissed", placement);
                    }
                    preloadRewarded(act);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    notifyJs("rewarded_failed", placement);
                    preloadRewarded(act);
                }
            });

            ad.show(act, rewardItem -> {
                earned[0] = true;
                notifyJs("rewarded_complete", placement);
            });
        });
    }

    public static void showInterstitial(final String reason) {
        final Activity act = getActivity();
        if (act == null) return;
        act.runOnUiThread(() -> {
            if (sInterstitialAd == null) {
                preloadInterstitial(act);
                notifyJs("interstitial_failed", reason);
                return;
            }
            final InterstitialAd ad = sInterstitialAd;
            sInterstitialAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    notifyJs("interstitial_shown", reason);
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    notifyJs("interstitial_dismissed", reason);
                    preloadInterstitial(act);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    notifyJs("interstitial_failed", reason);
                    preloadInterstitial(act);
                }
            });
            ad.show(act);
        });
    }

    public static void showBanner() {
        final Activity act = getActivity();
        if (act == null || sBannerUnitId.isEmpty()) return;
        act.runOnUiThread(() -> {
            if (sBannerView == null) {
                sBannerView = new AdView(act);
                sBannerView.setAdUnitId(sBannerUnitId);
                DisplayMetrics metrics = act.getResources().getDisplayMetrics();
                int adWidth = (int) (metrics.widthPixels / metrics.density);
                sBannerView.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(act, adWidth));
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
                );
                act.addContentView(sBannerView, lp);
                sBannerView.loadAd(new AdRequest.Builder().build());
            }
            sBannerView.setVisibility(View.VISIBLE);
        });
    }

    public static void hideBanner() {
        final Activity act = getActivity();
        if (act == null) return;
        act.runOnUiThread(() -> {
            if (sBannerView != null) {
                sBannerView.setVisibility(View.GONE);
            }
        });
    }

    public static void showPrivacyOptions() {
        final Activity act = getActivity();
        if (act == null) return;
        act.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(act, formError -> {
            if (formError != null) {
                Log.w(TAG, "Privacy options form error: " + formError.getMessage());
            }
        }));
    }

    public static void vibrate(final String style) {
        final Activity act = getActivity();
        if (act == null) return;
        try {
            Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            long ms = "medium".equals(style) ? 18 : 10;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(ms);
            }
        } catch (Throwable ignored) {
        }
    }

    private static Activity getActivity() {
        return sActivity != null ? sActivity : CocosHelper.getActivity();
    }

    private static void notifyJs(final String event, final String detail) {
        final String safeDetail = detail == null ? "" : detail.replace("'", "\\'");
        final String js = "window.__SCREW_OUT_ADMOB_CB__ && window.__SCREW_OUT_ADMOB_CB__('" + event + "','" + safeDetail + "');";
        CocosHelper.runOnGameThread(() -> CocosJavascriptJavaBridge.evalString(js));
    }
}
