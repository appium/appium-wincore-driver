using System.Text.Json;
using WincoreServer.Protocol;
using WincoreServer.State;
using WincoreServer.Uia3;

namespace WincoreServer.Commands;

/// <summary>
/// UIA side of the pattern commands. Element ids are resolved (and tree-provider
/// elements routed away) by <see cref="Server.ElementRoute"/> before these run.
/// </summary>
public static class PatternCommands
{
    public static object? Invoke(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        if (element.GetCurrentPattern(UIA.InvokePatternId) is IUIAutomationInvokePattern invoke)
        {
            invoke.Invoke();
        }
        else if (element.GetCurrentPattern(UIA.SelectionItemPatternId) is IUIAutomationSelectionItemPattern sel)
        {
            sel.Select();
        }
        else if (element.GetCurrentPattern(UIA.LegacyIAccessiblePatternId) is IUIAutomationLegacyIAccessiblePattern legacy)
        {
            legacy.DoDefaultAction();
        }
        else
        {
            throw new InvalidOperationException(
                "Element does not support InvokePattern, SelectionItemPattern, or LegacyIAccessiblePattern.");
        }

        // Yield to let the target app's message pump process the event before
        // the next command touches it. Keeps rapid back-to-back invokes from
        // racing the app's UI thread (e.g. calculator button mashing).
        Thread.Sleep(50);
        return null;
    }

    public static object? Expand(SessionState state, IUIAutomationElement element, JsonElement parameters)
        => SetExpanded(element, parameters, expand: true);

    public static object? Collapse(SessionState state, IUIAutomationElement element, JsonElement parameters)
        => SetExpanded(element, parameters, expand: false);

    /// <summary>
    /// Verified expand / collapse. MSAA-only elements (DevExpress group rows, legacy
    /// tree grids) have no ExpandCollapsePattern — their default action toggles and their
    /// state lives in LegacyIAccessible.State — so a blind call can toggle the wrong way
    /// or do nothing while reporting success. Read the state first, act only when needed,
    /// and fail with InvalidElementState when a reported state does not change.
    /// </summary>
    private static object? SetExpanded(IUIAutomationElement element, JsonElement parameters, bool expand)
    {
        var verb = expand ? "expand" : "collapse";
        var pattern = TryPattern<IUIAutomationExpandCollapsePattern>(element, UIA.ExpandCollapsePatternId);
        var legacy = TryPattern<IUIAutomationLegacyIAccessiblePattern>(element, UIA.LegacyIAccessiblePatternId);
        if (pattern == null && legacy == null)
        {
            throw new InvalidOperationException("Element does not support ExpandCollapsePattern.");
        }

        var before = ReadExpandState(element);

        // No pattern, no state and no default action (e.g. a legacy combo box that only
        // opens from the keyboard): there is nothing the server can do or verify. Report
        // "not supported" so the client's ALT+Down fallback runs — running an empty default
        // action and returning success would skip that fallback and open nothing.
        if (pattern == null && before == null && !HasDefaultAction(element))
        {
            throw new InvalidOperationException("Element does not support ExpandCollapsePattern.");
        }

        if (before == ExpandCollapseState.LeafNode)
        {
            throw new InvalidElementStateException($"{verb} had no effect: element is a leaf node.");
        }
        if (before != null && IsExpanded(before.Value) == expand)
        {
            return null; // already there — acting would toggle a default-action control back
        }

        if (pattern != null)
        {
            if (expand) pattern.Expand(); else pattern.Collapse();
            if (Reached(element, expand)) return null;
        }

        // No pattern, or the pattern call left the state unchanged: one default action.
        if (legacy != null && (pattern == null || ReadExpandStateOrNull(element) is { } s && IsExpanded(s) != expand))
        {
            legacy.DoDefaultAction();
            if (before == null)
            {
                // The element reports no state (never sets EXPANDED/COLLAPSED). Nothing to
                // verify against; keep the historical act-and-log behaviour.
                var elementId = parameters.GetProperty("elementId").GetString();
                Console.Error.WriteLine(
                    $"[{verb}] DoDefaultAction fired on '{elementId}', which reports no expand state " +
                    "(not verifiable — not treated as a failure).");
                Thread.Sleep(50);
                return null;
            }
            if (Reached(element, expand)) return null;
        }

