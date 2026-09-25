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

const nativeAssetsDir = join(root, 'native', 'android', 'assets')
const nativeLogoPath = join(nativeAssetsDir, 'krovi_logo.png')
const drawableDir = join(androidDir, 'app', 'src', 'main', 'res', 'drawable')
const drawableLogoPath = join(drawableDir, 'krovi_logo.png')

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
mkdirSync(drawableDir, { recursive: true })

if (existsSync(nativeLogoPath)) {
  copyFileSync(nativeLogoPath, drawableLogoPath)
}

for (const file of ['MainActivity.java', 'KroviMediaService.java']) {
  copyFileSync(join(nativeSourceDir, file), join(nativeTargetDir, file))
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

function removeXmlAttribute(openingTag, attributeName) {
  const token = ' ' + attributeName + '="'

  while (true) {
    const start = openingTag.indexOf(token)
    if (start < 0) return openingTag

    const valueStart = start + token.length
    const valueEnd = openingTag.indexOf('"', valueStart)

    if (valueEnd < 0) return openingTag

    openingTag =
      openingTag.slice(0, start) +
      openingTag.slice(valueEnd + 1)
  }
}

const applicationTag = '<application'
const applicationStart = manifest.indexOf(applicationTag)
const applicationEnd = applicationStart >= 0
  ? manifest.indexOf('>', applicationStart)
  : -1

if (existsSync(drawableLogoPath) && applicationStart >= 0 && applicationEnd >= 0) {
  let opening = manifest.slice(applicationStart, applicationEnd)

  opening = removeXmlAttribute(opening, 'android:icon')
  opening = removeXmlAttribute(opening, 'android:roundIcon')

  opening += ' android:icon="@drawable/krovi_logo"'
  opening += ' android:roundIcon="@drawable/krovi_logo"'

  manifest =
    manifest.slice(0, applicationStart) +
    opening +
    manifest.slice(applicationEnd)
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

  manifest = manifest.replace(
    '    </application>',
    service + '    </application>',
  )
}

writeFileSync(manifestPath, manifest)

const valuesDir = join(androidDir, 'app', 'src', 'main', 'res', 'values')
const colorsPath = join(valuesDir, 'colors.xml')
const stylesPath = join(valuesDir, 'styles.xml')

mkdirSync(valuesDir, { recursive: true })

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

function patchLaunchTheme(stylePath, includeSplashBackground) {
  if (!existsSync(stylePath)) return

  let styles = readFileSync(stylePath, 'utf8')
  const openTag = '<style name="AppTheme.NoActionBarLaunch"'
  const start = styles.indexOf(openTag)

  if (start < 0) return

  const openEnd = styles.indexOf('>', start)
  const close = styles.indexOf('</style>', openEnd)

  if (openEnd < 0 || close < 0) return

  let body = styles.slice(openEnd + 1, close)

  const backgroundItem = '<item name="android:windowBackground">'
  const backgroundStart = body.indexOf(backgroundItem)

  if (backgroundStart >= 0) {
    const itemEnd = body.indexOf('</item>', backgroundStart)
    if (itemEnd >= 0) {
      body =
        body.slice(0, backgroundStart) +
        '        <item name="android:windowBackground">@color/krovi_startup_background</item>\n' +
        body.slice(itemEnd + '</item>'.length)
    }
  } else {
    body += '\n        <item name="android:windowBackground">@color/krovi_startup_background</item>\n'
  }

  if (includeSplashBackground) {
    const splashItem = '<item name="windowSplashScreenBackground">'
    const splashStart = body.indexOf(splashItem)

    if (splashStart >= 0) {
      const itemEnd = body.indexOf('</item>', splashStart)
      if (itemEnd >= 0) {
        body =
          body.slice(0, splashStart) +
          '        <item name="windowSplashScreenBackground">@color/krovi_startup_background</item>\n' +
          body.slice(itemEnd + '</item>'.length)
      }
    } else {
      body += '        <item name="windowSplashScreenBackground">@color/krovi_startup_background</item>\n'
    }
  }

  styles = styles.slice(0, openEnd + 1) + body + styles.slice(close)
  writeFileSync(stylePath, styles)
}

patchLaunchTheme(stylesPath, false)

const v31Dir = join(androidDir, 'app', 'src', 'main', 'res', 'values-v31')
const v31StylesPath = join(v31Dir, 'styles.xml')
mkdirSync(v31Dir, { recursive: true })
patchLaunchTheme(v31StylesPath, true)

console.log('Krovi Android media service, launcher icon, and launch theme prepared.')
