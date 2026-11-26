# Screw Out: Sweet Jam — App Store & Google Play Release Kit

## 1. Store Metadata (English / Tier-1 Western Markets)

- **App Name (30 chars max):** `Screw Out: Sweet Jam`
- **iOS Subtitle (30 chars max):** `Candy Bolts & Cookie ASMR`
- **Google Play Short Description (80 chars max):**
  `Unscrew glossy candy bolts, drop frosted cookies & craft 3D pixel artworks!`
- **iOS Keywords (100 chars max):**
  `screw,puzzle,jam,candy,dessert,asmr,unscrew,bolts,sorting,match,relaxing,casual,brain,wood,cookie`
- **Primary Category:** Games → Puzzle
- **Secondary Category:** Games → Casual
- **Age Rating:** 4+ (App Store) / Everyone (Google Play)
- **Bundle ID / Package Name:** `tech.zhongbei.screwout`

### Full Store Description (EN-US)
Unwind with **Screw Out: Sweet Jam** — the irresistibly satisfying 3D unscrewing puzzle where juicy gummy-candy bolts meet frosted icing cookies!

Tap to unscrew colorful candy bolts, match them into matching pastry gift boxes, and watch layered frosted cookies tumble away with crunchy ASMR physics. Collect bolts after every level to build 12 gorgeous 3D pixel artworks in your personal gallery!

**WHY YOU'LL LOVE IT**
- **Mouthwatering Sweet Dessert Theme:** Juicy glossy candy bolts, golden-baked frosted cookies, pastel pastry boxes, and satisfying crumb & pop feedback.
- **Switch Themes Anytime:** Love crisp high-contrast clarity on deep multi-layer puzzles? Unlock **Wood & Acrylic** (Level 10 or free via ad) and **Minimalist Nordic** (Level 20) in the in-game Theme Shop!
- **100+ Handcrafted Physics Levels:** Smooth difficulty curve from relaxing starter puzzles to clever multi-layer brain teasers.
- **3D Screw Pixel Art Gallery:** Hold-to-shoot your collected bolts to bring 12 charming artworks to life.
- **Smart Boosters:** Expand your holding tray (`+1 SLOT`), clear stuck screws (`CLEAR`), or melt a tricky board (`MELT`) whenever you need a hand.

Download **Screw Out: Sweet Jam** now and feel the sweetest click-and-pop puzzle on mobile!

---

## 2. Generated Store Assets Inventory

| Asset | Path | Spec |
| :--- | :--- | :--- |
| iOS App Store Icon | `store_assets/ios/AppIcon_1024x1024.png` | 1024×1024 RGB (no alpha) |
| iOS 6.7" Screenshots (×5) | `store_assets/ios/screenshots_6.7/*.png` | 1290×2796 RGB |
| iOS Privacy Manifest | `store_assets/ios/PrivacyInfo.xcprivacy` | Required by Apple (UserDefaults + BootTime + Ads) |
| Google Play Icon | `store_assets/android/PlayIcon_512x512.png` | 512×512 RGB |
| Android Adaptive Icon | `store_assets/android/AdaptiveIcon_{fg,bg}_432.png` | 432×432 fg/bg layers |
| Google Play Feature Graphic | `store_assets/android/FeatureGraphic_1024x500.png` | 1024×500 RGB |
| Google Play Screenshots (×5) | `store_assets/android/screenshots_phone/*.png` | 1080×1920 RGB |
| Transparent Title Logo | `store_assets/Logo_ScrewOut_SweetJam.png` | 900×300 RGBA |

---

## 3. Native Build & Submission Commands

### iOS (Xcode / App Store Connect)
```bash
/Applications/Cocos/Creator/3.8.6/CocosCreator.app/Contents/MacOS/CocosCreator \
  --project /Users/echo/workspace/CocosGames/ScrewOut \
  --build "configPath=/Users/echo/workspace/CocosGames/ScrewOut/build-config.ios.json"
```
1. Open `build/ios/proj/ScrewOutSweetJam.xcodeproj` in Xcode.
2. Add `store_assets/ios/PrivacyInfo.xcprivacy` to the app target.
3. Add `NSUserTrackingUsageDescription` to `Info.plist` for iOS ATT prompt.
4. Wire AppLovin MAX / AdMob SDK to Objective-C class `AdBridge` (`requestConsent`, `showRewarded:`, `showInterstitial:`, `vibrate:`).
5. Archive & Upload to App Store Connect via Xcode Organizer.

### Android (Android Studio / Google Play Console)
```bash
/Applications/Cocos/Creator/3.8.6/CocosCreator \
  --project /Users/echo/workspace/CocosGames/ScrewOut \
  --build "configPath=/Users/echo/workspace/CocosGames/ScrewOut/build-config.android.json"
```
1. Open `build/android/proj` in Android Studio (Target SDK 35, AAB enabled, `arm64-v8a` + `armeabi-v7a`).
2. Wire AppLovin MAX / AdMob + Google UMP SDK to Java/Kotlin class `com.screwout.ads.AdBridge` (`requestConsent`, `showRewarded`, `showInterstitial`, `vibrate`).
3. Sign release `.aab` with your upload keystore and upload to Google Play Console.
