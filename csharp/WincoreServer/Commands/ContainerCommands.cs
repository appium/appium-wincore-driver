using System.Text.Json;
using WincoreServer.State;
using WincoreServer.Uia3;

namespace WincoreServer.Commands;

/// <summary>Entry lookup inside a list-like container, for `windows: selectFromCombobox`.</summary>
public static class ContainerCommands
{
    private static readonly HashSet<int> ItemControlTypes =
    [
        UIA.ListItemControlTypeId,
        UIA.DataItemControlTypeId,
        UIA.TreeItemControlTypeId,
        UIA.MenuItemControlTypeId,
    ];

    /// <summary>
    /// Finds the entry named exactly <c>name</c> through the container's ItemContainerPattern,
    /// which also reaches entries a virtualized list (WPF) has not created yet, and realizes it
    /// so it can be selected.
    /// </summary>
    /// <returns>The entry's element id, or null when the container has no ItemContainerPattern
    /// or no list / data / tree / menu item named exactly <c>name</c>.</returns>
    public static object? FindItemInContainer(SessionState state, IUIAutomationElement element, JsonElement parameters)
    {
        var name = parameters.GetProperty("name").GetString()
                   ?? throw new ArgumentException("'name' must be a string.");

        if (element.GetCurrentPattern(UIA.ItemContainerPatternId) is not IUIAutomationItemContainerPattern container)
            return null;

        var item = container.FindItemByProperty(null, UIA.NamePropertyId, name);
        if (item == null
            || item.GetCurrentPropertyValue(UIA.NamePropertyId) as string != name
            || item.GetCurrentPropertyValue(UIA.ControlTypePropertyId) is not int controlType
            || !ItemControlTypes.Contains(controlType))
            return null;

        (item.GetCurrentPattern(UIA.VirtualizedItemPatternId) as IUIAutomationVirtualizedItemPattern)?.Realize();
        return state.SaveElementAndReturnId(item);
    }
}
