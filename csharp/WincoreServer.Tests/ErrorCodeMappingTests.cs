using System.Runtime.InteropServices;
using WincoreServer.Protocol;
using WincoreServer.Server;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// JsonRpcServer.ToErrorCode turns handler exceptions into protocol error codes, which the
/// Node client maps to W3C errors. UIA_E_ELEMENTNOTAVAILABLE must not surface as InternalError.
/// </summary>
public class ErrorCodeMappingTests
{
    [Fact]
    public void NoSuchWindowException_MapsToNoSuchWindow()
    {
        Assert.Equal(ErrorCodes.NoSuchWindow, JsonRpcServer.ToErrorCode(new NoSuchWindowException("closed"), () => false));
    }

    [Fact]
    public void ElementNotAvailable_WhenRootWindowIsGone_MapsToNoSuchWindow()
    {
        Assert.Equal(ErrorCodes.NoSuchWindow, JsonRpcServer.ToErrorCode(FakeElement.ElementNotAvailable(), () => true));
    }

    [Fact]
    public void ElementNotAvailable_WhenRootWindowIsAlive_MapsToElementNotAvailable()
    {
        Assert.Equal(
            ErrorCodes.ElementNotAvailable,
            JsonRpcServer.ToErrorCode(FakeElement.ElementNotAvailable(), () => false));
    }

    [Fact]
    public void RootProbe_IsOnlyConsultedForElementNotAvailable()
    {
        var probed = false;
        JsonRpcServer.ToErrorCode(new KeyNotFoundException(), () => probed = true);
        JsonRpcServer.ToErrorCode(new COMException("E_FAIL", unchecked((int)0x80004005)), () => probed = true);
        Assert.False(probed);
    }

    [Fact]
    public void OtherComErrors_StillMapToInternalError()
    {
        Assert.Equal(
            ErrorCodes.InternalError,
            JsonRpcServer.ToErrorCode(new COMException("E_FAIL", unchecked((int)0x80004005)), () => true));
    }

    public static IEnumerable<object[]> ExistingMappings() => new[]
    {
        new object[] { new KeyNotFoundException(), ErrorCodes.ElementNotFound },
        new object[] { new ArgumentException("bad"), ErrorCodes.InvalidArgument },
        new object[] { new NotSupportedException(), ErrorCodes.PatternNotSupported },
        new object[] { new InvalidOperationException("Pattern not supported"), ErrorCodes.PatternNotSupported },
        new object[] { new InvalidOperationException("other"), ErrorCodes.InternalError },
        new object[] { new NullReferenceException(), ErrorCodes.InternalError },
    };

    [Theory]
    [MemberData(nameof(ExistingMappings))]
    public void ExistingMappings_AreUnchanged(Exception ex, string expected)
    {
        Assert.Equal(expected, JsonRpcServer.ToErrorCode(ex, () => true));
    }
}
