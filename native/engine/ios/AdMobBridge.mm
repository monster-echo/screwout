#import "AdMobBridge.h"
#import <UIKit/UIKit.h>
#import <AppTrackingTransparency/AppTrackingTransparency.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
#import <UserMessagingPlatform/UserMessagingPlatform.h>
#include "cocos/bindings/jswrapper/SeApi.h"
#include "cocos/application/ApplicationManager.h"

@interface AdMobBridge () <GADFullScreenContentDelegate>
@property (nonatomic, copy) NSString *rewardedUnitId;
@property (nonatomic, copy) NSString *interstitialUnitId;
@property (nonatomic, copy) NSString *bannerUnitId;
@property (nonatomic, copy) NSString *activePlacement;
@property (nonatomic, assign) BOOL sdkStarted;
@property (nonatomic, assign) BOOL rewardedLoading;
@property (nonatomic, assign) BOOL interstitialLoading;
@property (nonatomic, assign) BOOL rewardEarnedInSession;
@property (nonatomic, strong) GADRewardedAd *rewardedAd;
@property (nonatomic, strong) GADInterstitialAd *interstitialAd;
@property (nonatomic, strong) GADBannerView *bannerView;
@end

@implementation AdMobBridge

+ (instancetype)shared {
    static AdMobBridge *ins = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        ins = [[AdMobBridge alloc] init];
    });
    return ins;
}

+ (UIViewController *)topViewController {
    UIWindow *keyWindow = nil;
    for (UIWindowScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
            for (UIWindow *w in scene.windows) {
                if (w.isKeyWindow) { keyWindow = w; break; }
            }
        }
    }
    UIViewController *vc = keyWindow.rootViewController;
    while (vc.presentedViewController) {
        vc = vc.presentedViewController;
    }
    return vc;
}

+ (void)notifyJs:(NSString *)event detail:(NSString *)detail {
    NSString *safe = [detail ?: @"" stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    NSString *js = [NSString stringWithFormat:@"window.__SCREW_OUT_ADMOB_CB__ && window.__SCREW_OUT_ADMOB_CB__('%@','%@');", event, safe];
    std::string script([js UTF8String]);
    CC_CURRENT_ENGINE()->getScheduler()->performFunctionInCocosThread([script]() {
        se::ScriptEngine::getInstance()->evalString(script.c_str());
    });
}

+ (void)initWithRewarded:(NSString *)rewardedId
            interstitial:(NSString *)interstitialId
                  banner:(NSString *)bannerId {
    AdMobBridge *ins = [self shared];
    ins.rewardedUnitId = rewardedId ?: @"";
    ins.interstitialUnitId = interstitialId ?: @"";
    ins.bannerUnitId = bannerId ?: @"";

    dispatch_async(dispatch_get_main_queue(), ^{
        [ins requestATTAndConsent];
    });
}

- (void)requestATTAndConsent {
    void (^runUMP)(void) = ^{
        UMPRequestParameters *params = [[UMPRequestParameters alloc] init];
        params.tagForUnderAgeOfConsent = NO;
        [UMPConsentInformation.sharedInstance
            requestConsentInfoUpdateWithParameters:params
            completionHandler:^(NSError * _Nullable requestError) {
                UIViewController *vc = [AdMobBridge topViewController];
                [UMPConsentForm loadAndPresentIfRequiredFromViewController:vc
                    completionHandler:^(NSError * _Nullable formError) {
                        if (UMPConsentInformation.sharedInstance.canRequestAds) {
                            [self startMobileAds];
                        }
                    }];
            }];
        if (UMPConsentInformation.sharedInstance.canRequestAds) {
            [self startMobileAds];
        }
    };

    if (@available(iOS 14, *)) {
        // iOS 15+ requires UIApplicationStateActive before showing ATT dialog; delay 1.0s safely.
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [ATTrackingManager requestTrackingAuthorizationWithCompletionHandler:^(ATTrackingManagerAuthorizationStatus status) {
                dispatch_async(dispatch_get_main_queue(), runUMP);
            }];
        });
    } else {
        runUMP();
    }
}

- (void)startMobileAds {
    if (self.sdkStarted) return;
    self.sdkStarted = YES;
    [GADMobileAds.sharedInstance startWithCompletionHandler:^(GADInitializationStatus * _Nonnull status) {
        [AdMobBridge notifyJs:@"sdk_ready" detail:@"ios"];
        [self preloadRewarded];
        [self preloadInterstitial];
    }];
}

- (void)preloadRewarded {
    if (self.rewardedLoading || self.rewardedAd != nil || self.rewardedUnitId.length == 0) return;
    self.rewardedLoading = YES;
    [GADRewardedAd loadWithAdUnitID:self.rewardedUnitId
                            request:[GADRequest request]
                  completionHandler:^(GADRewardedAd * _Nullable ad, NSError * _Nullable error) {
        self.rewardedLoading = NO;
        if (error) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(15 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                [self preloadRewarded];
            });
            return;
        }
        self.rewardedAd = ad;
        self.rewardedAd.fullScreenContentDelegate = self;
        [AdMobBridge notifyJs:@"rewarded_loaded" detail:@""];
    }];
}