        throw new InvalidElementStateException(
            $"{verb} had no effect on this element (state stayed {ReadExpandStateOrNull(element)?.ToString() ?? "unknown"}).");
    }

    /// <summary>
    /// Expand state from the pattern when the element has it, else from the MSAA
    /// EXPANDED / COLLAPSED bits; null when the element reports neither. Never reads the
    /// raw ExpandCollapseState property: without the pattern UIA returns its default
    /// (LeafNode) for every element.
    /// </summary>
    internal static ExpandCollapseState? ReadExpandState(IUIAutomationElement element)
    {
        if (TryPattern<IUIAutomationExpandCollapsePattern>(element, UIA.ExpandCollapsePatternId) is { } pattern)
        {
            return pattern.CurrentExpandCollapseState;
        }
        if (ReadLegacyState(element) is int state)
        {
            if ((state & UIA.StateSystemExpanded) != 0) return ExpandCollapseState.Expanded;
            if ((state & UIA.StateSystemCollapsed) != 0) return ExpandCollapseState.Collapsed;
        }
        return null;
    }

    private static bool HasDefaultAction(IUIAutomationElement element)
    {
        try
        {
            return element.GetCurrentPropertyValue(UIA.LegacyIAccessibleDefaultActionPropertyId) is string s
                   && !string.IsNullOrWhiteSpace(s);
        }
        catch { return false; }
    }

    private static ExpandCollapseState? ReadExpandStateOrNull(IUIAutomationElement element)
    {
        try { return ReadExpandState(element); } catch { return null; }
    }

    private static bool IsExpanded(ExpandCollapseState s)
        => s is ExpandCollapseState.Expanded or ExpandCollapseState.PartiallyExpanded;

    // True once the element reaches the requested state. An element that vanished after
    // the action (a popup that closed, a row that re-rendered) counts as done: the action
    // ran and there is nothing left to verify.
    private static bool Reached(IUIAutomationElement element, bool expand)
        => SettleUntil(() =>
        {
            try { return ReadExpandState(element) is { } s && IsExpanded(s) == expand; }
            catch { return true; }
        });

    private static int? ReadLegacyState(IUIAutomationElement element)
    {
        try
        {
            return element.GetCurrentPropertyValue(UIA.LegacyIAccessibleStatePropertyId) switch
            {
                int i => i,
                uint u => unchecked((int)u),
                _ => null, // not-supported sentinel
            };
        }
        catch { return null; }
    }

    private static T? TryPattern<T>(IUIAutomationElement element, int patternId) where T : class
    {
        try { return element.GetCurrentPattern(patternId) as T; } catch { return null; }
    }

    // Providers update state asynchronously after an action; poll briefly.
    private static bool SettleUntil(Func<bool> condition)
    {
        for (var i = 0; i < 10; i++)
        {
            if (condition()) return true;
            Thread.Sleep(50);
        }
        return condition();
    }

    public static object? Toggle(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationTogglePattern>(element, UIA.TogglePatternId, "TogglePattern").Toggle();
        return null;
    }

    public static object? GetToggleState(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        return Require<IUIAutomationTogglePattern>(element, UIA.TogglePatternId, "TogglePattern")
            .CurrentToggleState.ToString();
    }

    public static object? SetRangeValue(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var value = parameters.GetProperty("value").GetDouble();
        Require<IUIAutomationRangeValuePattern>(element, UIA.RangeValuePatternId, "RangeValuePattern").SetValue(value);
        return null;
    }

    public static object? ScrollIntoView(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationScrollItemPattern>(element, UIA.ScrollItemPatternId, "ScrollItemPattern").ScrollIntoView();
        return null;
    }

