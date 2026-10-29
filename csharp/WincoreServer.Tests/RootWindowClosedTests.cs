using System.Runtime.InteropServices;
using WincoreServer.Commands;
using WincoreServer.Protocol;
using WincoreServer.State;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// When the window a session is attached to is closed, UIA may keep answering the cached
/// root element with empty values instead of failing, so getTitle returned "" and page
/// source a bogus document. The session detects the destroyed HWND and reports
/// "no such window" instead.
/// </summary>
public class RootWindowClosedTests
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetDesktopWindow();

    // Not a window handle: HWNDs are never odd values in this range.
    private static readonly IntPtr DestroyedHandle = new(0x7FFF_FFF1);

    private static SessionState StateRootedAt(IntPtr hwnd)
    {
        var root = new FakeElement();
        root.Fake.Members["get_CurrentNativeWindowHandle"] = _ => hwnd;
        var state = new SessionState();
        state.SetRoot(root.Element);
        return state;
    }

    [Fact]
    public void DesktopRoot_WithoutHandle_IsNeverClosed()
    {
        var state = new SessionState();
        state.SetRoot(null);
        Assert.False(state.IsRootWindowClosed());
    }

    [Fact]
    public void LiveWindow_IsNotClosed()
    {
        var state = StateRootedAt(GetDesktopWindow());
        Assert.False(state.IsRootWindowClosed());
        state.ThrowIfRootWindowClosed();
    }

    [Fact]
    public void DestroyedWindow_IsClosed_AndThrowsNoSuchWindow()
    {
        var state = StateRootedAt(DestroyedHandle);
        Assert.True(state.IsRootWindowClosed());
        Assert.Throws<NoSuchWindowException>(() => state.ThrowIfRootWindowClosed());
    }

    [Fact]
    public void SaveRootElementToTable_ThrowsNoSuchWindow_WhenTheWindowWasClosed()
    {
        var state = StateRootedAt(DestroyedHandle);
        Assert.Throws<NoSuchWindowException>(() => FindCommands.SaveRootElementToTable(state, null));
    }

    [Fact]
    public void GetPageSource_ThrowsNoSuchWindow_WhenTheWindowWasClosed()
    {
        var state = StateRootedAt(DestroyedHandle);
        Assert.Throws<NoSuchWindowException>(() => PageSourceCommands.GetPageSource(state, null));
    }
}
