using System.Text.Json;
using WincoreServer.Commands;
using WincoreServer.State;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// minimizeWindow / restoreWindow confirm the window reached the requested state and
/// re-issue the request when it did not (a restore sent mid-minimize is dropped by the OS).
/// </summary>
public class WindowVisualStateTests
{
    private readonly SessionState _state = new();

    /// <summary>A window that ignores the first <paramref name="dropFirst"/> state requests.</summary>
    private sealed class FakeWindow
    {
        public FakeElement El { get; } = new();
        public List<WindowVisualState> Requests { get; } = new();
        public WindowVisualState Current { get; private set; }

        public FakeWindow(int dropFirst, WindowVisualState initial = WindowVisualState.Normal)
        {
            Current = initial;
            var (window, fake) = UiaFake.Create<IUIAutomationWindowPattern>();
            fake.Members["SetWindowVisualState"] = a =>
            {
                Requests.Add((WindowVisualState)a![0]!);
                if (Requests.Count > dropFirst) Current = (WindowVisualState)a[0]!;
                return null;
            };
            fake.Members["get_CurrentWindowVisualState"] = _ => Current;
            El.Patterns[UIA.WindowPatternId] = window;
        }
    }

    private static readonly JsonElement NoParams = JsonDocument.Parse("{}").RootElement;

    [Fact]
    public void Restore_IssuesOnce_WhenTheStateApplies()
    {
        var w = new FakeWindow(dropFirst: 0);
        PatternCommands.MinimizeWindow(_state, w.El.Element, NoParams);
        PatternCommands.RestoreWindow(_state, w.El.Element, NoParams);

        Assert.Equal([WindowVisualState.Minimized, WindowVisualState.Normal], w.Requests);
        Assert.Equal(WindowVisualState.Normal, w.Current);
    }

    [Fact]
    public void Restore_IsReissued_WhenTheFirstRequestIsDropped()
    {
        var w = new FakeWindow(dropFirst: 1, WindowVisualState.Minimized);
        PatternCommands.RestoreWindow(_state, w.El.Element, NoParams);

        Assert.Equal([WindowVisualState.Normal, WindowVisualState.Normal], w.Requests);
    }

    [Fact]
    public void Minimize_IsReissued_WhenTheFirstRequestIsDropped()
    {
        var w = new FakeWindow(dropFirst: 1);
        PatternCommands.MinimizeWindow(_state, w.El.Element, NoParams);

        Assert.Equal([WindowVisualState.Minimized, WindowVisualState.Minimized], w.Requests);
        Assert.Equal(WindowVisualState.Minimized, w.Current);
    }

    [Fact]
    public void GivesUpAfterTheAttempts_WithoutThrowing()
    {
        var w = new FakeWindow(dropFirst: int.MaxValue);
        PatternCommands.SetVisualState(
            ((IUIAutomationWindowPattern)w.El.Patterns[UIA.WindowPatternId]!),
            WindowVisualState.Minimized, attempts: 3, pollMs: 1, pollsPerAttempt: 2);

        Assert.Equal(3, w.Requests.Count);
    }
}
