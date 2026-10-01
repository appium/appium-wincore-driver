using System.Reflection;
using System.Runtime.InteropServices;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// Guards the hand-written UIA3 interop in Uia3/UIA.cs against the Windows SDK header.
/// A wrong IID makes every <c>is IUIAutomationXPattern</c> check silently false (the
/// Invoke and RangeValue patterns were never dispatched); a wrong member order makes
/// calls land on another vtable slot (LegacyIAccessible get_CurrentName returned the
/// Value). Neither fails loudly at runtime, so check them statically.
///
/// Expected data is generated from UIAutomationClient.h, Windows SDK 10.0.26100 —
/// interface IIDs and the vtable order (STDMETHODCALLTYPE entries, IUnknown excluded).
/// </summary>
public class UiaInteropTests
{
    private static readonly Dictionary<string, (string Iid, string[] Vtable)> Header = new()
    {
        ["IUIAutomationCondition"] = ("352ffba8-0973-437c-a61f-f64cafd81df9", new string[] {  }),
        ["IUIAutomationBoolCondition"] = ("1b4e1f2e-75eb-4d0b-8952-5a69988e2307", new string[] { "get_BooleanValue" }),
        ["IUIAutomationPropertyCondition"] = ("99ebf2cb-5578-4267-9ad4-afd6ea77e94b", new string[] { "get_PropertyId", "get_PropertyValue", "get_PropertyConditionFlags" }),
        ["IUIAutomationAndCondition"] = ("a7d0af36-b912-45fe-9855-091ddc174aec", new string[] { "get_ChildCount", "GetChildrenAsNativeArray", "GetChildren" }),
        ["IUIAutomationOrCondition"] = ("8753f032-3db1-47b5-a1fc-6e34a266c712", new string[] { "get_ChildCount", "GetChildrenAsNativeArray", "GetChildren" }),
        ["IUIAutomationNotCondition"] = ("f528b657-847b-498c-8896-d52b565407a1", new string[] { "GetChild" }),
        ["IUIAutomationCacheRequest"] = ("b32a92b5-bc25-4078-9c08-d7ee95c48e03", new string[] { "AddProperty", "AddPattern", "Clone", "get_TreeScope", "put_TreeScope", "get_TreeFilter", "put_TreeFilter", "get_AutomationElementMode", "put_AutomationElementMode" }),
        ["IUIAutomationElementArray"] = ("14314595-b4bc-4055-95f2-58f2e42c9855", new string[] { "get_Length", "GetElement" }),
        ["IUIAutomationElement"] = ("d22108aa-8ac5-49a5-837b-37bbb3d7591e", new string[] { "SetFocus", "GetRuntimeId", "FindFirst", "FindAll", "FindFirstBuildCache", "FindAllBuildCache", "BuildUpdatedCache", "GetCurrentPropertyValue", "GetCurrentPropertyValueEx", "GetCachedPropertyValue", "GetCachedPropertyValueEx", "GetCurrentPatternAs", "GetCachedPatternAs", "GetCurrentPattern", "GetCachedPattern", "GetCachedParent", "GetCachedChildren", "get_CurrentProcessId", "get_CurrentControlType", "get_CurrentLocalizedControlType", "get_CurrentName", "get_CurrentAcceleratorKey", "get_CurrentAccessKey", "get_CurrentHasKeyboardFocus", "get_CurrentIsKeyboardFocusable", "get_CurrentIsEnabled", "get_CurrentAutomationId", "get_CurrentClassName", "get_CurrentHelpText", "get_CurrentCulture", "get_CurrentIsControlElement", "get_CurrentIsContentElement", "get_CurrentIsPassword", "get_CurrentNativeWindowHandle", "get_CurrentItemType", "get_CurrentIsOffscreen", "get_CurrentOrientation", "get_CurrentFrameworkId", "get_CurrentIsRequiredForForm", "get_CurrentItemStatus", "get_CurrentBoundingRectangle", "get_CurrentLabeledBy", "get_CurrentAriaRole", "get_CurrentAriaProperties", "get_CurrentIsDataValidForForm", "get_CurrentControllerFor", "get_CurrentDescribedBy", "get_CurrentFlowsTo", "get_CurrentProviderDescription", "get_CachedProcessId", "get_CachedControlType", "get_CachedLocalizedControlType", "get_CachedName", "get_CachedAcceleratorKey", "get_CachedAccessKey", "get_CachedHasKeyboardFocus", "get_CachedIsKeyboardFocusable", "get_CachedIsEnabled", "get_CachedAutomationId", "get_CachedClassName", "get_CachedHelpText", "get_CachedCulture", "get_CachedIsControlElement", "get_CachedIsContentElement", "get_CachedIsPassword", "get_CachedNativeWindowHandle", "get_CachedItemType", "get_CachedIsOffscreen", "get_CachedOrientation", "get_CachedFrameworkId", "get_CachedIsRequiredForForm", "get_CachedItemStatus", "get_CachedBoundingRectangle", "get_CachedLabeledBy", "get_CachedAriaRole", "get_CachedAriaProperties", "get_CachedIsDataValidForForm", "get_CachedControllerFor", "get_CachedDescribedBy", "get_CachedFlowsTo", "get_CachedProviderDescription", "GetClickablePoint" }),
        ["IUIAutomationTreeWalker"] = ("4042c624-389c-4afc-a630-9df854a541fc", new string[] { "GetParentElement", "GetFirstChildElement", "GetLastChildElement", "GetNextSiblingElement", "GetPreviousSiblingElement", "NormalizeElement", "GetParentElementBuildCache", "GetFirstChildElementBuildCache", "GetLastChildElementBuildCache", "GetNextSiblingElementBuildCache", "GetPreviousSiblingElementBuildCache", "NormalizeElementBuildCache", "get_Condition" }),
        ["IUIAutomationInvokePattern"] = ("fb377fbe-8ea6-46d5-9c73-6499642d3059", new string[] { "Invoke" }),
        ["IUIAutomationLegacyIAccessiblePattern"] = ("828055ad-355b-4435-86d5-3b51c14a9b1b", new string[] { "Select", "DoDefaultAction", "SetValue", "get_CurrentChildId", "get_CurrentName", "get_CurrentValue", "get_CurrentDescription", "get_CurrentRole", "get_CurrentState", "get_CurrentHelp", "get_CurrentKeyboardShortcut", "GetCurrentSelection", "get_CurrentDefaultAction", "get_CachedChildId", "get_CachedName", "get_CachedValue", "get_CachedDescription", "get_CachedRole", "get_CachedState", "get_CachedHelp", "get_CachedKeyboardShortcut", "GetCachedSelection", "get_CachedDefaultAction", "GetIAccessible" }),
        ["IUIAutomationTogglePattern"] = ("94cf8058-9b8d-4ab9-8bfd-4cd0a33c8c70", new string[] { "Toggle", "get_CurrentToggleState", "get_CachedToggleState" }),
        ["IUIAutomationValuePattern"] = ("a94cd8b1-0844-4cd6-9d2d-640537ab39e9", new string[] { "SetValue", "get_CurrentValue", "get_CurrentIsReadOnly", "get_CachedValue", "get_CachedIsReadOnly" }),
        ["IUIAutomationRangeValuePattern"] = ("59213f4f-7346-49e5-b120-80555987a148", new string[] { "SetValue", "get_CurrentValue", "get_CurrentIsReadOnly", "get_CurrentMaximum", "get_CurrentMinimum", "get_CurrentLargeChange", "get_CurrentSmallChange", "get_CachedValue", "get_CachedIsReadOnly", "get_CachedMaximum", "get_CachedMinimum", "get_CachedLargeChange", "get_CachedSmallChange" }),
        ["IUIAutomationExpandCollapsePattern"] = ("619be086-1f4e-4ee4-bafa-210128738730", new string[] { "Expand", "Collapse", "get_CurrentExpandCollapseState", "get_CachedExpandCollapseState" }),
        ["IUIAutomationScrollItemPattern"] = ("b488300f-d015-4f19-9c29-bb595e3645ef", new string[] { "ScrollIntoView" }),
        ["IUIAutomationSelectionItemPattern"] = ("a8efa66a-0fda-421a-9194-38021f3578ea", new string[] { "Select", "AddToSelection", "RemoveFromSelection", "get_CurrentIsSelected", "get_CurrentSelectionContainer", "get_CachedIsSelected", "get_CachedSelectionContainer" }),
        ["IUIAutomationSelectionPattern"] = ("5ed5202e-b2ac-47a6-b638-4b0bf140d78e", new string[] { "GetCurrentSelection", "get_CurrentCanSelectMultiple", "get_CurrentIsSelectionRequired", "GetCachedSelection", "get_CachedCanSelectMultiple", "get_CachedIsSelectionRequired" }),
        ["IUIAutomationWindowPattern"] = ("0faef453-9208-43ef-bbb2-3b485177864f", new string[] { "Close", "WaitForInputIdle", "SetWindowVisualState", "get_CurrentCanMaximize", "get_CurrentCanMinimize", "get_CurrentIsModal", "get_CurrentIsTopmost", "get_CurrentWindowVisualState", "get_CurrentWindowInteractionState", "get_CachedCanMaximize", "get_CachedCanMinimize", "get_CachedIsModal", "get_CachedIsTopmost", "get_CachedWindowVisualState", "get_CachedWindowInteractionState" }),
        ["IUIAutomationTransformPattern"] = ("a9b55844-a55d-4ef0-926d-569c16ff89bb", new string[] { "Move", "Resize", "Rotate", "get_CurrentCanMove", "get_CurrentCanResize", "get_CurrentCanRotate", "get_CachedCanMove", "get_CachedCanResize", "get_CachedCanRotate" }),
        ["IUIAutomationTextPattern"] = ("32eba289-3583-42c9-9c59-3b6d9a1e9b6a", new string[] { "RangeFromPoint", "RangeFromChild", "GetSelection", "GetVisibleRanges", "get_DocumentRange", "get_SupportedTextSelection" }),
        ["IUIAutomationTextRange"] = ("a543cc6a-f4ae-494b-8239-c814481187a8", new string[] { "Clone", "Compare", "CompareEndpoints", "ExpandToEnclosingUnit", "FindAttribute", "FindText", "GetAttributeValue", "GetBoundingRectangles", "GetEnclosingElement", "GetText", "Move", "MoveEndpointByUnit", "MoveEndpointByRange", "Select", "AddToSelection", "RemoveFromSelection", "ScrollIntoView", "GetChildren" }),
        ["IUIAutomationTextRangeArray"] = ("ce4ae76a-e717-4c98-81ea-47371d028eb6", new string[] { "get_Length", "GetElement" }),
        ["IUIAutomation"] = ("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee", new string[] { "CompareElements", "CompareRuntimeIds", "GetRootElement", "ElementFromHandle", "ElementFromPoint", "GetFocusedElement", "GetRootElementBuildCache", "ElementFromHandleBuildCache", "ElementFromPointBuildCache", "GetFocusedElementBuildCache", "CreateTreeWalker", "get_ControlViewWalker", "get_ContentViewWalker", "get_RawViewWalker", "get_RawViewCondition", "get_ControlViewCondition", "get_ContentViewCondition", "CreateCacheRequest", "CreateTrueCondition", "CreateFalseCondition", "CreatePropertyCondition", "CreatePropertyConditionEx", "CreateAndCondition", "CreateAndConditionFromArray", "CreateAndConditionFromNativeArray", "CreateOrCondition", "CreateOrConditionFromArray", "CreateOrConditionFromNativeArray", "CreateNotCondition", "AddAutomationEventHandler", "RemoveAutomationEventHandler", "AddPropertyChangedEventHandlerNativeArray", "AddPropertyChangedEventHandler", "RemovePropertyChangedEventHandler", "AddStructureChangedEventHandler", "RemoveStructureChangedEventHandler", "AddFocusChangedEventHandler", "RemoveFocusChangedEventHandler", "RemoveAllEventHandlers", "IntNativeArrayToSafeArray", "IntSafeArrayToNativeArray", "RectToVariant", "VariantToRect", "SafeArrayToRectNativeArray", "CreateProxyFactoryEntry", "get_ProxyFactoryMapping", "GetPropertyProgrammaticName", "GetPatternProgrammaticName", "PollForPotentialSupportedPatterns", "PollForPotentialSupportedProperties", "CheckNotSupported", "get_ReservedNotSupportedValue", "get_ReservedMixedAttributeValue", "ElementFromIAccessible", "ElementFromIAccessibleBuildCache" }),
    };

