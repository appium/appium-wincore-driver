using System.Text.Json;
using WincoreServer.Commands;
using WincoreServer.State;
using WincoreServer.Uia3;
using Xunit;

namespace WincoreServer.Tests;

/// <summary>findItemInContainer: ItemContainerPattern lookup, exact-name and entry-type check, Realize.</summary>
public class ContainerCommandsTests
{
    private readonly SessionState _state = new();

    private static JsonElement Args(string name) =>
        JsonDocument.Parse(JsonSerializer.Serialize(new { elementId = "1.2.3", name })).RootElement;

    private static FakeElement Item(string name, int controlType = UIA.ListItemControlTypeId)
    {
        var item = new FakeElement();
        item.Properties[UIA.NamePropertyId] = name;
        item.Properties[UIA.ControlTypePropertyId] = controlType;
        item.Fake.Members["GetRuntimeId"] = _ => new[] { 42, 7 };
        return item;
    }

    private static FakeElement Combo(IUIAutomationElement? found)
    {
        var combo = new FakeElement();
        var (pattern, fake) = UiaFake.Create<IUIAutomationItemContainerPattern>();
        fake.Members["FindItemByProperty"] = a =>
        {
            Assert.Equal(UIA.NamePropertyId, (int)a![1]!);
            return found;
        };
        combo.Patterns[UIA.ItemContainerPatternId] = pattern;
        return combo;
    }

    [Fact]
    public void RealizesTheEntry_AndReturnsItsId()
    {
        var item = Item("Item 290");
        var realized = 0;
        var (virtualized, fake) = UiaFake.Create<IUIAutomationVirtualizedItemPattern>();
        fake.Members["Realize"] = _ => { realized++; return null; };
        item.Patterns[UIA.VirtualizedItemPatternId] = virtualized;

        var id = ContainerCommands.FindItemInContainer(_state, Combo(item.Element).Element, Args("Item 290"));

        Assert.Equal("42.7", id);
        Assert.Equal(1, realized);
        Assert.Same(item.Element, _state.GetElement("42.7"));
    }

    [Fact]
    public void RealizedEntry_IsReturnedAsIs() =>
        Assert.Equal("42.7", ContainerCommands.FindItemInContainer(_state, Combo(Item("Toys").Element).Element, Args("Toys")));

    [Fact]
    public void NoMatch_ReturnsNull() =>
        Assert.Null(ContainerCommands.FindItemInContainer(_state, Combo(null).Element, Args("Item 301")));

    [Fact]
    public void NameMatchingOnlyIgnoringCase_ReturnsNull() =>
        Assert.Null(ContainerCommands.FindItemInContainer(_state, Combo(Item("Toys").Element).Element, Args("toys")));

    [Fact]
    public void MatchThatIsNotAnEntry_ReturnsNull() =>
        Assert.Null(ContainerCommands.FindItemInContainer(
            _state, Combo(Item("Books", UIA.TextControlTypeId).Element).Element, Args("Books")));

    [Fact]
    public void ContainerWithoutPattern_ReturnsNull() =>
        Assert.Null(ContainerCommands.FindItemInContainer(_state, new FakeElement().Element, Args("Books")));
}
