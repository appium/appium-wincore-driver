using System.Runtime.InteropServices;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// UiaErrors.IsExpected is the filter on every tolerant UIA catch added for standard
/// accessibility values / verified actions: UIA interop failures are swallowed, real bugs are not.
/// </summary>
public class UiaErrorsTests
{
    public static IEnumerable<object[]> Expected() => new[]
    {
        new object[] { new COMException("UIA_E_ELEMENTNOTAVAILABLE", unchecked((int)0x80040201)) },
        new object[] { new ArgumentException("E_INVALIDARG: property not cached") },
        new object[] { new UnauthorizedAccessException("E_ACCESSDENIED") },
        new object[] { new InvalidOperationException("UIA_E_INVALIDOPERATION") },
        new object[] { new TimeoutException("UIA_E_TIMEOUT") },
        new object[] { new NotImplementedException("E_NOTIMPL") },
        new object[] { new NotSupportedException() },
        new object[] { new InvalidCastException() },
    };

    public static IEnumerable<object[]> Unexpected() => new[]
    {
        new object[] { new NullReferenceException() },
        new object[] { new IndexOutOfRangeException() },
        new object[] { new OutOfMemoryException() },
        new object[] { new KeyNotFoundException() },
    };

    [Theory]
    [MemberData(nameof(Expected))]
    public void IsExpected_ForUiaInteropFailures(Exception ex) => Assert.True(UiaErrors.IsExpected(ex));

    [Theory]
    [MemberData(nameof(Unexpected))]
    public void IsNotExpected_ForBugs(Exception ex) => Assert.False(UiaErrors.IsExpected(ex));

    [Fact]
    public void ArgumentNullException_IsABug_NotAnInteropFailure()
        // Interop never raises it; a null passed by our own code must surface.
        => Assert.False(UiaErrors.IsExpected(new ArgumentNullException("x")));

    [Fact]
    public void OtherArgumentExceptionSubclasses_StayExpected()
        => Assert.True(UiaErrors.IsExpected(new ArgumentOutOfRangeException("x")));
}
