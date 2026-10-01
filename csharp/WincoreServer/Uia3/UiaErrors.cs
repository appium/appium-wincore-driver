using System.Runtime.InteropServices;

namespace WincoreServer.Uia3;

/// <summary>
/// The exceptions a UIA3 COM call raises when an element or property is gone, unsupported
/// or inaccessible — the cases tree walks and verified actions tolerate. COM interop maps
/// failure HRESULTs to .NET types, so <see cref="COMException"/> alone is not enough:
/// <list type="bullet">
/// <item>UIA_E_ELEMENTNOTAVAILABLE / UIA_E_NOTSUPPORTED / RPC errors → <see cref="COMException"/></item>
/// <item>E_INVALIDARG (e.g. reading a property that is not in the cache) → <see cref="ArgumentException"/></item>
/// <item>E_ACCESSDENIED → <see cref="UnauthorizedAccessException"/></item>
/// <item>UIA_E_INVALIDOPERATION → <see cref="InvalidOperationException"/></item>
/// <item>UIA_E_TIMEOUT → <see cref="TimeoutException"/></item>
/// <item>E_NOTIMPL → <see cref="NotImplementedException"/>; provider quirks → <see cref="NotSupportedException"/> / <see cref="InvalidCastException"/></item>
/// </list>
/// Anything else is a bug and should surface. Use as <c>catch (Exception ex) when (UiaErrors.IsExpected(ex))</c>.
/// </summary>
internal static class UiaErrors
{
    public static bool IsExpected(Exception ex) => ex is COMException
        or ArgumentException
        or UnauthorizedAccessException
        or InvalidOperationException
        or TimeoutException
        or NotImplementedException
        or NotSupportedException
        or InvalidCastException;
}
