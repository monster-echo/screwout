/****************************************************************************
 Copyright (c) 2010-2013 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2022 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#import "AppDelegate.h"
#import "ViewController.h"
#import "View.h"
#import <objc/runtime.h>

#include "platform/ios/IOSPlatform.h"
#import "platform/ios/AppDelegateBridge.h"
#import "service/SDKWrapper.h"

@implementation UIApplication (ScrewOutSceneOrientation)
+ (void)load {
    Method orig = class_getInstanceMethod(self, @selector(statusBarOrientation));
    Method alt = class_getInstanceMethod(self, @selector(screwout_statusBarOrientation));
    if (orig && alt) {
        method_exchangeImplementations(orig, alt);
    }
}

- (UIInterfaceOrientation)screwout_statusBarOrientation {
    UIInterfaceOrientation ori = [self screwout_statusBarOrientation];
    if (ori != UIInterfaceOrientationUnknown) return ori;
    if (@available(iOS 13.0, *)) {
        for (UIScene *scene in self.connectedScenes) {
            if ([scene isKindOfClass:[UIWindowScene class]]) {
                UIInterfaceOrientation sOri = ((UIWindowScene *)scene).interfaceOrientation;
                if (sOri != UIInterfaceOrientationUnknown) return sOri;
            }
        }
    }
    return UIInterfaceOrientationPortrait;
}
@end

API_AVAILABLE(ios(13.0))
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property(strong, nonatomic) UIWindow *window;
@end

@implementation SceneDelegate
- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    if (![scene isKindOfClass:[UIWindowScene class]]) return;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
    [appDelegate startCocosInWindowScene:windowScene];
    self.window = appDelegate.window;
}

- (void)sceneDidBecomeActive:(UIScene *)scene {
    AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
    [appDelegate applicationDidBecomeActive:[UIApplication sharedApplication]];
}

- (void)sceneWillResignActive:(UIScene *)scene {
    AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
    [appDelegate applicationWillResignActive:[UIApplication sharedApplication]];
}

- (void)sceneDidEnterBackground:(UIScene *)scene {
    AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
    [appDelegate applicationDidEnterBackground:[UIApplication sharedApplication]];
}

- (void)sceneWillEnterForeground:(UIScene *)scene {
    AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
    [appDelegate applicationWillEnterForeground:[UIApplication sharedApplication]];
}
@end

@implementation AppDelegate
@synthesize window;
@synthesize appDelegateBridge;
@synthesize launchOptions = _savedLaunchOptions;
@synthesize launchedBridge = _launchedBridge;
@synthesize launchOverlay = _launchOverlay;

#pragma mark -
#pragma mark Application lifecycle

- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
                                   options:(UISceneConnectionOptions *)options API_AVAILABLE(ios(13.0)) {
    UISceneConfiguration *cfg = [[UISceneConfiguration alloc] initWithName:@"Default Configuration"
                                                              sessionRole:connectingSceneSession.role];
    cfg.delegateClass = [SceneDelegate class];
    return cfg;
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [[SDKWrapper shared] application:application didFinishLaunchingWithOptions:launchOptions];
    appDelegateBridge = [[AppDelegateBridge alloc] init];
    self.launchOptions = launchOptions;
    self.launchedBridge = NO;
    return YES;
}

- (void)startCocosInWindowScene:(UIWindowScene *)windowScene API_AVAILABLE(ios(13.0)) {
    if (self.launchedBridge) {
        self.window.windowScene = windowScene;
        [self.window makeKeyAndVisible];
        return;
    }
    self.launchedBridge = YES;
    self.window = [[UIWindow alloc] initWithWindowScene:windowScene];
    UIColor *blushBg = [UIColor colorWithRed:1.0 green:0.929 blue:0.953 alpha:1.0];
    self.window.backgroundColor = blushBg;
    CGRect bounds = self.window.bounds;

    _viewController                           = [[ViewController alloc] init];
    _viewController.view                      = [[View alloc] initWithFrame:bounds];
    _viewController.view.backgroundColor      = blushBg;
    _viewController.view.contentScaleFactor   = UIScreen.mainScreen.scale;
    _viewController.view.multipleTouchEnabled = true;

    UIImage *launchImg = [UIImage imageNamed:@"LaunchScreenBackground.png"];
    if (launchImg) {
        UIImageView *overlay = [[UIImageView alloc] initWithFrame:bounds];
        overlay.image = launchImg;
        overlay.contentMode = UIViewContentModeScaleAspectFill;
        overlay.clipsToBounds = YES;
        overlay.userInteractionEnabled = NO;
        overlay.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        [_viewController.view addSubview:overlay];
        self.launchOverlay = overlay;

        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [AppDelegate hideLaunchOverlay:@"ready"];
        });
    }

    [self.window setRootViewController:_viewController];

    [self.window makeKeyAndVisible];
    [appDelegateBridge application:[UIApplication sharedApplication] didFinishLaunchingWithOptions:self.launchOptions];
}

+ (void)hideLaunchOverlay:(NSString *)reason {
    dispatch_async(dispatch_get_main_queue(), ^{
        id appDelegate = [UIApplication sharedApplication].delegate;
        if (![appDelegate isKindOfClass:[AppDelegate class]]) return;
        AppDelegate *ad = (AppDelegate *)appDelegate;
        UIImageView *overlay = ad.launchOverlay;
        if (!overlay) return;
        ad.launchOverlay = nil;
        [UIView animateWithDuration:0.25
                              delay:0.0
                            options:UIViewAnimationOptionCurveEaseOut
                         animations:^{
                             overlay.alpha = 0.0;
                         }
                         completion:^(BOOL finished) {
                             [overlay removeFromSuperview];
                         }];
    });
}

- (void)applicationWillResignActive:(UIApplication *)application {
    [[SDKWrapper shared] applicationWillResignActive:application];
    [appDelegateBridge applicationWillResignActive:application];
}

- (void)applicationDidBecomeActive:(UIApplication *)application {
    [[SDKWrapper shared] applicationDidBecomeActive:application];
    [appDelegateBridge applicationDidBecomeActive:application];
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
    [[SDKWrapper shared] applicationDidEnterBackground:application];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
    [[SDKWrapper shared] applicationWillEnterForeground:application];
}

- (void)applicationWillTerminate:(UIApplication *)application {
    [[SDKWrapper shared] applicationWillTerminate:application];
    [appDelegateBridge applicationWillTerminate:application];
}

#pragma mark -
#pragma mark Memory management

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application {
    [[SDKWrapper shared] applicationDidReceiveMemoryWarning:application];
}

@end
