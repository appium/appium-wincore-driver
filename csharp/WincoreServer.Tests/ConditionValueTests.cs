using System.Text.Json;
using WincoreServer.Server;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>
/// Conversion of ConditionDto property values into the VARIANT-ready objects
/// CreatePropertyCondition expects, for the structured values the
/// `-windows uiautomation` selector parser emits.
/// </summary>
public class ConditionValueTests
{
    private static object Convert(int propertyId, string json) =>
        ConditionBuilder.ConvertValue(propertyId, JsonDocument.Parse(json).RootElement);

    [Fact]
    public void ClickablePoint_Object_BecomesDoublePair()
    {
        Assert.Equal(new[] { 1.5, 2.0 }, Convert(UIA.ClickablePointPropertyId, """{"x":1.5,"y":2}"""));
    }

    [Fact]
    public void BoundingRectangle_Object_BecomesLeftTopWidthHeight()
    {
        Assert.Equal(
            new[] { 1.0, 2.0, 3.0, 4.0 },
            Convert(UIA.BoundingRectanglePropertyId, """{"x":1,"y":2,"width":3,"height":4}"""));
    }

    [Fact]
    public void BoundingRectangle_MissingField_Throws()
    {
        Assert.Throws<ArgumentException>(() => Convert(UIA.BoundingRectanglePropertyId, """{"x":1,"y":2}"""));
    }

    [Fact]
    public void Culture_Name_BecomesLcid()
    {
        Assert.Equal(1033, Convert(UIA.CulturePropertyId, "\"en-US\""));
    }

    [Fact]
    public void Culture_Lcid_PassesThrough()
    {
        Assert.Equal(1033, Convert(UIA.CulturePropertyId, "1033"));
    }

    [Fact]
    public void Culture_UnknownName_Throws()
    {
        Assert.Throws<ArgumentException>(() => Convert(UIA.CulturePropertyId, "\"not a culture!\""));
    }

    [Theory]
    [InlineData("\"None\"", 80050)]
    [InlineData("\"none\"", 80050)]
    [InlineData("\"Level2\"", 80052)]
    [InlineData("\"level9\"", 80059)]
    [InlineData("0", 80050)]
    [InlineData("5", 80055)]
    public void HeadingLevel_BecomesUiaConstant(string json, int expected)
    {
        Assert.Equal(expected, Convert(UIA.HeadingLevelPropertyId, json));
    }

    [Theory]
    [InlineData("\"Level10\"")]
    [InlineData("\"Heading\"")]
    [InlineData("10")]
    public void HeadingLevel_Unknown_Throws(string json)
    {
        Assert.Throws<ArgumentException>(() => Convert(UIA.HeadingLevelPropertyId, json));
    }

    [Theory]
    [InlineData("\"Horizontal\"", 1)]
    [InlineData("\"vertical\"", 2)]
    [InlineData("1", 1)]
    public void Orientation_NameOrNumber_BecomesInt(string json, int expected)
    {
        Assert.Equal(expected, Convert(UIA.OrientationPropertyId, json));
    }
}
