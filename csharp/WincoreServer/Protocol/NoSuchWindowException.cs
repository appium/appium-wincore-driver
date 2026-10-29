namespace WincoreServer.Protocol;

/// <summary>
/// The top-level window the session is attached to no longer exists (for example a dialog
/// the session switched to has been closed). Maps to <see cref="ErrorCodes.NoSuchWindow"/>
/// and the W3C "no such window" error.
/// </summary>
public sealed class NoSuchWindowException : Exception
{
    public NoSuchWindowException(string message) : base(message) { }
}
