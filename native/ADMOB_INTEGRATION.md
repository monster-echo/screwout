# Google AdMob Integration Guide (Screw Out: Sweet Jam)

Everything on the TypeScript side is already wired and compiled:
- **Ad Unit Config:** `assets/scripts/core/AdMobConfig.ts` (defaults to official Google Test IDs; flip `USE_TEST_ADS = false` and paste your production IDs before release)
- **Runtime Bridge:** `assets/scripts/core/MonetizationManager.ts` (initializes AdMob + UMP + ATT on launch, preloads Rewarded & Interstitial, supports optional Adaptive Banner, and exposes Settings -> `AD PRIVACY & POLICY`)

---

## 1. Android (Google Play) Setup

1. Build the Android project via Cocos Creator 3.8.6:
   ```bash
   /Applications/Cocos/Creator/3.8.6/CocosCreator.app/Contents/MacOS/CocosCreator \
     --project /Users/echo/workspace/CocosGames/ScrewOut \
     --build "configPath=/Users/echo/workspace/CocosGames/ScrewOut/build-config.android.json"
   ```
2. Copy `native/android/admob/AdMobBridge.java` to:
   `build/android/proj/app/src/com/screwout/ads/AdMobBridge.java`
3. In `AppActivity.java` inside `onCreate(Bundle savedInstanceState)`, add:
   ```java
   com.screwout.ads.AdMobBridge.attachActivity(this);
   ```
4. In `build/android/proj/app/build.gradle` (`dependencies` block), add:
   ```gradle
   implementation 'com.google.android.gms:play-services-ads:23.6.0'
   implementation 'com.google.android.ump:user-messaging-platform:3.1.0'
   ```
5. In `build/android/proj/app/AndroidManifest.xml` inside `<application>`, add your AdMob App ID:
   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-2271052258925299~9087225241"/>
   ```

---

## 2. iOS (App Store) Setup

1. Build the iOS Xcode project via Cocos Creator 3.8.6:
   ```bash
   /Applications/Cocos/Creator/3.8.6/CocosCreator.app/Contents/MacOS/CocosCreator \
     --project /Users/echo/workspace/CocosGames/ScrewOut \
     --build "configPath=/Users/echo/workspace/CocosGames/ScrewOut/build-config.ios.json"
   ```
2. Copy `native/ios/admob/AdMobBridge.h` and `AdMobBridge.mm` into the Xcode project target.
3. Add CocoaPods dependencies in `Podfile` and run `pod install`:
   ```ruby
   pod 'Google-Mobile-Ads-SDK', '~> 11.13'
   pod 'GoogleUserMessagingPlatform', '~> 2.7'
   ```
4. In `Info.plist`, add:
   ```xml
   <key>GADApplicationIdentifier</key>
   <string>ca-app-pub-2271052258925299~1755530130</string>
   <key>NSUserTrackingUsageDescription</key>
   <string>This identifier will be used to deliver personalized ads to you.</string>
   <key>SKAdNetworkItems</key>
   <array>
       <dict>
           <key>SKAdNetworkIdentifier</key>
           <string>cstr6suwn9.skadnetwork</string>
       </dict>
   </array>
   ```
5. Add `store_assets/ios/PrivacyInfo.xcprivacy` to your Xcode app target.

---

## 3. Ad Placements Currently Wired in Game

| Placement | Format | Trigger |
| :--- | :--- | :--- |
| `unlock_box` | Rewarded | Tapping a locked pastry box during gameplay |
| `revive` | Rewarded | Tapping `FREE REVIVE (AD)` on Tray Full popup |
| `skill_refill` | Rewarded | Using `+1 SLOT` / `CLEAR` / `MELT` when inventory is `0` |
| `unlock_theme` | Rewarded | Early-unlocking `Wood & Acrylic` or `Minimalist Nordic` in Theme Shop |
| `level_win` / `level_retry` | Interstitial | Level 3+ natural breaks with 60s cooldown |
| `showBanner()` / `hideBanner()` | Adaptive Banner | Available anytime via `MonetizationManager.ins` |