    /// <summary>
    /// Verified select. The MSAA Proxy hands SelectionItemPattern to rows and outline
    /// items whether or not they are selectable, so Select() can succeed and change
    /// nothing; conversely DataGridView cells have no SelectionItemPattern yet select fine
    /// through LegacyIAccessible.Select. Try both, then require the element to report
    /// itself selected.
    /// </summary>
    public static object? Select(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var selection = TryPattern<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId);
        var legacy = TryPattern<IUIAutomationLegacyIAccessiblePattern>(element, UIA.LegacyIAccessiblePatternId);
        if (selection == null && legacy == null)
        {
            throw new InvalidOperationException("Element does not support SelectionItemPattern.");
        }

        if (selection != null)
        {
            selection.Select();
            if (SettleUntil(() => IsSelectedOrGone(element))) return null;
        }

        if (legacy != null)
        {
            legacy.Select(UIA.SelFlagTakeFocus | UIA.SelFlagTakeSelection);
            if (SettleUntil(() => IsSelectedOrGone(element))) return null;
        }

        throw new InvalidElementStateException("select had no effect on this element.");
    }

    // Selected per SelectionItem.IsSelected or the MSAA SELECTED bit. An element that is
    // gone after the action (a dropdown item whose popup closed on selection) counts as
    // selected: the action ran and there is nothing left to verify.
    private static bool IsSelectedOrGone(IUIAutomationElement element)
    {
        try
        {
            if (TryPattern<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId) is { } p
                && p.CurrentIsSelected != 0)
            {
                return true;
            }
            _ = element.CurrentProcessId; // throws once the element is gone
            return ReadLegacyState(element) is int state && (state & UIA.StateSystemSelected) != 0;
        }
        catch
        {
            return true;
        }
    }

    public static object? AddToSelection(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId, "SelectionItemPattern").AddToSelection();
        return null;
    }

    public static object? RemoveFromSelection(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId, "SelectionItemPattern").RemoveFromSelection();
        return null;
    }

    public static object? IsSelected(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        return Require<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId, "SelectionItemPattern")
            .CurrentIsSelected != 0;
    }

    public static object? IsMultipleSelect(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        return Require<IUIAutomationSelectionPattern>(element, UIA.SelectionPatternId, "SelectionPattern")
            .CurrentCanSelectMultiple != 0;
    }

    public static object? GetSelectedElements(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var selected = Require<IUIAutomationSelectionPattern>(element, UIA.SelectionPatternId, "SelectionPattern")
            .GetCurrentSelection();
        return FindCommands.IterateArray(selected)
            .Select(el => state.SaveElementAndReturnId(el))
            .ToArray();
    }

    public static object? MaximizeWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationWindowPattern>(element, UIA.WindowPatternId, "WindowPattern")
            .SetWindowVisualState(WindowVisualState.Maximized);
        return null;
    }

    public static object? MinimizeWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationWindowPattern>(element, UIA.WindowPatternId, "WindowPattern")
            .SetWindowVisualState(WindowVisualState.Minimized);
        return null;
    }

    public static object? RestoreWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationWindowPattern>(element, UIA.WindowPatternId, "WindowPattern")
            .SetWindowVisualState(WindowVisualState.Normal);
        return null;
    }

    public static object? CloseWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        Require<IUIAutomationWindowPattern>(element, UIA.WindowPatternId, "WindowPattern").Close();
        return null;
    }

    public static object? MoveWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var x = parameters.GetProperty("x").GetDouble();
        var y = parameters.GetProperty("y").GetDouble();
        Require<IUIAutomationTransformPattern>(element, UIA.TransformPatternId, "TransformPattern").Move(x, y);
        return null;
    }

    public static object? ResizeWindow(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var width = parameters.GetProperty("width").GetDouble();
        var height = parameters.GetProperty("height").GetDouble();
        Require<IUIAutomationTransformPattern>(element, UIA.TransformPatternId, "TransformPattern").Resize(width, height);
        return null;
    }

    private static T Require<T>(IUIAutomationElement element, int patternId, string patternName) where T : class
    {
        if (element.GetCurrentPattern(patternId) is T pattern)
        {
            return pattern;
        }
        throw new InvalidOperationException($"Element does not support {patternName}.");
    }
}
