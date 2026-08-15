// scripts/predev.mjs — runs before `npm run dev` (see "predev" in package.json).
//
// On Windows only, registers the Start Menu shortcut that carries the app's
// AppUserModelID (com.habiter.app), so the dev-mode taskbar button shows the
// name "Habiter" and the app icon instead of falling back to "Electron"
// (TICKET-028, criterion 4). No-op on macOS/Linux, where the taskbar identity
// is derived from the packaged app bundle instead.
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') {
  process.exit(0);
}

const result = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'scripts/register-dev-shortcut.ps1',
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
