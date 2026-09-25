import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = join(root, 'android')
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'

if (!existsSync(androidDir)) {
  execFileSync(npxCommand, ['cap', 'add', 'android'], {
    cwd: root,
    stdio: 'inherit',
  })
}

const nativeSourceDir = join(root, 'native', 'android', 'com', 'krovi', 'music')
const nativeTargetDir = join(
  androidDir,
  'app',
  'src',
  'main',
  'java',
  'com',
  'krovi',
  'music',
)

mkdirSync(nativeTargetDir, { recursive: true })

for (const file of ['MainActivity.java', 'KroviMediaService.java']) {
  copyFileSync(
    join(nativeSourceDir, file),
    join(nativeTargetDir, file),
  )
}

const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')

const permissions = [
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '    <uses-permission android:name="android.permission.WAKE_LOCK" />',
]

for (const permission of permissions) {
  if (!manifest.includes(permission)) {
    manifest = manifest.replace(
      '    <application',
      permission + '\n\n    <application',
    )
  }
}

if (!manifest.includes('com.krovi.music.KroviMediaService')) {
  const service = [
    '    <service',
    '        android:name="com.krovi.music.KroviMediaService"',
    '        android:exported="false"',
    '        android:foregroundServiceType="mediaPlayback"',
    '        android:stopWithTask="false" />',
    '',
  ].join('\n')

  manifest = manifest.replace('    </application>', service + '    </application>')
}

writeFileSync(manifestPath, manifest)

const valuesDir = join(androidDir, 'app', 'src', 'main', 'res', 'values')
const v31Dir = join(androidDir, 'app', 'src', 'main', 'res', 'values-v31')
const colorsPath = join(valuesDir, 'colors.xml')
const stylesPath = join(valuesDir, 'styles.xml')
const v31StylesPath = join(v31Dir, 'styles.xml')

mkdirSync(valuesDir, { recursive: true })
mkdirSync(v31Dir, { recursive: true })

function ensureStartupColor() {
  let colors = existsSync(colorsPath)
    ? readFileSync(colorsPath, 'utf8')
    : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n'

  if (!colors.includes('krovi_startup_background')) {
    colors = colors.replace(
      '</resources>',
      '    <color name="krovi_startup_background">#24141C</color>\n</resources>',
    )
  }

  writeFileSync(colorsPath, colors)
}

function patchLaunchTheme(stylePath, includeSplashBackground) {
  if (!existsSync(stylePath)) return

  let styles = readFileSync(stylePath, 'utf8')

  const pattern = /(<style name="AppTheme\\.NoActionBarLaunch"[^>]*>)([\\s\\S]*?)(<\\/style>)/m

  styles = styles.replace(pattern, (_match, open, body, close) => {
    let nextBody = body

    if (nextBody.includes('android:windowBackground')) {
      nextBody = nextBody.replace(
        /<item name="android:windowBackground">[^<]*<\\/item>/,
        '        <item name="android:windowBackground">@color/krovi_startup_background</item>',
      )
    } else {
      nextBody += '        <item name="android:windowBackground">@color/krovi_startup_background</item>\n'
    }

    if (includeSplashBackground) {
      if (nextBody.includes('windowSplashScreenBackground')) {
        nextBody = nextBody.replace(
          /<item name="windowSplashScreenBackground">[^<]*<\\/item>/,
          '        <item name="windowSplashScreenBackground">@color/krovi_startup_background</item>',
        )
      } else {
        nextBody += '        <item name="windowSplashScreenBackground">@color/krovi_startup_background</item>\n'
      }
    }

    return open + nextBody + close
  })

  writeFileSync(stylePath, styles)
}

ensureStartupColor()
patchLaunchTheme(stylesPath, false)
patchLaunchTheme(v31StylesPath, true)

console.log('Krovi Android media service and launch theme prepared.')
