# UI Audit Report

Started: 2026-07-02T08:23:25.685Z
Result: BLOCKED BY TEST ENVIRONMENT

## Why It Stopped

browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --allow-file-access-from-files --user-data-dir=/var/folders/lt/lb7bwfcs33s8wn94fj3yf6r00000gn/T/playwright_chromiumdev_profile-eOQFqU --remote-debugging-pipe --no-startup-window
<launched> pid=96430
Call log:
[2m  - <launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --allow-file-access-from-files --user-data-dir=/var/folders/lt/lb7bwfcs33s8wn94fj3yf6r00000gn/T/playwright_chromiumdev_profile-eOQFqU --remote-debugging-pipe --no-startup-window[22m
[2m  - <launched> pid=96430[22m
[2m  - [pid=96430] <gracefully close start>[22m
[2m  - [pid=96430] <kill>[22m
[2m  - [pid=96430] <will force kill>[22m
[2m  - [pid=96430] exception while trying to kill process: Error: kill EPERM[22m
[2m  - [pid=96430] <process did exit: exitCode=null, signal=SIGABRT>[22m
[2m  - [pid=96430] starting temporary directories cleanup[22m
[2m  - [pid=96430] finished temporary directories cleanup[22m
[2m  - [pid=96430] <gracefully close end>[22m


## Next Step

Run this audit in a local terminal or an environment that permits opening a localhost server and launching Chromium:

```bash
cd /Users/zhouruoqi/Downloads/japaneselearning/frontend
npm run audit:ui
```
