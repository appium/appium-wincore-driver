using System.Diagnostics;
using System.Text.Json;
using System.Xml;
using WincoreServer.Server;
using WincoreServer.State;
using WincoreServer.Uia3;

namespace WincoreServer.Commands;

public static class PageSourceCommands
{
    public static object? GetPageSource(SessionState state, JsonElement? parameters)
    {
        var root = state.GetLiveRoot();
        if (root == null)
        {
            return "<DummyRoot></DummyRoot>";
        }

        // When a tree provider owns this window and auto-swaps page source (UIA sees
        // the window as an opaque childless pane), build the page source from the
        // provider's tree instead of UIA. Opt-in-only providers never auto-swap; their
        // tree is reached via the plugin's own commands.
        var rootHwnd = root.CurrentNativeWindowHandle;
        var rootName = root.get_CurrentName() ?? "";
        if (rootHwnd != IntPtr.Zero
            && state.Providers.TryResolveWindow(rootHwnd, rootName, out var windowProvider)
            && windowProvider.AutoSwapsPageSource)
        {
            var providerRootId = windowProvider.GetWindowRootId(rootHwnd, rootName);
            if (providerRootId != null)
            {
                var providerDoc = new XmlDocument();
                windowProvider.BuildPageSourceXml(providerRootId, providerDoc, null);
                return providerDoc.OuterXml;
            }
        }

        var xmlDoc = new XmlDocument();

        // Fast path: one BuildUpdatedCache COM call pulls the whole subtree + every
        // property we read, then the walk is in-process (GetCachedChildren /
        // GetCachedPropertyValue). The live path did ~25 cross-process COM calls per node.
        var noCache = Environment.GetEnvironmentVariable("UIA_NO_CACHE") == "1"; // perf A/B only
        try
        {
            if (noCache) throw new InvalidOperationException("UIA_NO_CACHE");
            var req = BuildPageSourceCacheRequest(state.Automation, includeLegacy: true);
            var walk = new StandardValues.WalkRequests(req, BuildPageSourceCacheRequest(state.Automation, includeLegacy: false));
            var trueCond = state.Automation.CreateTrueCondition();
            // Cache one tree level at a time: FindAllBuildCache(Children) returns each
            // child with every property already cached, so the ~25 property reads per
            // node become in-process GetCachedPropertyValue calls. Same per-level FindAll
            // traversal the live walk (and native find) use, so nothing is dropped — a
            // full-subtree cache request instead made the WinForms provider slow AND
            // incomplete.
            var cachedRoot = root.FindFirstBuildCache(TreeScope.Element, trueCond, req);
            return BuildCachedPageSourceXml(cachedRoot, state, req, trueCond, walk);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PageSource] cached walk failed, falling back to live walk: {ex.Message}");
            xmlDoc = new XmlDocument();
        }

