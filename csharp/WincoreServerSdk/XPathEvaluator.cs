using System.Xml;
using System.Xml.XPath;
using Wmhelp.XPath2;

namespace Wincore.ServerSdk;

/// <summary>
/// Shared back half of every <c>evaluateXPath</c> path (real UIA and any tree
/// provider). Each caller materialises its runtime's subtree into an
/// <see cref="XmlDocument"/> whose elements carry a node-id attribute, then hands
/// the document here to run the expression through XPath2.Net (XPath 2.0) and map
/// the result nodes back to element-table ids.
///
/// Keeping this in one place means the result-set rules — document order, dedupe,
/// single-vs-multiple, "a non-node-set result is an invalid selector", malformed-XPath
/// handling — are defined once and unit-tested once. Lives in the SDK so an
/// out-of-repo tree provider can reuse the exact same semantics.
/// </summary>
public static class XPathEvaluator
{
    /// <param name="doc">Materialised tree. Element nodes carry <paramref name="idAttr"/>.</param>
    /// <param name="contextNode">
    /// Node to evaluate relative to (for `.//x`, `..`, `self::`, upward axes), or null
    /// to evaluate from the document root.
    /// </param>
    /// <param name="idAttr">Attribute name holding each element's materialisation node id.</param>
    /// <param name="resolve">Maps a node id to the element-table id, or null to drop it.</param>
    /// <returns>Element-table ids in document order (deduped). Empty when nothing matched.</returns>
    public static List<string> Evaluate(
        XmlDocument doc,
        XmlNode? contextNode,
        string idAttr,
        string expression,
        bool multiple,
        Func<string, string?> resolve)
    {
        XPathNavigator nav = (contextNode ?? doc).CreateNavigator()!;

        // Matched elements; deduped by nodeId. A single find keeps only the document-order-first one.
        var matches = new List<(string NodeId, XPathNavigator Nav)>();
        var seen = new HashSet<string>();
        try
        {
            // Lazy sequence: runtime type errors surface while iterating, so keep it inside the try.
            var seq = nav.XPath2Select(expression);
            while (seq.MoveNext())
            {
                var item = seq.Current;
                // W3C: a non-node result (string(...), count(...), …) is an invalid selector.
                if (!item.IsNode)
                    throw new InvalidSelectorException("Invalid XPath expression: the result is not a node set.");
                if (item is not XPathNavigator cur || cur.NodeType != XPathNodeType.Element) continue;
                var xmlEl = ((cur as IHasXmlNode)?.GetNode() ?? cur.UnderlyingObject) as XmlElement;
                var nodeId = xmlEl?.GetAttribute(idAttr);
                if (string.IsNullOrEmpty(nodeId) || !seen.Add(nodeId!)) continue;

                if (multiple || matches.Count == 0)
                {
                    matches.Add((nodeId!, cur.Clone()));
                }
                else if (cur.ComparePosition(matches[0].Nav) == XmlNodeOrder.Before)
                {
                    matches[0] = (nodeId!, cur.Clone());
                }
            }
        }
        // W3C: any error compiling or evaluating the expression is "invalid selector". XPath2.Net
        // wraps syntax errors in XPath2Exception but lets runtime errors (casts, div by zero) escape raw.
        catch (InvalidSelectorException)
        {
            throw;
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            var code = (ex as XPath2Exception)?.ErrorCode;
            throw new InvalidSelectorException(
                $"Invalid XPath expression{(string.IsNullOrEmpty(code) ? "" : $" [{code}]")}: {ex.Message}");
        }

        // XPath 2.0 sequences keep construction order, e.g. `(//b, //a)`; locators expect document
        // order. Path results already are, so only sort when an adjacent pair is out of order.
        if (matches.Count > 1 && !InDocumentOrder(matches))
        {
            matches.Sort((a, b) => a.Nav.ComparePosition(b.Nav) switch
            {
                XmlNodeOrder.Before => -1,
                XmlNodeOrder.After => 1,
                _ => 0,
            });
        }

        var ids = new List<string>();
        var seenIds = new HashSet<string>();
        foreach (var (nodeId, _) in matches)
        {
            var elId = resolve(nodeId);
            if (elId == null || !seenIds.Add(elId)) continue;
            ids.Add(elId);
            if (!multiple) break;
        }

        return ids;
    }

    private static bool InDocumentOrder(List<(string NodeId, XPathNavigator Nav)> matches)
    {
        for (var i = 1; i < matches.Count; i++)
        {
            if (matches[i - 1].Nav.ComparePosition(matches[i].Nav) != XmlNodeOrder.Before) return false;
        }
        return true;
    }
}
