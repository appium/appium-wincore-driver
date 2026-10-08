# Performance benchmarks

Tracks the cost of the driver's expensive tree-walk paths so regressions are visible
and improvements are documented with numbers.

| suite | fixture | what it measures |
| --- | --- | --- |
| `uia` | `wpf-large` | plain UIA walk (COM property reads + `FindAll` per node, in-process) |

`uia` runs against `wpf-large` because WPF has a **native** UIA provider
(`AutomationPeer`) — that measures the COM tree-walk cost itself, not the MSAA→UIA
bridge tax a WinForms fixture (no native provider) would fold in.

## Running

```bash
# Needs: the sibling fixture repo checked out next to this one and built
#   ../appium-wincore-test-apps  ->  npm run build:wpf-large-test-app
# plus a running Appium server with this driver installed.
npm run test:perf                     # the uia suite
```

Knobs (env):

| var | default | meaning |
| --- | --- | --- |
| `PERF_NODE_COUNT` | `1500` | fixture size (`-DnodeCount` / `--nodes`) |
| `TEST_APPS_DIR` | `../appium-wincore-test-apps` | fixture repo location |

Each run writes `test/perf/results/<suite>-<sha>-<timestamp>.json` (git-ignored) and
prints a table. CI (`.github/workflows/perf-test.yml`, manual + weekly) uploads them.

## The `perfMetrics` capability

Set `appium:perfMetrics: true` at session creation to turn on per-session counters.
Off by default, near-zero cost when on.

```js
await driver.executeScript('windows: resetPerfMetrics', []);
await driver.getPageSource();
const { enabled, metrics } = await driver.executeScript('windows: getPerfMetrics', []);
// metrics = { totalCalls, totalMs, byLabel: { '<label>': { count, totalMs } } }
```

Counter labels by suite:

| suite | labels | `count` is | `totalMs` is |
| --- | --- | --- | --- |
| `uia` | `uia.pageSource.node`, `uia.xpathModel.node` | nodes walked | summed per-node COM-walk time |

## Updating a baseline

`test/perf/baselines/<suite>.json` holds reference-machine p50 milliseconds keyed by
`<op>@<nodeCount>`. `checkRegressions()` fails a run only when a measured p50 exceeds
**3x** the baseline entry; ops absent from the map are recorded but not gated.

To (re)baseline: run the suite on a quiet machine, copy p50 values from the results
file into `baseline`, set `referenceMachine`, commit.

## Results log

`nodeCount=1500` (tree ≈ 1385 nodes). Reference machine: Intel Core 5 120U, 12 cores,
17GB, Windows 11. All figures p50 of 5 iterations after 1 warm-up.

### First baseline — 2026-09-03, sha `05df564` (pre-fix)

Fixtures now show every section at once (a first run against tabbed fixtures only
walked the selected tab, ~280 nodes).

| suite | nodes | getPageSource p50 | findAll `//*` p50 | deep find p50 | walk count | walk time (per run) |
| --- | --- | --- | --- | --- | --- | --- |
| **uia** | 1738 | **8492ms** | 9063ms | 8047ms | 1738 nodes | ~8390ms |

**The bottleneck is the plain UIA walk.** `getPageSource` on a ~1740
node tree is **8.5 seconds** — ~4.8ms/node, and the per-node COM walk is ~99% of that.
Each node does ~20 `get_Current*` property reads + `CurrentBoundingRectangle` +
`FindAll(children)`, every one a cross-process COM round trip, with no caching and no
batching. Scale to ~4000 nodes and you are at ~20s.

Also: every XPath find (`find-anchorLast`) materialises the whole tree first, so it
costs the same as `getPageSource` — for UIA that means an 8s single-element
find.

### uia — plain UIA

Fixture switched from `winforms-large` (MSAA→UIA bridge — measured the bridge, not the
protocol) to `wpf-large` (WPF's native UIA provider). nodeCount=1500 → ~3036 UIA nodes.

Current, `wpf-large` @ sha `9645bd8` (per-level cache request in place):

| op | getPageSource p50 | findAll `//*` | deep find | getAttribute x50 | nodes |
| --- | --- | --- | --- | --- | --- |
| **wpf-large** | **4723ms** | 5979ms | 4472ms | 704ms | 3036 |

~1.5ms/node in the cached walk (3036 `uia.pageSource.node` COM calls ≈ 4.6s of the
4.7s). `getAttribute` x50 is element-scoped (live `GetCurrentPropertyValue`), no tree walk.

Historical, `winforms-large` (1744 nodes) — showed the per-level cache request win:

| Stage | getPageSource p50 | findAll `//*` | deep find | notes |
| --- | --- | --- | --- | --- |
| live (`UIA_NO_CACHE=1`) | 9987ms | 11160ms | 11623ms | ~25 cross-process COM property reads + one FindAll per node |
| + per-level cache request | 4982ms | 5858ms | 5061ms | **−50%** |

`FindAllBuildCache(TreeScope.Children, TrueCondition, req)` per node returns each child
with all ~25 properties already cached, so the property reads become in-process
`GetCachedPropertyValue`. Still one COM call per node for its children (~1744 total)
instead of one FindAll **plus** ~25 property calls (~45k total).

Tried and rejected: a single full-subtree cache request
(`BuildUpdatedCache` / `FindAllBuildCache(TreeScope.Subtree)`). On the WinForms provider
it was both **slower** (~16s — the provider struggles to satisfy a large property set
over a whole subtree) **and incomplete** (cached ~850 of 1744 nodes — offscreen
children not enumerated in a bulk request). The per-level approach matches exactly what
the live walk and native find see. `UIA_NO_CACHE=1` on the server env forces the live
path for A/B. 198 UIA e2e tests green (Calculator/Notepad page source, XPath, attributes).
