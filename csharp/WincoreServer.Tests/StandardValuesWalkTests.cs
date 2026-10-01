using System.Xml;
using WincoreServer.Commands;
using WincoreServer.State;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// Non-BMP text, fail-closed password reads, the shared attribute writer, and the lean/full
/// cache-request rule for native-UIA subtrees — exercised on scripted fake elements.
/// </summary>
public class StandardValuesWalkTests
{
    private const string Smile = "\U0001F600 Smile"; // 😀 = surrogate pair D83D DE00

    // ── Sanitize / Truncate ─────────────────────────────────────────────────────────

    [Fact]
    public void Sanitize_KeepsSurrogatePairs()
    {
        Assert.Same(Smile, StandardValues.Sanitize(Smile));
        Assert.Equal("\U00020000", StandardValues.Sanitize("\U00020000")); // CJK Extension B
    }

    [Fact]
    public void Sanitize_DropsLoneSurrogates()
    {
        Assert.Equal("ab", StandardValues.Sanitize("a\uD83Db"));  // lone high
        Assert.Equal("ab", StandardValues.Sanitize("a\uDE00b"));  // lone low
        Assert.Equal("a", StandardValues.Sanitize("a\uD83D"));    // high at the end
    }

    [Fact]
    public void Truncate_NeverSplitsAPair()
    {
        var text = new string('x', 9) + "\U0001F600"; // pair occupies index 9 and 10
        Assert.Equal(new string('x', 9), StandardValues.Truncate(text, 10));
        Assert.Equal(text, StandardValues.Truncate(text, 11));
    }

    [Fact]
    public void Format_ContentCapDoesNotSplitAPair()
    {
        var text = new string('y', StandardValues.MaxContentLength - 1) + "\U0001F600";
        var formatted = StandardValues.Format(text, content: true, isPassword: false);
        Assert.Equal(StandardValues.MaxContentLength - 1, formatted.Length);
        Assert.False(char.IsHighSurrogate(formatted[^1]));
    }

    // ── IsPassword (fail closed) ─────────────────────────────────────────────────────

    [Fact]
    public void IsPassword_OnlyAReadableFalseIsNotAPassword()
    {
        Assert.False(StandardValues.IsPassword(() => false));
        Assert.True(StandardValues.IsPassword(() => true));
        Assert.True(StandardValues.IsPassword(() => null));          // missing / sentinel
        Assert.True(StandardValues.IsPassword(() => "false"));       // unexpected type
        Assert.True(StandardValues.IsPassword(() => throw new ArgumentException("E_INVALIDARG: not cached")));
    }

    // ── Apply ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Apply_SkipsLegacyReadsForNativeUia_ButKeepsValue()
    {
        var doc = new XmlDocument();
        var el = doc.CreateElement("Button");
        var reads = new List<int>();
        StandardValues.Apply(el, pid => { reads.Add(pid); return pid == UIA.ValueValuePropertyId ? "v" : "legacy"; },
            isPassword: false, frameworkId: "WPF");

        Assert.Equal(new[] { UIA.ValueValuePropertyId }, reads);
        Assert.Equal("v", el.GetAttribute("Value"));
        Assert.Equal("", el.GetAttribute("LegacyName"));
    }

    [Fact]
    public void Apply_ReadsEverythingForMsaa_AndBlanksContentOnPasswords()
    {
        var doc = new XmlDocument();
        var el = doc.CreateElement("Edit");
        StandardValues.Apply(el, pid => pid == UIA.LegacyIAccessibleNamePropertyId ? "pinBox" : "4721",
            isPassword: true, frameworkId: "WinForm");

        Assert.Equal("", el.GetAttribute("Value"));
        Assert.Equal("", el.GetAttribute("LegacyValue"));
        Assert.Equal("pinBox", el.GetAttribute("LegacyName"));
    }

    [Fact]
    public void Apply_UnexpectedExceptionSurfaces()
    {
        var doc = new XmlDocument();
        Assert.Throws<NullReferenceException>(() =>
            StandardValues.Apply(doc.CreateElement("X"), _ => throw new NullReferenceException(), false, null));
    }

