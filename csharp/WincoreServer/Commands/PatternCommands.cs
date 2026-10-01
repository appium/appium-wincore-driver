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
    /// Expand / collapse that does not toggle the wrong way and does not report a no-op as
    /// success. The rules:
    /// <list type="bullet">
    /// <item>Read the state first and do nothing when the element is already there (MSAA
    /// default actions toggle, so expanding an expanded group used to collapse it).</item>
    /// <item>Trust a real ExpandCollapsePattern: if Expand() / Collapse() returns without
    /// throwing, that is success. Its contract is to throw when it cannot act.</item>
    /// <item>Verify only actions that go through MSAA (the MSAA Proxy's synthesised pattern,
    /// or LegacyIAccessible.DoDefaultAction): MSAA reports success whether or not anything
    /// happened. One check afterwards; an element that is gone counts as done.</item>
    /// <item>The default-action fallback is MSAA-only. UIA core synthesises a default action
    /// for native-UIA elements too (e.g. "Press" on a WPF Button), and collapse must not
    /// click it.</item>
    /// </list>
    /// </summary>
    private static object? SetExpanded(IUIAutomationElement element, JsonElement parameters, bool expand)
    {
        var verb = expand ? "expand" : "collapse";
        var pattern = TryPattern<IUIAutomationExpandCollapsePattern>(element, UIA.ExpandCollapsePatternId);
        var msaa = IsMsaaBacked(element);
        var legacy = msaa ? TryPattern<IUIAutomationLegacyIAccessiblePattern>(element, UIA.LegacyIAccessiblePatternId) : null;
        if (pattern == null && legacy == null)
        {
            throw new InvalidOperationException("Element does not support ExpandCollapsePattern.");
        }

        var before = ReadExpandState(element);
        if (before == ExpandCollapseState.LeafNode)
        {
            throw new InvalidElementStateException($"{verb} had no effect: element is a leaf node.");
        }
        if (before != null && IsExpanded(before.Value) == expand)
        {
            return null; // already there - acting would toggle a default-action control back
        }

        var deadline = new Deadline();
        if (pattern != null)
        {
            if (expand) pattern.Expand(); else pattern.Collapse();
            if (!msaa || Reached(element, expand, deadline)) return null;
            throw NoEffect(verb, element);
        }

        // MSAA element without the pattern: the default action is the only lever.
        // No state and no default action (e.g. a legacy combo box that only opens from the
        // keyboard): nothing the server can do or verify. Report "not supported" so the
        // client's ALT+Down fallback runs - an empty default action would open nothing.
        if (before == null && !HasDefaultAction(element))
        {
            throw new InvalidOperationException("Element does not support ExpandCollapsePattern.");
        }

        legacy!.DoDefaultAction();
        if (before == null)
        {
            // The element reports no state (never sets EXPANDED/COLLAPSED). Nothing to
            // verify against; keep the historical act-and-log behaviour.
            var elementId = parameters.GetProperty("elementId").GetString();
            Console.Error.WriteLine(
                $"[{verb}] DoDefaultAction fired on '{elementId}', which reports no expand state " +
                "(not verifiable - not treated as a failure).");
            Thread.Sleep(50);
            return null;
        }
        if (Reached(element, expand, deadline)) return null;
        throw NoEffect(verb, element);
    }

    private static InvalidElementStateException NoEffect(string verb, IUIAutomationElement element)
        => new($"{verb} had no effect on this element (state stayed {ReadExpandState(element)?.ToString() ?? "unknown"}).");

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
            try { return pattern.CurrentExpandCollapseState; }
            catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return null; }
        }
        if (ReadLegacyState(element) is int state)
        {
            if ((state & UIA.StateSystemExpanded) != 0) return ExpandCollapseState.Expanded;
            if ((state & UIA.StateSystemCollapsed) != 0) return ExpandCollapseState.Collapsed;
        }
        return null;
    }

    /// <summary>
    /// True when UIA serves the element through the MSAA Proxy - DevExpress, the .NET
    /// Framework DataGridView, VB6 / Delphi / MFC controls, WinForms custom accessible
    /// objects. Their patterns and default actions map to MSAA calls that report success
    /// whether or not anything happened, so actions on them are verified afterwards.
    /// Native providers (WPF, UWP, UIA's own Win32 proxies) are trusted.
    /// </summary>
    internal static bool IsMsaaBacked(IUIAutomationElement element)
    {
        try
        {
            return element.GetCurrentPropertyValue(UIA.ProviderDescriptionPropertyId) is string d
                   && d.Contains("MSAA Proxy", StringComparison.Ordinal);
        }
        catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return false; }
    }

    private static bool HasDefaultAction(IUIAutomationElement element)
    {
        try
        {
            return element.GetCurrentPropertyValue(UIA.LegacyIAccessibleDefaultActionPropertyId) is string s
                   && !string.IsNullOrWhiteSpace(s);
        }
        catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return false; }
    }

    private static bool IsExpanded(ExpandCollapseState s)
        => s is ExpandCollapseState.Expanded or ExpandCollapseState.PartiallyExpanded;

    // True once the element reaches the requested state. An element that is gone after the
    // action (a popup that closed, a row re-created on expand) counts as done: the action ran
    // and there is nothing left to verify. "Gone" means UIA_E_ELEMENTNOTAVAILABLE only - a
    // timeout or access error is not proof of success.
    private static bool Reached(IUIAutomationElement element, bool expand, Deadline deadline)
        => deadline.Until(() =>
            ReadExpandState(element) is { } s ? IsExpanded(s) == expand : UiaErrors.IsGone(element));

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
        catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return null; }
    }

    private static T? TryPattern<T>(IUIAutomationElement element, int patternId) where T : class
    {
        try { return element.GetCurrentPattern(patternId) as T; } catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return null; }
    }

    /// <summary>
    /// One verification budget per command. Providers update state asynchronously after an
    /// action, so a check polls briefly; a command that verifies twice (select: pattern, then
    /// legacy fallback) shares the budget instead of paying it twice.
    /// </summary>
    internal sealed class Deadline
    {
        internal static TimeSpan Budget = TimeSpan.FromMilliseconds(600);
        private readonly System.Diagnostics.Stopwatch _sw = System.Diagnostics.Stopwatch.StartNew();

        public bool Until(Func<bool> condition)
        {
            while (true)
            {
                if (condition()) return true;
                if (_sw.Elapsed >= Budget) return false;
                Thread.Sleep(50);
            }
        }
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
    /// Select. A real SelectionItemPattern is trusted when Select() does not throw. MSAA-backed
    /// elements are verified: the MSAA Proxy hands SelectionItemPattern to rows and outline
    /// items whether or not they are selectable (Select() succeeds and changes nothing), and
    /// DataGridView cells have no SelectionItemPattern yet select fine through
    /// LegacyIAccessible.Select. The legacy fallback is MSAA-only - UIA core synthesises
    /// LegacyIAccessible on native elements too, and selecting a Button must stay "not
    /// supported", not move focus.
    /// </summary>
    public static object? Select(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var selection = TryPattern<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId);
        var msaa = IsMsaaBacked(element);
        var legacy = msaa ? TryPattern<IUIAutomationLegacyIAccessiblePattern>(element, UIA.LegacyIAccessiblePatternId) : null;
        if (selection == null && legacy == null)
        {
            throw new InvalidOperationException("Element does not support SelectionItemPattern.");
        }

        var deadline = new Deadline();
        if (selection != null)
        {
            selection.Select();
            if (!msaa || deadline.Until(() => IsSelectedOrGone(element))) return null;
        }

        if (legacy != null)
        {
            legacy.Select(UIA.SelFlagTakeFocus | UIA.SelFlagTakeSelection);
            if (deadline.Until(() => IsSelectedOrGone(element))) return null;
        }

        throw new InvalidElementStateException("select had no effect on this element.");
    }

    // Selected per SelectionItem.IsSelected or the MSAA SELECTED bit. An element that is
    // gone after the action (a dropdown item whose popup closed on selection) counts as
    // selected - gone meaning UIA_E_ELEMENTNOTAVAILABLE, not any error.
    private static bool IsSelectedOrGone(IUIAutomationElement element)
    {
        if (TryPattern<IUIAutomationSelectionItemPattern>(element, UIA.SelectionItemPatternId) is { } p)
        {
            try
            {
                if (p.CurrentIsSelected != 0) return true;
            }
            catch (Exception ex) when (UiaErrors.IsExpected(ex)) { }
        }
        if (ReadLegacyState(element) is int state && (state & UIA.StateSystemSelected) != 0) return true;
        return UiaErrors.IsGone(element);
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
