using System.Globalization;
using System.Text;
using WincoreServer.Uia3;

namespace WincoreServer.Commands;

/// <summary>
/// Standard accessibility values emitted on every UIA node by page source and the
/// XPath model: <c>ValuePattern.Value</c> and the <c>LegacyIAccessible</c> (MSAA)
/// properties. MSAA-only controls (DevExpress, .NET Framework DataGridView, VB6,
/// Delphi …) publish their real content in <c>accValue</c> while UIA <c>Name</c> is a
/// placeholder ("Status row 2"), so without these the content is invisible to
/// locators and Appium Inspector.
/// </summary>
internal static class StandardValues
{
    /// <summary>Page source / XPath cap for content attributes. getAttribute returns the full value.</summary>
    public const int MaxContentLength = 4096;

    /// <summary>
    /// Attribute name → UIA property id. <c>Content</c> attributes carry control content:
    /// they are blanked on password elements and truncated to <see cref="MaxContentLength"/>.
    /// Same spelling as the ConditionBuilder property map, so a page-source attribute
    /// works unchanged in getAttribute and find conditions.
    /// </summary>
    public static readonly (string Name, int Pid, bool Content)[] Attributes =
    {
        ("Value", UIA.ValueValuePropertyId, true),
        ("LegacyValue", UIA.LegacyIAccessibleValuePropertyId, true),
        ("LegacyName", UIA.LegacyIAccessibleNamePropertyId, false),
        ("LegacyDescription", UIA.LegacyIAccessibleDescriptionPropertyId, false),
        ("LegacyRole", UIA.LegacyIAccessibleRolePropertyId, false),
        ("LegacyState", UIA.LegacyIAccessibleStatePropertyId, false),
    };

    /// <summary>The LegacyIAccessible subset of <see cref="Attributes"/>.</summary>
    public static readonly int[] LegacyPropertyIds = Attributes
        .Where(a => a.Name.StartsWith("Legacy", StringComparison.Ordinal))
        .Select(a => a.Pid)
        .ToArray();

    /// <summary>
    /// Frameworks with their own UIA provider. UIA core has no MSAA object behind these
    /// and synthesises every LegacyIAccessible property from the element's real UIA
    /// properties — extra calls into the app per property, per element (measured: +79% on
    /// the wpf-large page-source walk for the five properties, vs ~+10% on an MSAA-backed
    /// WinForms tree). The synthesised values only repeat Name / Value there, so the
    /// tree walks skip them for elements under these frameworks.
    /// </summary>
    private static readonly HashSet<string> NativeUiaFrameworks = new(StringComparer.OrdinalIgnoreCase)
    {
        "WPF", "XAML", "DirectUI",
    };

    public static bool IsNativeUia(string? frameworkId)
        => frameworkId != null && NativeUiaFrameworks.Contains(frameworkId);

    /// <summary>
    /// Formats a raw UIA property value as attribute text. Strings pass through,
    /// integers (LegacyRole / LegacyState) become decimal strings, and anything else —
    /// null, or UIA's "not supported" sentinel (a COM object) when the element lacks the
    /// pattern — becomes "".
    /// </summary>
    public static string Format(object? raw, bool content, bool isPassword)
    {
        // Password elements: never expose content. The MSAA Proxy maps
        // STATE_SYSTEM_PROTECTED to IsPassword but still returns accValue verbatim, so a
        // legacy control's secret would otherwise land in page source dumps and logs.
        if (content && isPassword) return "";

        var text = raw switch
        {
            string s => s,
            int i => i.ToString(CultureInfo.InvariantCulture),
            uint u => u.ToString(CultureInfo.InvariantCulture),
            _ => "",
        };

        if (content && text.Length > MaxContentLength) text = text[..MaxContentLength];
        return Sanitize(text);
    }

    /// <summary>
    /// Pair of per-level cache requests for the cached tree walks: <c>Full</c> includes the
    /// LegacyIAccessible properties, <c>Lean</c> omits them. Children of a native-UIA
    /// element are fetched lean; a child that is itself not native UIA (a WinForms control
    /// hosted in WPF, an MSAA-proxied title bar) is re-fetched with the full request so it
    /// keeps its legacy values. Lean-fetched elements emit the legacy attributes as "".
    /// </summary>
    public sealed class WalkRequests
    {
        public IUIAutomationCacheRequest Full { get; }
        public IUIAutomationCacheRequest Lean { get; }

        public WalkRequests(IUIAutomationCacheRequest full, IUIAutomationCacheRequest lean)
        {
            Full = full;
            Lean = lean;
        }

        /// <summary>Both requests the same — no lean path (tests, callers without a pair).</summary>
        public static WalkRequests Single(IUIAutomationCacheRequest req) => new(req, req);

        public IUIAutomationCacheRequest ForChildrenOf(IUIAutomationElement parent)
            => IsNativeUia(CachedFrameworkId(parent)) ? Lean : Full;

        /// <summary>Re-fetches a lean-fetched child with the full request when it is not native UIA.</summary>
        public IUIAutomationElement Upgrade(IUIAutomationElement child, IUIAutomationCacheRequest fetchedWith)
        {
            if (ReferenceEquals(fetchedWith, Full) || IsNativeUia(CachedFrameworkId(child))) return child;
            try { return child.BuildUpdatedCache(Full) ?? child; } catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return child; }
        }

        private static string? CachedFrameworkId(IUIAutomationElement el)
        {
            try { return el.GetCachedPropertyValue(UIA.FrameworkIdPropertyId) as string; }
            catch (Exception ex) when (UiaErrors.IsExpected(ex)) { return null; }
        }
    }

    /// <summary>Drops characters XML 1.0 cannot carry, so a control's text cannot break the document.</summary>
    public static string Sanitize(string? s)
    {
        if (string.IsNullOrEmpty(s)) return s ?? "";
        StringBuilder? sb = null;
        for (var i = 0; i < s.Length; i++)
        {
            var ch = s[i];
            var ok = ch == '\t' || ch == '\n' || ch == '\r' ||
                     (ch >= 0x20 && ch <= 0xD7FF) ||
                     (ch >= 0xE000 && ch <= 0xFFFD);
            if (ok)
            {
                sb?.Append(ch);
            }
            else if (sb == null)
            {
                sb = new StringBuilder(s.Length);
                sb.Append(s, 0, i);
            }
        }
        return sb?.ToString() ?? s;
    }
}
