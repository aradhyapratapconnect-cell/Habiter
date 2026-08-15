# register-dev-shortcut.ps1
#
# Development-only helper for the Windows taskbar.
#
# When running the app with `npm run dev`, the process is electron.exe. Without
# a registered shortcut, Windows has no AppUserModelID to associate with the
# taskbar button, so the right-click Jump List header falls back to the
# executable's identity - name "Electron" and the stock Electron logo.
#
# Per the Microsoft AppUserModelIDs documentation, the taskbar takes the name
# and icon from a shortcut that carries the same AppUserModelID as the running
# app. Packaged installs get this from the NSIS installer's Start Menu
# shortcut; this script provides the same registration for dev mode.
#
# It (re)creates a "Habiter" shortcut in the user's Start Menu pointing at the
# dev electron binary, with the app's icon and the AUMID com.habiter.app
# (matches appId in electron-builder.yml). Run it via the `predev` npm hook so
# it stays up to date every time you start `npm run dev`.

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronExe = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
$iconPath    = Join-Path $projectRoot 'build\icons\win\icon.ico'
$startMenu   = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shortcutPath = Join-Path $startMenu 'Habiter.lnk'
$appUserModelId = 'com.habiter.app'

if (-not (Test-Path $electronExe)) {
    Write-Warning "electron.exe not found at $electronExe - skipping taskbar registration."
    exit 0
}

# --- 1. Create the .lnk (name, target, icon, working dir) -------------------
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($shortcutPath)
$lnk.TargetPath       = $electronExe
$lnk.Arguments        = "`"$projectRoot`""
$lnk.WorkingDirectory = $projectRoot
$lnk.IconLocation     = "$iconPath,0"
$lnk.Description      = 'Habiter (development)'
$lnk.Save()

# --- 2. Set the System.AppUserModel.ID property on the .lnk -----------------
# WScript.Shell cannot write property-store values; use SHGetPropertyStoreFromParsingName.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class LnkProperties
{
    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPVARIANT
    {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public IntPtr val1;
        public IntPtr val2;
    }

    [ComImport]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore
    {
        int GetCount(out uint cProps);
        int GetAt(uint iProp, out PROPERTYKEY pkey);
        int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        int Commit();
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern IPropertyStore SHGetPropertyStoreFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
        IntPtr pbc,
        uint flags,
        [In, Out] ref Guid riid);

    private static readonly Guid IID_IPropertyStore = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
    private static readonly Guid PKEY_AppUserModel_ID_fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
    private const uint PKEY_AppUserModel_ID_pid = 5;

    public static void SetAppUserModelId(string shortcutPath, string appUserModelId)
    {
        Guid iid = IID_IPropertyStore;
        IPropertyStore store = SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, 0x2 /* GPS_READWRITE */, ref iid);
        PROPERTYKEY key = new PROPERTYKEY();
        key.fmtid = PKEY_AppUserModel_ID_fmtid;
        key.pid = PKEY_AppUserModel_ID_pid;

        PROPVARIANT pv = new PROPVARIANT();
        pv.vt = 31; // VT_LPWSTR
        pv.val1 = Marshal.StringToCoTaskMemUni(appUserModelId);
        try
        {
            store.SetValue(ref key, ref pv);
            store.Commit();
        }
        finally
        {
            Marshal.FreeCoTaskMem(pv.val1);
            try { Marshal.ReleaseComObject(store); } catch { /* best effort */ }
        }
    }

    public static string GetAppUserModelId(string shortcutPath)
    {
        Guid iid = IID_IPropertyStore;
        // Use GPS_READWRITE (0x2) instead of GPS_DEFAULT (0x0): the default
        // flag opens the .lnk read-only and the previous write handle is still
        // held (COM interop doesn't release it), so 0x0 fails with a sharing
        // violation (0x80070020). With the correct flag this also lets the
        // Set/Commit/Get sequence run without a handle conflict.
        IPropertyStore store = SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, 0x2 /* GPS_READWRITE */, ref iid);
        PROPERTYKEY key = new PROPERTYKEY();
        key.fmtid = PKEY_AppUserModel_ID_fmtid;
        key.pid = PKEY_AppUserModel_ID_pid;

        PROPVARIANT pv;
        store.GetValue(ref key, out pv);
        string result = null;
        if (pv.vt == 31 && pv.val1 != IntPtr.Zero)
        {
            result = Marshal.PtrToStringUni(pv.val1);
        }
        try { Marshal.ReleaseComObject(store); } catch { /* best effort */ }
        return result;
    }
}
'@

[LnkProperties]::SetAppUserModelId($shortcutPath, $appUserModelId)

# --- 3. Verify --------------------------------------------------------------
$readBack = [LnkProperties]::GetAppUserModelId($shortcutPath)
if ($readBack -ne $appUserModelId) {
    Write-Error "Failed to set AppUserModelID on $shortcutPath (read back: '$readBack')"
    exit 1
}

Write-Host "Taskbar registration OK:"
Write-Host "  Shortcut : $shortcutPath"
Write-Host "  AUMID    : $readBack"
Write-Host "  Icon     : $iconPath"