    // ── WalkRequests (lean/full per level) ───────────────────────────────────────────

    [Fact]
    public void WalkRequests_ChildrenOfNativeUia_AreFetchedLean()
    {
        var (full, lean) = (Request(), Request());
        var walk = new StandardValues.WalkRequests(full, lean);

        Assert.Same(lean, walk.ForChildrenOf(Element("WPF").Element));
        Assert.Same(full, walk.ForChildrenOf(Element("WinForm").Element));
        Assert.Same(full, walk.ForChildrenOf(Element("").Element));
    }

    [Fact]
    public void WalkRequests_NonNativeChildOfNativeParent_IsRefetchedFull()
    {
        // A WinForms control hosted in WPF keeps its Legacy* values.
        var (full, lean) = (Request(), Request());
        var walk = new StandardValues.WalkRequests(full, lean);
        var upgraded = Element("WinForm").Element;
        var child = Element("WinForm");
        IUIAutomationCacheRequest? usedRequest = null;
        child.Fake.Members["BuildUpdatedCache"] = a => { usedRequest = (IUIAutomationCacheRequest)a![0]!; return upgraded; };

        Assert.Same(upgraded, walk.Upgrade(child.Element, fetchedWith: lean));
        Assert.Same(full, usedRequest);
    }

    [Fact]
    public void WalkRequests_NativeChild_OrFullFetch_IsNotRefetched()
    {
        var (full, lean) = (Request(), Request());
        var walk = new StandardValues.WalkRequests(full, lean);
        var wpfChild = Element("WPF");
        var formsChild = Element("WinForm");

        Assert.Same(wpfChild.Element, walk.Upgrade(wpfChild.Element, fetchedWith: lean));
        Assert.Same(formsChild.Element, walk.Upgrade(formsChild.Element, fetchedWith: full));
        Assert.DoesNotContain("BuildUpdatedCache", wpfChild.Fake.Calls);
        Assert.DoesNotContain("BuildUpdatedCache", formsChild.Fake.Calls);
    }

    // ── Page source / XPath model keep non-BMP text ─────────────────────────────────

    [Fact]
    public void PageSource_KeepsEmojiInNameAndValue()
    {
        var el = Leaf(Smile);
        var xml = PageSourceCommands.BuildCachedPageSourceXml(el.Element, new SessionState(), Request(), Condition());

        var node = Parse(xml).DocumentElement!;
        Assert.Equal(Smile, node.GetAttribute("Name"));
        Assert.Equal(Smile, node.GetAttribute("LegacyValue"));
    }

    [Fact]
    public void XPathModel_KeepsEmojiInName()
    {
        var el = Leaf(Smile);
        var model = UiaXmlModel.BuildFromCachedRoot(el.Element, null, Request(), Condition());

        Assert.Equal(Smile, model.Document.DocumentElement!.GetAttribute("Name"));
    }

    // ── helpers ──────────────────────────────────────────────────────────────────────

    private static FakeElement Element(string frameworkId)
    {
        var el = new FakeElement();
        el.Properties[UIA.FrameworkIdPropertyId] = frameworkId;
        return el;
    }

    private static FakeElement Leaf(string text)
    {
        var el = Element("WinForm");
        el.Properties[UIA.ControlTypePropertyId] = UIA.TextControlTypeId;
        el.Properties[UIA.NamePropertyId] = text;
        el.Properties[UIA.LegacyIAccessibleValuePropertyId] = text;
        el.Properties[UIA.IsPasswordPropertyId] = false;
        var (children, childrenFake) = UiaFake.Create<IUIAutomationElementArray>();
        childrenFake.Members["get_Length"] = _ => 0;
        el.Fake.Members["FindAllBuildCache"] = _ => children;
        return el;
    }

    private static IUIAutomationCacheRequest Request() => UiaFake.Create<IUIAutomationCacheRequest>().Proxy;

    private static IUIAutomationCondition Condition() => UiaFake.Create<IUIAutomationCondition>().Proxy;

    private static XmlDocument Parse(string xml)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml); // strict parse: fails on invalid characters or broken pairs
        return doc;
    }
}
