# Fleet driver APK

Place the built Android release APK here as `gfc-fleet-driver.apk`.

Build from the repo root:

```bash
cd fleet-driver
npm run android:build
```

Then copy:

`fleet-driver/android/app/build/outputs/apk/release/app-release.apk`

to this folder as `gfc-fleet-driver.apk`.

The admin Fleet tab links to `/fleet-driver/gfc-fleet-driver.apk` for sideload install.