        BuildPageSource(root, xmlDoc, null, state, root);
        return xmlDoc.OuterXml;
    }

    /// <summary>
    /// Builds the page-source XML from an already-cached root. Split out of
    /// <see cref="GetPageSource"/> so a null <paramref name="cachedRoot"/> — which
    /// <see cref="BuildPageSourceCached"/> would otherwise handle by silently emitting a
    /// single bogus "Unknown" element (it treats every property read defensively so a
    /// stale/absent element never crashes mid-walk) — instead throws here, where
    /// GetPageSource's catch is still listening and falls back to the live walk.
    /// </summary>
    internal static string BuildCachedPageSourceXml(
        IUIAutomationElement? cachedRoot,
        SessionState state,
        IUIAutomationCacheRequest req,
        IUIAutomationCondition trueCond,
        StandardValues.WalkRequests? walk = null)
    {
        if (cachedRoot == null)
            throw new InvalidOperationException("FindFirstBuildCache(root) returned null.");

        var xmlDoc = new XmlDocument();
        BuildPageSourceCached(cachedRoot, xmlDoc, null, state, cachedRoot, walk ?? StandardValues.WalkRequests.Single(req), trueCond);
        return xmlDoc.OuterXml;
    }

    // Every property BuildPageSourceCached reads must be added here, or
    // GetCachedPropertyValue throws for it.
    private static readonly int[] PageSourcePropertyIds =
    {
        UIA.ControlTypePropertyId, UIA.LocalizedControlTypePropertyId, UIA.NamePropertyId,
        UIA.AcceleratorKeyPropertyId, UIA.AccessKeyPropertyId, UIA.AutomationIdPropertyId,
        UIA.ClassNamePropertyId, UIA.FrameworkIdPropertyId, UIA.HasKeyboardFocusPropertyId,
        UIA.HelpTextPropertyId, UIA.IsContentElementPropertyId, UIA.IsControlElementPropertyId,
        UIA.IsEnabledPropertyId, UIA.IsKeyboardFocusablePropertyId, UIA.IsOffscreenPropertyId,
        UIA.IsPasswordPropertyId, UIA.IsRequiredForFormPropertyId, UIA.ItemStatusPropertyId,
        UIA.ItemTypePropertyId, UIA.OrientationPropertyId, UIA.ProcessIdPropertyId,
        UIA.RuntimeIdPropertyId, UIA.BoundingRectanglePropertyId,
        UIA.ValueValuePropertyId,
        // + StandardValues.LegacyPropertyIds on the full request (see WalkRequests).
    };

    // Every attribute goes through the sanitiser: control text can carry characters
    // XML 1.0 cannot represent, which would otherwise produce an unparseable document.
    private static void Set(XmlElement el, string name, string? value)
        => el.SetAttribute(name, StandardValues.Sanitize(value));

    private static IUIAutomationCacheRequest BuildPageSourceCacheRequest(IUIAutomation automation, bool includeLegacy)
    {
        var req = automation.CreateCacheRequest();
        foreach (var pid in includeLegacy ? PageSourcePropertyIds.Concat(StandardValues.LegacyPropertyIds) : PageSourcePropertyIds)
        {
            req.AddProperty(pid);
        }
        req.AddPattern(UIA.WindowPatternId);
        req.AddPattern(UIA.TransformPatternId);
        req.TreeScope = TreeScope.Element; // per-level FindAllBuildCache caches each element itself
        req.TreeFilter = automation.CreateTrueCondition();
        req.AutomationElementMode = UIA.AutomationElementModeFull;
        return req;
    }

    private static object? CVal(IUIAutomationElement el, int pid)
    {
        try { return el.GetCachedPropertyValue(pid); } catch { return null; }
    }

    private static string CStr(IUIAutomationElement el, int pid)
        => CVal(el, pid) as string ?? "";

    // UIA hands VT_BOOL properties back as a boxed bool, not int — check bool first.
    private static bool CBool(IUIAutomationElement el, int pid)
        => CVal(el, pid) switch { bool b => b, int i => i != 0, _ => false };

    private static void BuildPageSourceCached(
        IUIAutomationElement element,
        XmlDocument xmlDoc,
        XmlElement? parentXmlElement,
        SessionState state,
        IUIAutomationElement rootForCoords,
        StandardValues.WalkRequests walk,
        IUIAutomationCondition trueCond)
    {
        var perfSw = state.PerfMetricsEnabled ? Stopwatch.StartNew() : null;
        try
        {
            var controlTypeId = CVal(element, UIA.ControlTypePropertyId) is int ct ? ct : 0;
            var localizedControlType = CStr(element, UIA.LocalizedControlTypePropertyId);
            var tagName = ConditionBuilder.ControlTypeNameById.TryGetValue(controlTypeId, out var name) ? name : "";
            if (string.IsNullOrEmpty(tagName))
            {
                tagName = string.Concat(localizedControlType.Split(' ')
                    .Select(w => w.Length > 0 ? char.ToUpper(w[0]) + w[1..].ToLower() : ""));
            }
            if (string.IsNullOrEmpty(tagName))
            {
                tagName = "Unknown";
            }

            var runtimeId = CVal(element, UIA.RuntimeIdPropertyId) as int[];
            var runtimeIdStr = runtimeId != null ? string.Join(".", runtimeId) : "";

            // Cached BoundingRectangle is a double[4] = [left, top, width, height]
            // (unlike CurrentBoundingRectangle's tagRECT of left/top/right/bottom).
            var rect = CVal(element, UIA.BoundingRectanglePropertyId) as double[] ?? new double[4];
            var rootRect = CVal(rootForCoords, UIA.BoundingRectanglePropertyId) as double[] ?? new double[4];
            if (rect.Length < 4) rect = new double[4];
            if (rootRect.Length < 4) rootRect = new double[4];
            var x = (int)(rect[0] - rootRect[0]);
            var y = (int)(rect[1] - rootRect[1]);
            var width = (int)rect[2];
            var height = (int)rect[3];

            var newXmlElement = xmlDoc.CreateElement(tagName);
            Set(newXmlElement, "AcceleratorKey", CStr(element, UIA.AcceleratorKeyPropertyId));
            Set(newXmlElement, "AccessKey", CStr(element, UIA.AccessKeyPropertyId));
            Set(newXmlElement, "AutomationId", CStr(element, UIA.AutomationIdPropertyId));
            Set(newXmlElement, "ClassName", CStr(element, UIA.ClassNamePropertyId));
            Set(newXmlElement, "FrameworkId", CStr(element, UIA.FrameworkIdPropertyId));
            Set(newXmlElement, "HasKeyboardfocus", CBool(element, UIA.HasKeyboardFocusPropertyId).ToString());
            Set(newXmlElement, "HelpText", CStr(element, UIA.HelpTextPropertyId));
            Set(newXmlElement, "IsContentelement", CBool(element, UIA.IsContentElementPropertyId).ToString());
            Set(newXmlElement, "IsControlelement", CBool(element, UIA.IsControlElementPropertyId).ToString());
            Set(newXmlElement, "IsEnabled", CBool(element, UIA.IsEnabledPropertyId).ToString());
            Set(newXmlElement, "IsKeyboardfocusable", CBool(element, UIA.IsKeyboardFocusablePropertyId).ToString());
            Set(newXmlElement, "IsOffscreen", CBool(element, UIA.IsOffscreenPropertyId).ToString());
            Set(newXmlElement, "IsPassword", CBool(element, UIA.IsPasswordPropertyId).ToString());
            Set(newXmlElement, "IsRequiredforform", CBool(element, UIA.IsRequiredForFormPropertyId).ToString());
            Set(newXmlElement, "ItemStatus", CStr(element, UIA.ItemStatusPropertyId));
            Set(newXmlElement, "ItemType", CStr(element, UIA.ItemTypePropertyId));
            Set(newXmlElement, "LocalizedControlType", localizedControlType);
            Set(newXmlElement, "Name", CStr(element, UIA.NamePropertyId));
            Set(newXmlElement, "Orientation",
                (CVal(element, UIA.OrientationPropertyId) is int o ? o : 0).ToString());
            Set(newXmlElement, "ProcessId",
                (CVal(element, UIA.ProcessIdPropertyId) is int p ? p : 0).ToString());
            Set(newXmlElement, "RuntimeId", runtimeIdStr);
            Set(newXmlElement, "x", x.ToString());
            Set(newXmlElement, "y", y.ToString());
            Set(newXmlElement, "width", width.ToString());
            Set(newXmlElement, "height", height.ToString());
            StandardValues.Apply(newXmlElement, pid => CVal(element, pid),
                StandardValues.IsPassword(() => element.GetCachedPropertyValue(UIA.IsPasswordPropertyId)),
                CStr(element, UIA.FrameworkIdPropertyId));

            // GetCachedPattern throws E_INVALIDARG when the element doesn't support the
            // pattern (unlike GetCurrentPattern, which returns null) — guard each.
            try
            {
                if (element.GetCachedPattern(UIA.WindowPatternId) is IUIAutomationWindowPattern wp)
                {
                    Set(newXmlElement, "CanMaximize", (wp.CachedCanMaximize != 0).ToString());
                    Set(newXmlElement, "CanMinimize", (wp.CachedCanMinimize != 0).ToString());
                    Set(newXmlElement, "IsModal", (wp.CachedIsModal != 0).ToString());
                    Set(newXmlElement, "WindowVisualState", wp.CachedWindowVisualState.ToString());
                    Set(newXmlElement, "WindowInteractionState", wp.CachedWindowInteractionState.ToString());
                    Set(newXmlElement, "IsTopmost", (wp.CachedIsTopmost != 0).ToString());
                }
            }
            catch { }

            try
            {
                if (element.GetCachedPattern(UIA.TransformPatternId) is IUIAutomationTransformPattern tp)
                {
                    Set(newXmlElement, "CanRotate", (tp.CachedCanRotate != 0).ToString());
                    Set(newXmlElement, "CanResize", (tp.CachedCanResize != 0).ToString());
                    Set(newXmlElement, "CanMove", (tp.CachedCanMove != 0).ToString());
                }
            }
            catch { }

            if (parentXmlElement == null)
            {
                xmlDoc.AppendChild(newXmlElement);
            }
            else
            {
                parentXmlElement.AppendChild(newXmlElement);
            }

            var childReq = walk.ForChildrenOf(element);
            var children = element.FindAllBuildCache(TreeScope.Children, trueCond, childReq);

            if (perfSw != null)
            {
                perfSw.Stop();
                state.Perf.Record("uia.pageSource.node", perfSw.Elapsed.TotalMilliseconds);
            }

            foreach (var child in FindCommands.IterateArray(children))
            {
                BuildPageSourceCached(walk.Upgrade(child, childReq), xmlDoc, newXmlElement, state, rootForCoords, walk, trueCond);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PageSource] cached node skipped: {ex.GetType().Name}: {ex.Message}");
        }
    }

    private static void BuildPageSource(
        IUIAutomationElement element,
        XmlDocument xmlDoc,
        XmlElement? parentXmlElement,
        SessionState state,
        IUIAutomationElement? rootForCoords)
    {
        var perfSw = state.PerfMetricsEnabled ? Stopwatch.StartNew() : null;
        try
        {
            var controlTypeId = element.CurrentControlType;
            var tagName = ConditionBuilder.ControlTypeNameById.TryGetValue(controlTypeId, out var name)
                ? name
                : "";

            var localizedControlType = element.get_CurrentLocalizedControlType() ?? "";
            if (string.IsNullOrEmpty(tagName))
            {
                // Fallback: capitalize localized control type words.
                tagName = string.Concat(
                    localizedControlType.Split(' ')
                        .Select(w => w.Length > 0
                            ? char.ToUpper(w[0]) + w[1..].ToLower()
                            : ""));
            }
            if (string.IsNullOrEmpty(tagName))
            {
                tagName = "Unknown";
            }

            var runtimeId = element.GetRuntimeId();
            var runtimeIdStr = runtimeId != null ? string.Join(".", runtimeId) : "";

            var rect = element.CurrentBoundingRectangle;
            var rootRect = rootForCoords?.CurrentBoundingRectangle ?? new tagRECT();
            var x = rect.left - rootRect.left;
            var y = rect.top - rootRect.top;
            var width = rect.right - rect.left;
            var height = rect.bottom - rect.top;

            var newXmlElement = xmlDoc.CreateElement(tagName);
            Set(newXmlElement, "AcceleratorKey", element.get_CurrentAcceleratorKey() ?? "");
            Set(newXmlElement, "AccessKey", element.get_CurrentAccessKey() ?? "");
            Set(newXmlElement, "AutomationId", element.get_CurrentAutomationId() ?? "");
            Set(newXmlElement, "ClassName", element.get_CurrentClassName() ?? "");
            Set(newXmlElement, "FrameworkId", element.get_CurrentFrameworkId() ?? "");
            Set(newXmlElement, "HasKeyboardfocus", (element.CurrentHasKeyboardFocus != 0).ToString());
            Set(newXmlElement, "HelpText", element.get_CurrentHelpText() ?? "");
            Set(newXmlElement, "IsContentelement", (element.CurrentIsContentElement != 0).ToString());
            Set(newXmlElement, "IsControlelement", (element.CurrentIsControlElement != 0).ToString());
            Set(newXmlElement, "IsEnabled", (element.CurrentIsEnabled != 0).ToString());
            Set(newXmlElement, "IsKeyboardfocusable", (element.CurrentIsKeyboardFocusable != 0).ToString());
            Set(newXmlElement, "IsOffscreen", (element.CurrentIsOffscreen != 0).ToString());
            Set(newXmlElement, "IsPassword", (element.CurrentIsPassword != 0).ToString());
            Set(newXmlElement, "IsRequiredforform", (element.CurrentIsRequiredForForm != 0).ToString());
            Set(newXmlElement, "ItemStatus", element.get_CurrentItemStatus() ?? "");
            Set(newXmlElement, "ItemType", element.get_CurrentItemType() ?? "");
            Set(newXmlElement, "LocalizedControlType", localizedControlType);
            Set(newXmlElement, "Name", element.get_CurrentName() ?? "");
            Set(newXmlElement, "Orientation", element.CurrentOrientation.ToString());
            Set(newXmlElement, "ProcessId", element.CurrentProcessId.ToString());
            Set(newXmlElement, "RuntimeId", runtimeIdStr);
            Set(newXmlElement, "x", x.ToString());
            Set(newXmlElement, "y", y.ToString());
            Set(newXmlElement, "width", width.ToString());
            Set(newXmlElement, "height", height.ToString());
            StandardValues.Apply(newXmlElement, element.GetCurrentPropertyValue,
                StandardValues.IsPassword(() => element.GetCurrentPropertyValue(UIA.IsPasswordPropertyId)),
                element.get_CurrentFrameworkId());

            // WindowPattern attributes (for top-level windows)
            if (element.GetCurrentPattern(UIA.WindowPatternId) is IUIAutomationWindowPattern wp)
            {
                Set(newXmlElement, "CanMaximize", (wp.CurrentCanMaximize != 0).ToString());
                Set(newXmlElement, "CanMinimize", (wp.CurrentCanMinimize != 0).ToString());
                Set(newXmlElement, "IsModal", (wp.CurrentIsModal != 0).ToString());
                Set(newXmlElement, "WindowVisualState", wp.CurrentWindowVisualState.ToString());
                Set(newXmlElement, "WindowInteractionState", wp.CurrentWindowInteractionState.ToString());
                Set(newXmlElement, "IsTopmost", (wp.CurrentIsTopmost != 0).ToString());
            }

            // TransformPattern attributes
            if (element.GetCurrentPattern(UIA.TransformPatternId) is IUIAutomationTransformPattern tp)
            {
                Set(newXmlElement, "CanRotate", (tp.CurrentCanRotate != 0).ToString());
                Set(newXmlElement, "CanResize", (tp.CurrentCanResize != 0).ToString());
                Set(newXmlElement, "CanMove", (tp.CurrentCanMove != 0).ToString());
            }

            if (parentXmlElement == null)
            {
                xmlDoc.AppendChild(newXmlElement);
            }
            else
            {
                parentXmlElement.AppendChild(newXmlElement);
            }

            // Walk all children unconditionally, matching the traversal FindCommands
            // uses (native find ignores TreeFilter; its manual-walk fallback uses
            // TrueCondition). Keeps page source and findElement seeing the same tree.
            var children = element.FindAll(TreeScope.Children, state.Automation.CreateTrueCondition());

            if (perfSw != null)
            {
                perfSw.Stop();
                state.Perf.Record("uia.pageSource.node", perfSw.Elapsed.TotalMilliseconds);
            }

            foreach (var child in FindCommands.IterateArray(children))
            {
                BuildPageSource(child, xmlDoc, newXmlElement, state, rootForCoords);
            }
        }
        catch
        {
            // Match the historical PowerShell driver's behavior — swallow per-element
            // failures during page-source generation so a single flaky subtree can't
            // abort the whole dump.
        }
    }
}
