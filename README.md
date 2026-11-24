# Open in multiple tabs

A fork of [gasparschott/obsidian-continuous-mode](https://github.com/gasparschott/obsidian-continuous-mode) by Michael Schrauzer. The code started from that plugin, and this fork keeps only its "open many notes at once as tabs" features.

Removed from upstream: the continuous (Scrivenings-style) view, Compact and Semi-Compact modes, arrow-key navigation between notes, typewriter and smooth scrolling, scaled inline titles, hidden tab bars and note headers, tab pinning, saved tab group state, and the 12 commands and 8 settings that drove them.

## What it does

The plugin opens a whole set of notes in one go: the files of a folder, the results of a search, the links of a note, or the links listed by a Dataview or query block. They land as ordinary Obsidian tabs, either added to the active tab group, replacing its tabs, or in one new split. Nothing about the tabs is special: once open, they behave exactly like tabs you opened by hand.

It can also sort the tabs of a tab group by file name, modified time or created time.

## Install

The plugin is not in the community plugin store. The current version is 1.0.0.

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/e-magon/obsidian-open-in-multiple-tabs/releases).
2. Put them in `<your vault>/.obsidian/plugins/open-in-multiple-tabs/`. The folder name must match the manifest `id`.
3. In Obsidian, open Settings -> Community plugins, turn off Restricted mode if it is on, reload the list and enable "Open in multiple tabs".

It needs Obsidian 1.15.0 or later, and it also runs on mobile.

## Usage

Every source offers the same six actions:

| Action | Result |
| --- | --- |
| Append ... in active tab group | Adds the items as tabs after the existing ones. Files already open in the group are skipped, and appending a single file that is already open just switches to its tab |
| Replace active tab group with ... | Closes the group's tabs and opens the items in their place |
| Open ... in new split left / right / up / down | Creates one new split next to the active tab and opens every item in it as a tab |

The actions always target the main area, even when a sidebar has the focus. Only the first opened tab is activated. If there are more items than the "Maximum number of items to open at one time" setting allows, a notice says how many were opened.

### File Explorer: folders and files

- Right-click a folder or a file -> "Open in multiple tabs". On a folder, the actions open its files, and its subfolders' files too if "Open folders recursively" is on.
- Select several files and right-click them to open the selection.
- With "Allow single click to open File Explorer items" on, a plain click on a folder or a file runs the default single-click action instead of Obsidian's default:
  - Clicking the arrow next to a folder still expands or collapses it. Clicking the folder name does not.
  - A collapsed folder opens nothing unless "Open folders recursively" is on, so expand it with the arrow first.
  - With the action left at "-", a click only shows a notice asking you to pick an action, and the item does not open the usual way either.

### Document links

- Right-click a link in a note -> "Open in multiple tabs" opens that link's file.
- The tab header menu of a note (or its "More options" menu) shows "Open in multiple tabs" when the note has links. Embedded files and the links inside its query blocks are included only if the matching settings are on, and query blocks count only while the note is in Live Preview.

### Dataview and query block links

Hover a Dataview block or a query block: a chevron button appears in its corner. Click it to get the "Open in multiple tabs" menu for the files the block lists. In Live Preview, the button appears on every rendered code block, and it lists the links it finds there.

### Search results

In the Search pane, open the results menu (the "..." button) -> "Open in multiple tabs". The results open in the order the Search pane shows them.

### Sorting tabs

The "Sort tabs" submenu reopens the tabs of a group in a new order. On desktop, it is disabled when the group has fewer than two tabs. A checkmark shows the order last applied to the group.

Sorting refuses to run, with a notice, when the group holds a pane that is not a plain file tab (Search, Graph, Outline, a plugin view such as Kanban), because reopening it would close or convert that pane. Empty tabs are dropped.

### Other plugins

