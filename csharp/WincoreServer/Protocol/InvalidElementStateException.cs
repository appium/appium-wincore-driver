namespace WincoreServer.Protocol;

/// <summary>
/// The element exists and the command reached it, but the command did not take
/// effect (a verified select / expand / collapse left the state unchanged). Maps to
/// <see cref="ErrorCodes.InvalidElementState"/> and the W3C "invalid element state"
/// error — never caught by the client's keyboard fallbacks.
/// </summary>
public sealed class InvalidElementStateException : Exception
{
    public InvalidElementStateException(string message) : base(message) { }
}
