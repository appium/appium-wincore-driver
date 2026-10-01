using WincoreServer.Commands;
using WincoreServer.Server;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// Formatting rules for the standard accessibility attributes (Value, LegacyValue,
/// LegacyName, LegacyDescription, LegacyRole, LegacyState) shared by page source and
/// the XPath model, plus the property-map names getAttribute / find conditions accept.
/// </summary>
public class StandardValuesTests
{
    [Fact]
    public void Attributes_AreTheSixSpecNames_InPageSourceOrder()
    {
        Assert.Equal(
            new[] { "Value", "LegacyValue", "LegacyName", "LegacyDescription", "LegacyRole", "LegacyState" },
            StandardValues.Attributes.Select(a => a.Name));
    }

    [Fact]
    public void Attributes_OnlyValueAndLegacyValue_AreContent()
    {
        Assert.Equal(
            new[] { "Value", "LegacyValue" },
            StandardValues.Attributes.Where(a => a.Content).Select(a => a.Name));
    }

    [Fact]
    public void Attributes_ResolveThroughThePropertyMap_ToTheSameId()
    {
        foreach (var (name, pid, _, _) in StandardValues.Attributes)
        {
            Assert.Equal(pid, ConditionBuilder.GetPropertyId(name));
        }
    }

    [Theory]
    [InlineData("Value.Value", UIA.ValueValuePropertyId)]
    [InlineData("value.value", UIA.ValueValuePropertyId)]
    [InlineData("Value.IsReadOnly", UIA.ValueIsReadOnlyPropertyId)]
    [InlineData("LegacyIAccessible.Value", UIA.LegacyIAccessibleValuePropertyId)]
    [InlineData("legacyiaccessible.value", UIA.LegacyIAccessibleValuePropertyId)]
    [InlineData("LegacyIAccessible.Name", UIA.LegacyIAccessibleNamePropertyId)]
    [InlineData("LegacyIAccessible.Description", UIA.LegacyIAccessibleDescriptionPropertyId)]
    [InlineData("LegacyIAccessible.Role", UIA.LegacyIAccessibleRolePropertyId)]
    [InlineData("LegacyIAccessible.State", UIA.LegacyIAccessibleStatePropertyId)]
    [InlineData("LegacyIAccessible.DefaultAction", UIA.LegacyIAccessibleDefaultActionPropertyId)]
    [InlineData("LegacyDefaultAction", UIA.LegacyIAccessibleDefaultActionPropertyId)]
    [InlineData("LEGACYVALUE", UIA.LegacyIAccessibleValuePropertyId)]
    [InlineData("LegacyValueProperty", UIA.LegacyIAccessibleValuePropertyId)]
    [InlineData("ProviderDescription", UIA.ProviderDescriptionPropertyId)]
    [InlineData("SelectionItem.IsSelected", UIA.SelectionItemIsSelectedPropertyId)]
    public void PropertyMap_ResolvesNamesAndAliases_CaseInsensitively(string name, int expected)
    {
        Assert.Equal(expected, ConditionBuilder.GetPropertyId(name));
    }

    [Fact]
    public void LegacyPropertyIds_AreTheFiveLegacyAttributes()
    {
        Assert.Equal(
            new[]
            {
                UIA.LegacyIAccessibleValuePropertyId, UIA.LegacyIAccessibleNamePropertyId,
                UIA.LegacyIAccessibleDescriptionPropertyId, UIA.LegacyIAccessibleRolePropertyId,
                UIA.LegacyIAccessibleStatePropertyId,
            },
            StandardValues.LegacyPropertyIds);
    }

    [Theory]
    [InlineData("WPF", true)]
    [InlineData("wpf", true)]
    [InlineData("XAML", true)]
    [InlineData("DirectUI", true)]
    [InlineData("WinForm", false)]
    [InlineData("Win32", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsNativeUia_OnlyForFrameworksWithTheirOwnProvider(string? frameworkId, bool expected)
    {
        Assert.Equal(expected, StandardValues.IsNativeUia(frameworkId));
    }

    [Fact]
    public void Format_PassesStringsThrough()
    {
        Assert.Equal("Degraded", StandardValues.Format("Degraded", content: true, isPassword: false));
    }

    [Theory]
    [InlineData(29, "29")]
    [InlineData(0x300046, "3145798")]
    public void Format_EmitsIntegersAsDecimalStrings(int raw, string expected)
    {
        Assert.Equal(expected, StandardValues.Format(raw, content: false, isPassword: false));
    }

    [Fact]
    public void Format_MapsNullAndNonValueObjects_ToEmpty()
    {
        Assert.Equal("", StandardValues.Format(null, content: false, isPassword: false));
        // Stand-in for UIA's "not supported" sentinel, which is a COM object, not a value.
        Assert.Equal("", StandardValues.Format(new object(), content: false, isPassword: false));
    }

    [Fact]
    public void Format_BlanksContent_OnPasswordElements()
    {
        Assert.Equal("", StandardValues.Format("4721", content: true, isPassword: true));
    }

    [Fact]
    public void Format_KeepsNonContent_OnPasswordElements()
    {
        Assert.Equal("pinBox", StandardValues.Format("pinBox", content: false, isPassword: true));
    }

    [Fact]
    public void Format_TruncatesContent_ToTheCap()
    {
        var big = new string('x', StandardValues.MaxContentLength + 100);
        Assert.Equal(StandardValues.MaxContentLength, StandardValues.Format(big, content: true, isPassword: false).Length);
    }

    [Fact]
    public void Format_DoesNotTruncateNonContent()
    {
        var big = new string('x', StandardValues.MaxContentLength + 100);
        Assert.Equal(big.Length, StandardValues.Format(big, content: false, isPassword: false).Length);
    }

    [Fact]
    public void Sanitize_DropsCharactersXmlCannotCarry()
    {
        Assert.Equal("ab\tc", StandardValues.Sanitize("a\u0001b\tc\u0008"));
    }

    [Fact]
    public void Sanitize_ReturnsCleanInputUnchanged()
    {
        const string s = "web-01;Web;US East;Healthy";
        Assert.Same(s, StandardValues.Sanitize(s));
    }

    [Fact]
    public void Format_SanitizesContent()
    {
        Assert.Equal("Degraded", StandardValues.Format("Degr\u0000aded", content: true, isPassword: false));
    }
}