- [Longform](https://obsidian.md/plugins?id=longform): right-click or Ctrl-click the project title in the Longform explorer to open the whole project, or right-click a scene to open it with the scenes nested under it. Files open in project order.
- [File Tree Alternative](https://obsidian.md/plugins?id=file-tree-alternative): its file and folder menus get the same "Open in multiple tabs" submenu while its view is the active one.

## Commands

| Command | Acts on |
| --- | --- |
| Append selected File Explorer items in active tab group | The focused File Explorer item: a file, or the files of a folder |
| Replace active tab group with selected File Explorer items | Same |
| Open selected File Explorer items in new split left / right / up / down | Same, one command per direction |
| Append document links in active tab group | The links of the active note |
| Replace active tab group with document links | Same |
| Open active document links in new split left / right / up / down | Same, one command per direction |
| Append search results in active tab group | The results in the Search pane |
| Replace active tab group with search results | Same |
| Open current search results in new split left / right / up / down | Same, one command per direction |
| Sort active tab group by file explorer order | The active tab group (see Limitations) |
| Sort active tab group by file name (A to Z) | The active tab group |
| Sort active tab group by file name (Z to A) | The active tab group |
| Sort active tab group by modified time (new to old) | The active tab group |
| Sort active tab group by modified time (old to new) | The active tab group |
| Sort active tab group by created time (new to old) | The active tab group |
| Sort active tab group by created time (old to new) | The active tab group |
| Open previous File Explorer item in place | Moves the File Explorer focus to the previous item and opens it in the most recent tab of the main area. A folder opens nothing |
| Open next File Explorer item in place | Same, with the next item |

## Context menus

| Where | Menu entry |
| --- | --- |
| File Explorer, a folder or a file | "Open in multiple tabs" with the six actions |
| File Explorer, several selected files | Same |
| A link in a note | Same, for the linked file |
| Tab header or "More options" menu of a note | "Sort tabs", and "Open in multiple tabs" for the note's links |
| Tab group menu | "Sort tabs" |
| Tab header menu of a sidebar tab | "Sort tabs" for that sidebar group |
| Search pane results menu | "Open in multiple tabs" for the results |
| Chevron button of a Dataview, query or code block | "Open in multiple tabs" for the block's links |
| Longform explorer, project title or a scene | "Open in multiple tabs" for the project or the scene |

On mobile, the File Explorer, link, block button and sort menus list the actions directly instead of in a submenu.

## Settings

### File handling

These settings choose which files the actions open. They never stop you from opening a file type by hand.

| Setting | Default | Effect |
| --- | --- | --- |
| Include Markdown / images / base files / canvas files / media / pdfs | Markdown only | The file types to open. Turning every type off turns Markdown back on |
| Include other file extensions | Empty | Extra extensions to open, comma-separated, for file types that other plugins add |
| Excluded files | Empty | Files never opened, by exact name and extension (for example `draft.md`), comma-separated and case-sensitive |
| Include embedded files | Off | Adds a note's embedded files to its document links |
| Include all Dataview and query block links | Off | Adds the links listed by a note's query blocks to its document links. A block's chevron button works either way |

### Opening items

| Setting | Default | Effect |
| --- | --- | --- |
| Allow single click to open File Explorer items | Off | A plain click on a File Explorer item runs the action below |
| Set default single-click action | - | The action a single click runs: append, replace, or one of the four splits. Shown only while the setting above is on |
| Warn on replace | Off | Asks for confirmation before replacing the tabs of a group. Like the action above, it is shown only while single click is on, but it applies to every replace |
| Open folders recursively | Off | Includes the files of subfolders when opening a folder. With File Explorer order and a single click, files in collapsed subfolders are skipped |
| Maximum number of items to open at one time | 10 | Caps how many tabs one action opens. 0 or empty opens everything. Sorting is never capped |
| Default sort order | File name (A to Z) | The order used when opening files. "-" follows the File Explorer's own sort order. Search results, links and Longform scenes keep their own order. Everything opens unsorted, without moving index files, when the File Explorer uses a custom order set by another plugin |
| Index files at top | On | Moves notes named `index` (any case, any extension) and notes named after their folder to the front. Search results, links and Longform scenes keep their own order, and so does everything when the File Explorer uses a custom order |

## Differences from upstream

Besides the removed features listed at the top:

- The tabs are never pinned, and closing or moving them works as usual.
- The actions always open in the main area, even when a sidebar has the focus.
- Sorting refuses to close or convert a pane that is not a plain file tab.
- The plugin has its own id, so it keeps its own settings: nothing is imported from Continuous Mode, and both can be installed side by side.

## Limitations

- File Explorer order only works for a single click on an expanded folder with "Open folders recursively" on, because the order is read from what the File Explorer shows. The sort command, the sort menu, the context menus and a single click on a collapsed folder fall back to file name order. A single click without recursion opens the files of an expanded folder in the vault's internal order, with only the index files moved to the front when "Index files at top" is on.
- The tabs do not follow later changes: moving, adding or deleting files in a folder does not update a group opened from it. Open it again with "Replace".
- The plugin relies on undocumented parts of Obsidian (the Search pane results, the File Explorer tree, the view registry), so an Obsidian update can break a source until the plugin is fixed.
- [Folder Notes](https://obsidian.md/plugins?id=folder-notes) captures clicks on folders, which blocks the single-click action. Changing its folder note keys to a modifier click avoids the conflict.

## Credits and license

Built on [Continuous Mode](https://github.com/gasparschott/obsidian-continuous-mode) by Michael Schrauzer ([gasparschott](https://github.com/gasparschott)). Like the original, it is released under the GNU General Public License v3.0: see [LICENSE](LICENSE).
