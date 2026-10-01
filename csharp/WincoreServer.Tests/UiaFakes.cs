using System.Reflection;
using System.Runtime.InteropServices;
using WincoreServer.Uia3;

namespace WincoreServer.Tests;

/// <summary>
/// Scriptable stand-ins for the UIA3 COM interfaces, built with <see cref="DispatchProxy"/>
/// so tests drive the real command code without a live UI. Each fake answers by member
/// name; anything unscripted throws, so a test sees every call it did not plan for.
/// </summary>
internal class UiaFake : DispatchProxy
{
    public Dictionary<string, Func<object?[]?, object?>> Members { get; } = new();
    public List<string> Calls { get; } = new();

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        var name = targetMethod!.Name;
        Calls.Add(name);
        if (Members.TryGetValue(name, out var member)) return member(args);
        throw new NotImplementedException($"Fake: unscripted call {targetMethod.DeclaringType?.Name}.{name}");
    }

    public static (T Proxy, UiaFake Fake) Create<T>() where T : class
    {
        var proxy = DispatchProxy.Create<T, UiaFake>();
        return (proxy, (UiaFake)(object)proxy);
    }
}

/// <summary>A fake IUIAutomationElement with typical defaults; tests override what they need.</summary>
internal sealed class FakeElement
{
    public IUIAutomationElement Element { get; }
    public UiaFake Fake { get; }
    public Dictionary<int, object?> Properties { get; } = new();
    public Dictionary<int, object?> Patterns { get; } = new();

    /// <summary>Thrown by CurrentProcessId (the liveness probe) when set.</summary>
    public Exception? ProcessIdThrows { get; set; }

    public FakeElement(string providerDescription = "[pid:1, Main:Microsoft: MSAA Proxy (unmanaged:uiautomationcore.dll)]")
    {
        (Element, Fake) = UiaFake.Create<IUIAutomationElement>();
        Properties[UIA.ProviderDescriptionPropertyId] = providerDescription;
        Fake.Members["GetCurrentPropertyValue"] = a => Properties.TryGetValue((int)a![0]!, out var v) ? v : null;
        Fake.Members["GetCachedPropertyValue"] = a => Properties.TryGetValue((int)a![0]!, out var v)
            ? v
            : throw new ArgumentException("E_INVALIDARG: property not cached");
        Fake.Members["GetCurrentPattern"] = a => Patterns.TryGetValue((int)a![0]!, out var p) ? p : null;
        Fake.Members["GetCachedPattern"] = _ => throw new ArgumentException("E_INVALIDARG: pattern not cached");
        Fake.Members["get_CurrentProcessId"] = _ => ProcessIdThrows != null ? throw ProcessIdThrows : 1234;
    }

    public static COMException ElementNotAvailable() => new("UIA_E_ELEMENTNOTAVAILABLE", UiaErrors.ElementNotAvailable);

    /// <summary>A LegacyIAccessible pattern whose State is <see cref="UIA.LegacyIAccessibleStatePropertyId"/>.</summary>
    public UiaFake AddLegacy(Action? onDefaultAction = null, Action<int>? onSelect = null)
    {
        var (legacy, fake) = UiaFake.Create<IUIAutomationLegacyIAccessiblePattern>();
        fake.Members["DoDefaultAction"] = _ => { onDefaultAction?.Invoke(); return null; };
        fake.Members["Select"] = a => { onSelect?.Invoke((int)a![0]!); return null; };
        Patterns[UIA.LegacyIAccessiblePatternId] = legacy;
        return fake;
    }

    public UiaFake AddExpandCollapse(Func<ExpandCollapseState> state, Action? onExpand = null, Action? onCollapse = null)
    {
        var (pattern, fake) = UiaFake.Create<IUIAutomationExpandCollapsePattern>();
        fake.Members["Expand"] = _ => { onExpand?.Invoke(); return null; };
        fake.Members["Collapse"] = _ => { onCollapse?.Invoke(); return null; };
        fake.Members["get_CurrentExpandCollapseState"] = _ => state();
        Patterns[UIA.ExpandCollapsePatternId] = pattern;
        return fake;
    }

    public UiaFake AddSelectionItem(Func<bool> isSelected, Action? onSelect = null)
    {
        var (pattern, fake) = UiaFake.Create<IUIAutomationSelectionItemPattern>();
        fake.Members["Select"] = _ => { onSelect?.Invoke(); return null; };
        fake.Members["get_CurrentIsSelected"] = _ => isSelected() ? 1 : 0;
        Patterns[UIA.SelectionItemPatternId] = pattern;
        return fake;
    }
}