- (void)preloadInterstitial {
    if (self.interstitialLoading || self.interstitialAd != nil || self.interstitialUnitId.length == 0) return;
    self.interstitialLoading = YES;
    [GADInterstitialAd loadWithAdUnitID:self.interstitialUnitId
                                request:[GADRequest request]
                      completionHandler:^(GADInterstitialAd * _Nullable ad, NSError * _Nullable error) {
        self.interstitialLoading = NO;
        if (error) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(20 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                [self preloadInterstitial];
            });
            return;
        }
        self.interstitialAd = ad;
        self.interstitialAd.fullScreenContentDelegate = self;
    }];
}

+ (void)showRewarded:(NSString *)placement {
    dispatch_async(dispatch_get_main_queue(), ^{
        AdMobBridge *ins = [self shared];
        UIViewController *vc = [self topViewController];
        if (!ins.rewardedAd || !vc) {
            [ins preloadRewarded];
            [self notifyJs:@"rewarded_failed" detail:placement];
            return;
        }
        GADRewardedAd *ad = ins.rewardedAd;
        ins.rewardedAd = nil;
        ins.activePlacement = placement ?: @"";
        ins.rewardEarnedInSession = NO;
        [ad presentFromRootViewController:vc userDidEarnRewardHandler:^{
            ins.rewardEarnedInSession = YES;
            [AdMobBridge notifyJs:@"rewarded_complete" detail:ins.activePlacement];
        }];
    });
}

+ (void)showInterstitial:(NSString *)reason {
    dispatch_async(dispatch_get_main_queue(), ^{
        AdMobBridge *ins = [self shared];
        UIViewController *vc = [self topViewController];
        if (!ins.interstitialAd || !vc) {
            [ins preloadInterstitial];
            [self notifyJs:@"interstitial_failed" detail:reason];
            return;
        }
        GADInterstitialAd *ad = ins.interstitialAd;
        ins.interstitialAd = nil;
        ins.activePlacement = reason ?: @"";
        [self notifyJs:@"interstitial_shown" detail:ins.activePlacement];
        [ad presentFromRootViewController:vc];
    });
}

+ (void)showBanner {
    dispatch_async(dispatch_get_main_queue(), ^{
        AdMobBridge *ins = [self shared];
        UIViewController *vc = [self topViewController];
        if (!vc || ins.bannerUnitId.length == 0) return;
        if (!ins.bannerView) {
            CGFloat width = CGRectGetWidth(UIEdgeInsetsInsetRect(vc.view.frame, vc.view.safeAreaInsets));
            GADAdSize size = GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(width);
            GADBannerView *bv = [[GADBannerView alloc] initWithAdSize:size];
            bv.adUnitID = ins.bannerUnitId;
            bv.rootViewController = vc;
            bv.translatesAutoresizingMaskIntoConstraints = NO;
            [vc.view addSubview:bv];
            [NSLayoutConstraint activateConstraints:@[
                [bv.bottomAnchor constraintEqualToAnchor:vc.view.safeAreaLayoutGuide.bottomAnchor],
                [bv.centerXAnchor constraintEqualToAnchor:vc.view.centerXAnchor]
            ]];
            [bv loadRequest:[GADRequest request]];
            ins.bannerView = bv;
        }
        ins.bannerView.hidden = NO;
    });
}

+ (void)hideBanner {
    dispatch_async(dispatch_get_main_queue(), ^{
        AdMobBridge *ins = [self shared];
        if (ins.bannerView) ins.bannerView.hidden = YES;
    });
}

+ (void)showPrivacyOptions {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *vc = [self topViewController];
        if (!vc) return;
        [UMPConsentForm presentPrivacyOptionsFormFromViewController:vc completionHandler:^(NSError * _Nullable err) {
            // Optional callback
        }];
    });
}

+ (void)vibrate:(NSString *)style {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIImpactFeedbackStyle s = [style isEqualToString:@"medium"]
            ? UIImpactFeedbackStyleMedium
            : UIImpactFeedbackStyleLight;
        UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:s];
        [gen impactOccurred];
    });
}

#pragma mark - GADFullScreenContentDelegate

- (void)adDidDismissFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
    if ([ad isKindOfClass:[GADRewardedAd class]]) {
        if (!self.rewardEarnedInSession) {
            [AdMobBridge notifyJs:@"rewarded_dismissed" detail:self.activePlacement];
        }
        [self preloadRewarded];
    } else if ([ad isKindOfClass:[GADInterstitialAd class]]) {
        [AdMobBridge notifyJs:@"interstitial_dismissed" detail:self.activePlacement];
        [self preloadInterstitial];
    }
}

- (void)ad:(id<GADFullScreenPresentingAd>)ad didFailToPresentFullScreenContentWithError:(NSError *)error {
    if ([ad isKindOfClass:[GADRewardedAd class]]) {
        [AdMobBridge notifyJs:@"rewarded_failed" detail:self.activePlacement];
        [self preloadRewarded];
    } else if ([ad isKindOfClass:[GADInterstitialAd class]]) {
        [AdMobBridge notifyJs:@"interstitial_failed" detail:self.activePlacement];
        [self preloadInterstitial];
    }
}

@end
