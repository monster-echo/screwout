#import <Foundation/Foundation.h>

@interface AdMobBridge : NSObject

+ (void)initWithRewarded:(NSString *)rewardedId
            interstitial:(NSString *)interstitialId
                  banner:(NSString *)bannerId;
+ (void)showRewarded:(NSString *)placement;
+ (void)showInterstitial:(NSString *)reason;
+ (void)showBanner;
+ (void)hideBanner;
+ (void)showPrivacyOptions;
+ (void)vibrate:(NSString *)style;

@end
