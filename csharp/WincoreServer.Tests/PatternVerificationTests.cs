using System.Text.Json;
using WincoreServer.Commands;
using WincoreServer.Protocol;
using WincoreServer.State;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// select / expand / collapse verification rules, driven with scripted fake elements:
/// real patterns on native providers are trusted; actions that go through MSAA are checked
/// once afterwards; an element that is gone (UIA_E_ELEMENTNOTAVAILABLE) counts as done; a
/// timeout is not proof of success; the legacy fallbacks never run on native-UIA elements.
/// </summary>
public class PatternVerificationTests : IDisposable
{
    private const string Native = "[pid:1, Main:Unidentified Provider (managed:MS.Internal.Automation.ElementProxy)]";
    private const int Collapsed = UIA.StateSystemCollapsed;
    private const int Expanded = UIA.StateSystemExpanded;

    private readonly SessionState _state = new();
    private readonly JsonElement _args = JsonDocument.Parse("""{"elementId":"1.2.3"}""").RootElement;
    private readonly TimeSpan _savedBudget = PatternCommands.Deadline.Budget;

    public PatternVerificationTests() => PatternCommands.Deadline.Budget = TimeSpan.FromMilliseconds(150);
    public void Dispose() => PatternCommands.Deadline.Budget = _savedBudget;

    // ── expand / collapse ────────────────────────────────────────────────────────────

    [Fact]
    public void Expand_NativePattern_IsTrusted_EvenIfStateLagsBehind()
    {
        var el = new FakeElement(Native);
        var state = ExpandCollapseState.Collapsed;
        var expandCalls = 0;
        el.AddExpandCollapse(() => state, onExpand: () => expandCalls++); // state never updates
        var legacy = el.AddLegacy();

        PatternCommands.Expand(_state, el.Element, _args);

        Assert.Equal(1, expandCalls);
        Assert.DoesNotContain("DoDefaultAction", legacy.Calls); // no fallback after a trusted pattern
    }

    [Fact]
    public void Expand_AlreadyExpanded_DoesNothing()
    {
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Expanded;
        var legacy = el.AddLegacy();

        PatternCommands.Expand(_state, el.Element, _args);

        Assert.DoesNotContain("DoDefaultAction", legacy.Calls); // a default action would toggle it closed
    }

    [Fact]
    public void Expand_MsaaDefaultAction_ElementGoneAfterwards_CountsAsDone()
    {
        // A grid group row that is re-created on expand (DevExpress) or a popup that closes.
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Collapsed;
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Expand";
        el.AddLegacy(onDefaultAction: () =>
        {
            el.Properties[UIA.LegacyIAccessibleStatePropertyId] = null; // gone: no state any more
            el.ProcessIdThrows = FakeElement.ElementNotAvailable();
        });

        PatternCommands.Expand(_state, el.Element, _args); // must not throw
    }

    [Fact]
    public void Expand_MsaaDefaultAction_StateReached_Succeeds()
    {
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Collapsed;
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Expand";
        el.AddLegacy(onDefaultAction: () => el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Expanded);

        PatternCommands.Expand(_state, el.Element, _args);
    }

    [Fact]
    public void Expand_MsaaDefaultAction_NoChange_ThrowsInvalidElementState()
    {
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Collapsed;
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Expand";
        el.AddLegacy(); // stuck: the default action does nothing

        Assert.Throws<InvalidElementStateException>(() => PatternCommands.Expand(_state, el.Element, _args));
    }

    [Fact]
    public void Expand_MsaaTimeoutAfterAction_IsNotReadAsGone()
    {
        // UIA_E_TIMEOUT from a hung provider proves nothing; it must not count as success.
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = Collapsed;
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Expand";
        el.AddLegacy(onDefaultAction: () =>
        {
            el.Properties[UIA.LegacyIAccessibleStatePropertyId] = null;
            el.ProcessIdThrows = new TimeoutException("UIA_E_TIMEOUT");
        });

        Assert.Throws<InvalidElementStateException>(() => PatternCommands.Expand(_state, el.Element, _args));
    }

    [Fact]
    public void Collapse_NativeElementWithDefaultAction_IsNotSupported_AndNeverClicks()
    {
        // A WPF Button: no ExpandCollapsePattern, but UIA core synthesises a "Press" default action.
        var el = new FakeElement(Native);
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Press";
        var legacy = el.AddLegacy();

        var ex = Assert.Throws<InvalidOperationException>(() => PatternCommands.Collapse(_state, el.Element, _args));
        Assert.Contains("ExpandCollapsePattern", ex.Message);
        Assert.Empty(legacy.Calls);
    }