    public static IEnumerable<object[]> Interfaces() =>
        typeof(IUIAutomation).Assembly.GetTypes()
            .Where(t => t.IsInterface && t.Namespace == typeof(IUIAutomation).Namespace
                        && t.GetCustomAttribute<ComImportAttribute>() != null)
            .Select(t => new object[] { t.Name });

    [Fact]
    public void EveryComImportInterface_IsCoveredByHeaderData()
    {
        var missing = Interfaces().Select(o => (string)o[0]).Where(n => !Header.ContainsKey(n)).ToList();
        Assert.Empty(missing);
    }

    [Theory]
    [MemberData(nameof(Interfaces))]
    public void Iid_MatchesHeader(string name)
    {
        var type = typeof(IUIAutomation).Assembly.GetTypes().Single(t => t.Name == name);
        Assert.Equal(Header[name].Iid, type.GUID.ToString(), ignoreCase: true);
    }

    [Theory]
    [MemberData(nameof(Interfaces))]
    public void MemberOrder_MatchesHeaderVtable(string name)
    {
        var type = typeof(IUIAutomation).Assembly.GetTypes().Single(t => t.Name == name);

        // Declaration order = metadata token order = vtable slot order for [ComImport].
        var declared = type.GetMethods()
            .OrderBy(m => m.MetadataToken)
            .Select(m => Normalize(m.Name))
            .ToArray();

        // Declaring a prefix of the interface is fine (unused tail slots never called);
        // every declared slot must line up with the header.
        var expected = Header[name].Vtable.Take(declared.Length).Select(Normalize).ToArray();
        Assert.True(declared.Length <= Header[name].Vtable.Length,
            $"{name} declares {declared.Length} members, header has {Header[name].Vtable.Length}");
        Assert.Equal(expected, declared);
    }

