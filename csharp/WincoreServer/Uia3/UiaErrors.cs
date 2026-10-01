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
/// Anything else is a bug and should surface — including <see cref="ArgumentNullException"/>:
/// interop never raises it, so it can only be a null passed by our own code.
/// Use as <c>catch (Exception ex) when (UiaErrors.IsExpected(ex))</c>.
/// </summary>
internal static class UiaErrors
{
    /// <summary>UIA_E_ELEMENTNOTAVAILABLE: the element no longer exists in the UI.</summary>
    public const int ElementNotAvailable = unchecked((int)0x80040201);

    public static bool IsExpected(Exception ex) => ex is COMException
        or ArgumentException and not ArgumentNullException
        or UnauthorizedAccessException
        or InvalidOperationException
        or TimeoutException
        or NotImplementedException
        or NotSupportedException
        or InvalidCastException;

    /// <summary>
    /// True only when UIA reports the element as gone (UIA_E_ELEMENTNOTAVAILABLE). Verified
    /// actions treat a vanished element as done; a timeout or an access error proves nothing
    /// and must not be read as success.
    /// </summary>
    public static bool IsGone(IUIAutomationElement element)
    {
        try
        {
            _ = element.CurrentProcessId;
            return false;
        }
        catch (COMException ex) when (ex.HResult == ElementNotAvailable)
        {
            return true;
        }
        catch (Exception ex) when (IsExpected(ex))
        {
            return false;
        }
    }
}