    [Fact]
    public void Expand_MsaaNoPatternNoStateNoDefaultAction_IsNotSupported()
    {
        // The customer combo box: the client's ALT+Down fallback needs "not supported".
        var el = new FakeElement();
        var legacy = el.AddLegacy();

        Assert.Throws<InvalidOperationException>(() => PatternCommands.Expand(_state, el.Element, _args));
        Assert.DoesNotContain("DoDefaultAction", legacy.Calls);
    }

    [Fact]
    public void Expand_MsaaNoState_WithDefaultAction_ActsUnverified()
    {
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleDefaultActionPropertyId] = "Toggle";
        var legacy = el.AddLegacy();

        PatternCommands.Expand(_state, el.Element, _args);

        Assert.Contains("DoDefaultAction", legacy.Calls);
    }

    [Fact]
    public void Expand_PatternLeafNode_ThrowsInvalidElementState()
    {
        var el = new FakeElement(Native);
        el.AddExpandCollapse(() => ExpandCollapseState.LeafNode);

        Assert.Throws<InvalidElementStateException>(() => PatternCommands.Expand(_state, el.Element, _args));
    }

    // ── select ───────────────────────────────────────────────────────────────────────

    [Fact]
    public void Select_NativePattern_IsTrusted()
    {
        var el = new FakeElement(Native);
        var selected = false;
        el.AddSelectionItem(() => selected, onSelect: () => { }); // never reports selected

        PatternCommands.Select(_state, el.Element, _args);
    }

    [Fact]
    public void Select_NativeWithoutSelectionItem_IsNotSupported_AndNeverMovesFocus()
    {
        var el = new FakeElement(Native);
        var legacy = el.AddLegacy();

        var ex = Assert.Throws<InvalidOperationException>(() => PatternCommands.Select(_state, el.Element, _args));
        Assert.Contains("SelectionItemPattern", ex.Message);
        Assert.Empty(legacy.Calls); // no LegacyIAccessible.Select(TAKEFOCUS|TAKESELECTION)
    }

    [Fact]
    public void Select_MsaaWithoutSelectionItem_UsesLegacySelect()
    {
        // DataGridView cell: no SelectionItemPattern, selectable through MSAA.
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = 0x300040;
        el.AddLegacy(onSelect: flags =>
        {
            Assert.Equal(UIA.SelFlagTakeFocus | UIA.SelFlagTakeSelection, flags);
            el.Properties[UIA.LegacyIAccessibleStatePropertyId] = 0x300046;
        });

        PatternCommands.Select(_state, el.Element, _args);
    }

    [Fact]
    public void Select_MsaaPatternNoEffect_FallsBackToLegacy_ThenThrows()
    {
        // MSAA-proxied group: SelectionItemPattern exists but Select() changes nothing.
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = 0x100000;
        el.AddSelectionItem(() => false);
        var legacy = el.AddLegacy();

        Assert.Throws<InvalidElementStateException>(() => PatternCommands.Select(_state, el.Element, _args));
        Assert.Contains("Select", legacy.Calls);
    }

    [Fact]
    public void Select_MsaaItemGoneAfterSelect_CountsAsSelected()
    {
        // A dropdown item whose popup closes on selection.
        var el = new FakeElement();
        el.AddSelectionItem(() => false, onSelect: () => el.ProcessIdThrows = FakeElement.ElementNotAvailable());

        PatternCommands.Select(_state, el.Element, _args);
    }

    [Fact]
    public void Verification_SharesOneBudgetAcrossFallbacks()
    {
        PatternCommands.Deadline.Budget = TimeSpan.FromMilliseconds(300);
        var el = new FakeElement();
        el.Properties[UIA.LegacyIAccessibleStatePropertyId] = 0x100000;
        el.AddSelectionItem(() => false);
        el.AddLegacy();

        var sw = System.Diagnostics.Stopwatch.StartNew();
        Assert.Throws<InvalidElementStateException>(() => PatternCommands.Select(_state, el.Element, _args));
        Assert.True(sw.ElapsedMilliseconds < 550, $"two verifications should share one 300 ms budget, took {sw.ElapsedMilliseconds} ms");
    }
}