    // C# spells some slots differently from the IDL without changing the slot:
    // property getters/setters (get_X / set_X vs get_X / put_X) and hand-named
    // methods (GetCurrentLabeledBy vs get_CurrentLabeledBy).
    private static string Normalize(string n)
    {
        if (n.StartsWith("set_", StringComparison.Ordinal) || n.StartsWith("put_", StringComparison.Ordinal)) return "put:" + n[4..];
        if (n.StartsWith("get_", StringComparison.Ordinal)) n = n[4..];
        else if (n.StartsWith("Get", StringComparison.Ordinal) && (n.StartsWith("GetCurrent", StringComparison.Ordinal) || n.StartsWith("GetCached", StringComparison.Ordinal))
                 && !n.StartsWith("GetCurrentPattern", StringComparison.Ordinal) && !n.StartsWith("GetCachedPattern", StringComparison.Ordinal)
                 && !n.StartsWith("GetCurrentPropertyValue", StringComparison.Ordinal) && !n.StartsWith("GetCachedPropertyValue", StringComparison.Ordinal)
                 && !n.StartsWith("GetCurrentSelection", StringComparison.Ordinal) && !n.StartsWith("GetCachedSelection", StringComparison.Ordinal)
                 && !n.StartsWith("GetCachedParent", StringComparison.Ordinal) && !n.StartsWith("GetCachedChildren", StringComparison.Ordinal))
            n = n[3..];
        return "get:" + n;
    }
}
