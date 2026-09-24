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
const nativeTargetDir = join(androidDir, 'app', 'src', 'main', 'java', 'com', 'krovi', 'music')

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
console.log('Krovi Android media service prepared.')
