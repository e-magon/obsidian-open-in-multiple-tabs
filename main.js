/* jshint esversion: 6 */

'use strict';

const { addIcon, Menu, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, View } = require('obsidian');

const DEFAULT_SETTINGS = {
	allowSingleClickOpenFolder: false,
	allowSingleClickOpenFolderAction: 'disabled',
	defaultSortOrder: 'alphabetical',
	excludedNames: [],
	extraFileTypes: [],
	includeBlockLinks: false,
	includeEmbeddedFiles: false,
	includedFileTypes: ['markdown'],
	indexFilesAtTop: true,
	maximumItemsToOpen: 10,
	openFoldersRecursively: false,
	warnOnReplace: false
};

/** Sort orders shared by the sort menus, the sort commands and the default sort order setting */
const SORT_ORDERS = [
	{
		key: 'fileExplorer',
		title: 'File Explorer order',
		command: 'file explorer order',
		icon: 'list'
	},
	{
		key: 'alphabetical',
		title: 'File name (A to Z)',
		command: 'file name (A to Z)',
		icon: 'arrowDownAZ'
	},
	{
		key: 'alphabeticalReverse',
		title: 'File name (Z to A)',
		command: 'file name (Z to A)',
		icon: 'arrowDownZA'
	},
	{
		key: 'byModifiedTime',
		title: 'Modified time (new to old)',
		command: 'modified time (new to old)',
		icon: 'arrowDown10'
	},
	{
		key: 'byModifiedTimeReverse',
		title: 'Modified time (old to new)',
		command: 'modified time (old to new)',
		icon: 'arrowDown01'
	},
	{
		key: 'byCreatedTime',
		title: 'Created time (new to old)',
		command: 'created time (new to old)',
		icon: 'arrowDown10'
	},
	{
		key: 'byCreatedTimeReverse',
		title: 'Created time (old to new)',
		command: 'created time (old to new)',
		icon: 'arrowDown01'
	}
];

/** Open actions shared by the menus, the commands and the single-click setting; `{{type}}` names the opened items */
const OPEN_ACTIONS = [
	{
		action: 'append',
		title: 'Append {{type}} in active tab group',
		icon: 'appendFolder'
	},
	{
		action: 'replace',
		title: 'Replace active tab group with {{type}}',
		icon: 'replaceFolder'
	},
	{
		action: 'open-left',
		title: 'Open {{type}} in new split left',
		icon: 'panel-left-close'
	},
	{
		action: 'open-right',
		title: 'Open {{type}} in new split right',
		icon: 'panel-right-close'
	},
	{
		action: 'open-up',
		title: 'Open {{type}} in new split up',
		icon: 'panel-top-close'
	},
	{
		action: 'open-down',
		title: 'Open {{type}} in new split down',
		icon: 'panel-bottom-close'
	}
];

/** Extensions of each file type the "Include ..." settings can turn on */
const FILE_TYPE_EXTENSIONS = {
	markdown: ['md'],
	base: ['base'],
	images: ['avif', 'bmp', 'jpg', 'jpeg', 'gif', 'png', 'svg', 'webp'],
	canvas: ['canvas'],
	media: ['aac', 'aif', 'aiff', 'ape', 'flac', 'm4a', 'mka', 'mp3', 'ogg', 'opus', 'wav', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'webm'],
	pdf: ['pdf']
};

/** Icons missing from Obsidian's Lucide set, registered by name in onload */
const ICONS = {
	appendFolder: `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-down" version="1.1" id="svg2" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"> <defs id="defs2" /> <rect width="18" height="18" x="3" y="3" rx="2" id="rect1" /> <path d="m 12,8 v 8" id="path1" /> <path d="m 8,12 4,4 4,-4" id="path2" /> <path d="M 15.999999,8 H 8" id="path1-2" /></svg>`,
	replaceFolder: `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-down" version="1.1" id="svg2" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"> <defs id="defs2" /> <rect width="18" height="18" x="3" y="3" rx="2" id="rect1" /> <path d="m 8,14 4,4 4,-4" id="path2" /> <path d="m 8,9.9999586 4,-4 4,4" id="path2-3" /></svg>`,
	arrowDownAZ: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-az-icon lucide-arrow-down-a-z"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/></svg>`,
	arrowDownZA: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-za-icon lucide-arrow-down-z-a"><path d="m3 16 4 4 4-4"/><path d="M7 4v16"/><path d="M15 4h5l-5 6h5"/><path d="M15 20v-3.5a2.5 2.5 0 0 1 5 0V20"/><path d="M20 18h-5"/></svg>`,
	arrowDown01: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down01-icon lucide-arrow-down-0-1"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><rect x="15" y="4" width="4" height="6" ry="2"/><path d="M17 20v-6h-2"/><path d="M15 20h4"/></svg>`,
	arrowDown10: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down10-icon lucide-arrow-down-1-0"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M17 10V4h-2"/><path d="M15 10h4"/><rect x="15" y="14" width="4" height="6" ry="2"/></svg>`
};

/**
 * Opens File Explorer items, document links, query block links and search results as ordinary tabs,
 * and sorts the tabs of a tab group
 */
class OpenInMultipleTabsPlugin extends Plugin {
	/**
	 * Loads the settings, then registers the icons, DOM listeners, menus and commands
	 */
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new OpenInMultipleTabsSettings(this.app, this));

		// The helpers below read these once: nothing reassigns them, the settings tab only mutates `settings`
		const { app, settings } = this;
		const { metadataCache, vault, workspace } = app;

		for ( const [name, svg] of Object.entries(ICONS) ) {
			addIcon(name, svg);
		}

		/**
		 * Returns the tab group of the most recent leaf in the main area, so sidebars never receive the opened tabs
		 * @returns {WorkspaceTabs | undefined} the target tab group
		 */
		function getTargetGroup() {
			return workspace.getMostRecentLeaf(workspace.rootSplit)?.parent;
		}

		/**
		 * Returns the files a single click on a File Explorer item opens
		 * @param {MouseEvent} event - the mouseup on a File Explorer item
		 * @returns {(TFile | TFolder | null)[]} the clicked file, or the items of the clicked folder
		 */
		function getFileExplorerItems(event) {
			function getItemPath(itemEl) {
				return itemEl?.querySelector('.nav-file-title')?.dataset?.path || itemEl?.dataset?.path;
			}

			if ( !/folder/.test(event.target.className) ) {
				return [vault.getFileByPath(getItemPath(event.target.closest('.nav-file-title.tree-item-self')))];
			}

			const folderEl = event.target.closest('.nav-folder.tree-item');
			// Only an expanded folder has a children element, listed in the order the File Explorer shows
			const childrenEl = folderEl?.querySelector('.tree-item-children.nav-folder-children');
			if ( childrenEl && settings.openFoldersRecursively && settings.defaultSortOrder === 'fileExplorer' ) {
				return Array.from(childrenEl.querySelectorAll('.tree-item.nav-file'), (itemEl) => vault.getFileByPath(getItemPath(itemEl)));
			}

			const folderItems = vault.getFolderByPath(folderEl?.querySelector('.tree-item-self.nav-folder-title')?.dataset.path)?.children || [];
			if ( settings.openFoldersRecursively ) {
				return getFileExplorerItemsRecursively(folderItems, []);
			}
			return ( childrenEl ? folderItems : [] );
		}

		/**
		 * Collects the files of a list of items, descending into folders
		 * @param {Iterable<TAbstractFile | null>} items - files and folders, null entries are skipped
		 * @param {TFile[]} returnedItems - the accumulator the files are pushed into
		 * @returns {TFile[]} the accumulator
		 */
		function getFileExplorerItemsRecursively(items, returnedItems) {
			for ( const item of items ) {
				if ( item instanceof TFolder ) {
					getFileExplorerItemsRecursively(item.children, returnedItems);
				} else if ( item instanceof TFile ) {
					returnedItems.push(item);
				}
			}
			return returnedItems;
		}

		/**
		 * Returns the link targets of a note: its links, optionally its embeds and the links of its query blocks
		 * @param {TFile | undefined} file - the note
		 * @param {WorkspaceLeaf} leaf - the leaf showing the note, searched for rendered query blocks
		 * @returns {string[] | undefined} vault paths or link texts, undefined without a file
		 */
		function getDocumentLinks(file, leaf) {
			if ( !file ) {
				return undefined;
			}

			const fileCache = metadataCache.getFileCache(file);
			const linkGroups = [fileCache?.links?.map((link) => link?.link) || []];
			if ( settings.includeEmbeddedFiles === true ) {
				linkGroups.push(fileCache?.embeds?.map((embed) => embed?.link) || []);
			}
			if ( settings.includeBlockLinks === true ) {
				const queryBlocks = leaf.view?.editor?.containerEl?.querySelectorAll('.block-language-folder-overview,.block-language-dataview,.internal-query .search-result-container') || [];
				for ( const queryBlock of queryBlocks ) {
					const anchors = queryBlock.querySelectorAll('a');
					// Folder overview and Dataview blocks render anchors, core query blocks only render result titles
					if ( anchors.length > 0 ) {
						linkGroups.push(Array.from(anchors, (anchor) => anchor.href));
					} else {
						const results = queryBlock.querySelectorAll('.search-result-container .tree-item-inner span:nth-of-type(2)');
						linkGroups.push(Array.from(results, (result) => result?.innerText));
					}
				}
			}

			// Anchor hrefs resolve against the app origin, so only the part after `//obsidian.md/` is a vault path
			return linkGroups.flat()
				.filter((link) => link)
				.map((link) => normalizePath(link.split('//obsidian.md/').reverse()[0].replace(/%20/g, ' ')));
		}

		/**
		 * Resolves links to files, first as vault paths, then as link texts
		 * @param {string[] | undefined} links - vault paths or link texts
		 * @returns {(TFile | null)[]} one entry per link, null when it does not resolve
		 */
		function getFilesFromLinks(links) {
			return (links || []).map((link) => vault.getFileByPath(link) || metadataCache.getFirstLinkpathDest(link, ''));
		}

		/**
		 * Drops the files whose path already appeared, keeping the first occurrence
		 * @param {TFile[]} files - the files to dedupe
		 * @returns {TFile[]} the files in their original order
		 */
		function uniqueByPath(files) {
			const seenPaths = new Set();
			return files.filter((file) => {
				if ( seenPaths.has(file.path) ) {
					return false;
				}
				seenPaths.add(file.path);
				return true;
			});
		}

		/**
		 * Returns the files listed by the Search pane, in the order it shows them
		 * @returns {TFile[]} the unique result files
		 */
		function getSearchResultFiles() {
			const activeLeaf = workspace.getActiveViewOfType(View)?.leaf;
			// The active view, from a note, has no search DOM, so the Search pane is used instead
			const searchLeaf = ( activeLeaf?.view?.getViewType?.() === 'search' ? activeLeaf : workspace.getLeavesOfType('search')[0] );
			const searchDom = searchLeaf?.view?.dom;
			// Both getFiles() and vChildren are undocumented, hence the fallback
			const files = ( searchDom?.getFiles ? searchDom.getFiles() : searchDom?.vChildren?._children?.map((item) => item.file) || [] );
			return uniqueByPath(files.filter((file) => file instanceof TFile));
		}

		/**
		 * Picks the sort order for a set of items
		 * @param {string} type - a SORT_ORDERS key for a manual sort, else the label of the opened items
		 * @returns {string} a SORT_ORDERS key, or 'none' to keep the listed order
		 */
		function getSortOrder(type) {
			const fileExplorerSortOrder = workspace.getLeavesOfType('file-explorer')[0]?.view?.sortOrder;
			if ( SORT_ORDERS.some((entry) => entry.key === type) ) {
				return type;
			}
			// A custom File Explorer order comes from another plugin and cannot be reproduced here
			if ( fileExplorerSortOrder === 'custom' ) {
				return 'none';
			}
			// Search results, links and Longform scenes already come in a meaningful order
			if ( /search|links|longform/i.test(type) ) {
				return 'none';
			}
			if ( settings.defaultSortOrder !== undefined && settings.defaultSortOrder !== 'disabled' ) {
				return settings.defaultSortOrder;
			}
			return fileExplorerSortOrder || 'alphabetical';
		}

		/**
		 * Sorts the items and optionally moves index files to the top
		 * @param {MouseEvent | undefined} event - the File Explorer click, needed to tell whether its folder is expanded
		 * @param {TFile[]} items - the files to sort
		 * @param {string} sortOrder - a SORT_ORDERS key or 'none'
		 * @returns {TFile[]} a new sorted array, or the items themselves for 'none' and 'fileExplorer'
		 */
		function sortItemsByOrder(event, items, sortOrder) {
			function byPath(a, b) {
				return `${a.parent.path}/${a.basename}`.localeCompare(`${b.parent.path}/${b.basename}`, navigator.language, { numeric: true });
			}
			const comparators = {
				alphabetical: byPath,
				alphabeticalReverse: (a, b) => byPath(b, a),
				byModifiedTime: (a, b) => b.stat?.mtime - a.stat?.mtime,
				byModifiedTimeReverse: (a, b) => a.stat?.mtime - b.stat?.mtime,
				byCreatedTime: (a, b) => b.stat?.ctime - a.stat?.ctime,
				byCreatedTimeReverse: (a, b) => a.stat?.ctime - b.stat?.ctime
			};

			// File Explorer order is read from the DOM, which a collapsed folder or a command does not provide
			const isCollapsed = ( !event || event.target.closest('.tree-item.nav-folder')?.querySelector('.tree-item-children.nav-folder-children') === null );
			const effectiveSortOrder = ( isCollapsed && sortOrder === 'fileExplorer' ? 'alphabetical' : sortOrder );
			const comparator = ( Object.hasOwn(comparators, effectiveSortOrder) ? comparators[effectiveSortOrder] : undefined );
			// An order without a comparator (a stale setting, a File Explorer order from another plugin) opens nothing
			if ( !comparator && effectiveSortOrder !== 'none' && effectiveSortOrder !== 'fileExplorer' ) {
				return [];
			}
			const sorted = ( comparator ? items.toSorted(comparator) : items );

			if ( settings.indexFilesAtTop !== true || effectiveSortOrder === 'none' ) {
				return sorted;
			}
			function isIndexFile(item) {
				return /^index$/im.test(item.basename) || item.basename === item.parent.name;
			}
			return [...sorted.filter(isIndexFile), ...sorted.filter((item) => !isIndexFile(item))];
		}

		/**
		 * Returns the file a tab shows as a plain file tab
		 * @param {WorkspaceLeaf} leaf - the tab
		 * @returns {TFile | null} the file, or null for a non-file pane
		 */
		function getLeafFile(leaf) {
			// A background tab holds a DeferredView with no file until shown, so the file comes from the view state;
			// a linked pane (local graph, outline) stores a file it does not show, hence the view type check
			const viewState = leaf.getViewState();
			const file = vault.getFileByPath(viewState.state?.file ?? '');
			return ( file && viewState.type === app.viewRegistry.getTypeByExtension(file.extension) ? file : null );
		}

		/**
		 * Reopens the tabs of a tab group in a new order
		 * @param {WorkspaceTabs} tabGroup - the group to sort, in the main area or a sidebar
		 * @param {string} sortOrder - a SORT_ORDERS key
		 */
		function changeSortOrder(tabGroup, sortOrder) {
			if ( !tabGroup || tabGroup.children?.length === 0 ) {
				return;
			}

			// Empty tabs are dropped by the replace anyway, so they never block a sort
			const files = tabGroup.children.filter((leaf) => leaf.getViewState().type !== 'empty').map(getLeafFile);
			if ( files.length === 0 ) {
				return;
			}
			// Sorting reopens every tab, which would close or convert a pane that is not a plain file tab
			if ( files.some((file) => !file) ) {
				new Notice('This tab group contains tabs that cannot be reopened as plain file tabs, so it cannot be sorted.');
				return;
			}

			// The sort menu reads this key to check the current order
			tabGroup.containerEl.dataset.sortOrder = sortOrder;
			openItemsInTabs(files, 'replace-change-sort', sortOrder, tabGroup);
		}

		/**
		 * Filters, dedupes and sorts the items before they are opened
		 * @param {Iterable<TAbstractFile | null>} items - the candidate items
		 * @param {string} action - an OPEN_ACTIONS action, or 'replace-change-sort' for a manual sort
		 * @param {string} type - the label of the items, or a SORT_ORDERS key for a manual sort
		 * @param {WorkspaceTabs} tabGroup - the group the items are opened in
		 * @param {MouseEvent} [event] - the File Explorer click, used for File Explorer order
		 * @returns {TFile[]} the files to open, in order
		 */
		function prepareItems(items, action, type, tabGroup, event) {
			const sortOrder = getSortOrder(type);
			const sourceItems = ( settings.openFoldersRecursively === true ? getFileExplorerItemsRecursively(items, []) : Array.from(items) );

			// A sort keeps every open tab, so the file type and name filters only apply to opens
			const includedExtensions = Object.entries(FILE_TYPE_EXTENSIONS)
				.filter(([fileType]) => settings.includedFileTypes.includes(fileType))
				.flatMap(([, extensions]) => extensions)
				.concat(settings.extraFileTypes)
				.map((extension) => extension.trim());
			const filteredItems = ( /change-sort/.test(action) ? sourceItems : sourceItems.filter((item) => (
				item instanceof TFile
				&& includedExtensions.includes(item.extension)
				&& !settings.excludedNames.includes(`${item.basename}.${item.extension}`)
			)) );

			const uniqueItems = uniqueByPath(filteredItems);

			if ( !/append/.test(action) ) {
				return sortItemsByOrder(event, uniqueItems, sortOrder);
			}
			// Appending a single file that is already open only shows its tab
			if ( uniqueItems.length === 1 ) {
				const openLeaf = tabGroup.children.find((leaf) => getLeafFile(leaf)?.path === uniqueItems[0].path);
				if ( openLeaf ) {
					workspace.setActiveLeaf(openLeaf, { focus: true });
					return [];
				}
			}
			const openPaths = new Set(tabGroup.children.map((leaf) => getLeafFile(leaf)?.path));
			return sortItemsByOrder(event, uniqueItems.filter((item) => !openPaths.has(item.path)), sortOrder);
		}

		/**
		 * Opens the items as tabs: appended to a group, replacing its tabs, or in one new split
		 * @param {Iterable<TAbstractFile | null> | undefined} items - the candidate items
		 * @param {string} action - an OPEN_ACTIONS action, or 'replace-change-sort' for a manual sort
		 * @param {string} type - the label of the items, or a SORT_ORDERS key for a manual sort
		 * @param {WorkspaceTabs} [tabGroup] - the target group, the main area's most recent one by default
		 * @param {MouseEvent} [event] - the File Explorer click, used for File Explorer order
		 * @returns {Promise<void>}
		 */
		async function openItemsInTabs(items, action, type, tabGroup, event) {
			async function openAtEnd(group, files) {
				const leaves = [];
				for ( const file of files ) {
					const leaf = workspace.createLeafInParent(group, group.children.length);
					await leaf.openFile(file, { active: false });
					leaves.push(leaf);
				}
				return leaves;
			}

			if ( !items ) {
				return;
			}
			const targetGroup = tabGroup || getTargetGroup();
			if ( !targetGroup ) {
				return;
			}
			const files = prepareItems(items, action, type, targetGroup, event);
			if ( files.length === 0 ) {
				return;
			}

			// The limit guards against opening huge folders, so it never truncates a sort
			const limit = settings.maximumItemsToOpen;
			const maximumItemsToOpen = ( /change-sort/.test(action) || limit === undefined || limit < 1 ? Infinity : limit );
			const toOpen = files.slice(0, maximumItemsToOpen);
			if ( files.length > maximumItemsToOpen ) {
				new Notice(`Opening ${toOpen.length} of ${files.length} items.`);
			}
			if (
				/replace/.test(action)
				&& !/change-sort/.test(action)
				&& settings.warnOnReplace === true
				&& !window.confirm('You are about to replace all items currently open in the active tab group.\nAre you sure you want to do this?\n\n(This warning can be disabled in the settings.)')
			) {
				return;
			}

			// Every tab opens in the background and only the first one is activated at the end
			if ( /replace/.test(action) ) {
				for ( const leaf of targetGroup.children.slice(1) ) {
					leaf.detach();
				}
				const firstLeaf = targetGroup.children[0];
				if ( firstLeaf ) {
					await firstLeaf.openFile(toOpen[0], { active: false });
				}
				const openedLeaves = await openAtEnd(targetGroup, toOpen.slice(firstLeaf ? 1 : 0));
				workspace.setActiveLeaf(firstLeaf || openedLeaves[0], { focus: false });
				return;
			}
			if ( /append/.test(action) ) {
				const openedLeaves = await openAtEnd(targetGroup, toOpen);
				workspace.setActiveLeaf(openedLeaves[0], { focus: false });
				return;
			}

			// One split holds all the files as tabs
			const referenceLeaf = targetGroup.children.find((leaf) => leaf === workspace.activeLeaf) || targetGroup.children[0];
			if ( !referenceLeaf ) {
				return;
			}
			const splitLeaf = workspace.createLeafBySplit(referenceLeaf, ( /left|right/.test(action) ? 'vertical' : 'horizontal' ), /left|up/.test(action));
			const splitGroup = splitLeaf.parent;
			await splitLeaf.openFile(toOpen[0], { active: false });
			await openAtEnd(splitGroup, toOpen.slice(1));
			workspace.setActiveLeaf(splitLeaf, { focus: true });
		}

		/**
		 * Tells a plain left click from a modified or right click
		 * @param {MouseEvent} event - the mouse event
		 * @returns {boolean} true for a click without modifiers and not with the right button
		 */
		function isPlainClick(event) {
			return !event.altKey && !event.ctrlKey && !event.shiftKey && event.button !== 2;
		}

		this.registerDomEvent(document, 'click', (event) => {
			if ( event.target.closest('.continuous_mode_open_links_button') !== null ) {
				showLinksMenu(event);
			}
		});

		this.registerDomEvent(document, 'mousedown', (event) => {
			if ( event.target.closest('.workspace-tabs.mod-stacked') !== null ) {
				return;
			}
			const isTitle = /nav-folder-title|nav-file-title/.test(event.target.className);
			if ( isTitle && settings.allowSingleClickOpenFolder === true && isPlainClick(event) ) {
				// The item opens on mouseup, so the default click must neither toggle the folder nor open the file
				event.target.closest('.nav-folder-title,.nav-file-title').addEventListener('click', (clickEvent) => clickEvent.preventDefault(), { once: true });
				return;
			}
			if ( (event.buttons === 2 || event.ctrlKey) && event.target.closest('.longform-explorer') !== null ) {
				getLongformItems(event);
			}
		});

		this.registerDomEvent(document, 'mouseup', (event) => {
			const { target } = event;
			if (
				target.closest('.workspace-tabs.mod-stacked') !== null
				|| settings.allowSingleClickOpenFolder !== true
				|| !isPlainClick(event)
			) {
				return;
			}
			// The collapse arrow keeps its default behavior
			const isFolderTitle = (
				/nav-folder-title/.test(target.className)
				&& target.closest('.nav-folder-collapse-indicator') === null
				&& target.closest('.collapse-icon') === null
			);
			if ( !isFolderTitle && !/nav-file-title/.test(target.className) ) {
				return;
			}

			const action = settings.allowSingleClickOpenFolderAction;
			if ( action === 'disabled' ) {
				new Notice('Choose a single click action in the settings.');
				return;
			}
			openItemsInTabs(getFileExplorerItems(event), action, 'file explorer items', getTargetGroup(), event);
		});

		this.registerDomEvent(window, 'mouseover', (event) => {
			function getButtonContainer(target) {
				if ( target.closest('.markdown-reading-view,.markdown-preview-view') !== null ) {
					return target.closest('.block-language-dataview') || target.closest('.internal-query')?.querySelector('.internal-query-header');
				}
				if ( target.closest('.markdown-source-view') !== null ) {
					const codeBlockEl = target.closest('.cm-preview-code-block');
					const headerEl = codeBlockEl?.querySelector('.internal-query-header');
					return ( headerEl !== null ? headerEl : codeBlockEl );
				}
				return undefined;
			}

			// The button opens the links of the hovered query or Dataview block
			const buttonContainerEl = getButtonContainer(event.target);
			if ( buttonContainerEl?.querySelector('.continuous_mode_open_links_button') === null ) {
				const button = buttonContainerEl.createEl('div', { cls: 'continuous_mode_open_links_button clickable-icon' });
				button.setAttribute('aria-label', 'Open in multiple tabs');
				button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
			}
		});

		this.registerEvent(
			workspace.on('file-menu', (menu, file, source, leaf) => {
				const type = ( file instanceof TFolder ? 'folder contents' : file instanceof TFile ? 'file' : undefined );
				if ( /link-context-menu/.test(source) ) {
					addOpenItems(menu, file, 'link', source);
				} else if ( /file-explorer-context-menu/.test(source) ) {
					addOpenItems(menu, file, type, source);
				} else if ( /file-explorer/.test(source) ) {
					// The file-tree-alternative plugin reuses the file-explorer source names
					if ( workspace.getActiveViewOfType(View)?.leaf === workspace.getLeavesOfType('file-tree-view')[0] ) {
						addOpenItems(menu, file, type, source);
					}
				} else if ( /longform/.test(source) ) {
					addOpenItems(menu, getLongformItems(file), 'Longform scenes', source);
				} else {
					// The tab header menu of a note
					addSortItems(menu, leaf?.parent, leaf);
					if ( leaf?.containerEl.closest('.mod-sidedock') === null ) {
						const links = getDocumentLinks(file, leaf) || [];
						if ( links.length > 0 ) {
							addOpenItems(menu, getFilesFromLinks(links), 'document links', source);
						}
					}
				}
			})
		);

		this.registerEvent(
			workspace.on('files-menu', (menu, files, source) => {
				if ( /link-context-menu|file-explorer-context-menu/.test(source) ) {
					addOpenItems(menu, files, 'selected files', source);
				}
			})
		);

		this.registerEvent(
			workspace.on('leaf-menu', (menu, leaf) => {
				if ( leaf !== workspace.getActiveViewOfType(View)?.leaf ) {
					workspace.setActiveLeaf(leaf, { focus: true });
				}
				if ( leaf.containerEl.closest('.mod-left-split,.mod-right-split') ) {
					addSortItems(menu, leaf.parent, leaf);
				}
			})
		);

		this.registerEvent(
			workspace.on('tab-group-menu', (menu, tabGroup) => {
				addSortItems(menu, tabGroup);
			})
		);

		this.registerEvent(
			workspace.on('search:results-menu', (menu) => {
				addOpenItems(menu, getSearchResultFiles(), 'search results');
			})
		);

		/**
		 * Adds one item per sort order, checking the current one
		 * @param {Menu} menu - the menu or submenu to fill
		 * @param {WorkspaceTabs} tabGroup - the group the items sort
		 * @param {HTMLElement} tabGroupEl - the group's element, which stores the current order
		 */
		function addSortActionItems(menu, tabGroup, tabGroupEl) {
			for ( const [index, entry] of SORT_ORDERS.entries() ) {
				// Separators group the orders by name, modified time and created time
				if ( index === 3 || index === 5 ) {
					menu.addSeparator();
				}
				menu.addItem((item) => item
					.setTitle(entry.title)
					.setIcon(entry.icon)
					.setChecked(tabGroupEl?.dataset?.sortOrder === entry.key)
					.onClick(() => changeSortOrder(tabGroup, entry.key))
				);
			}
		}

		/**
		 * Adds the sort items, as a "Sort tabs" submenu on desktop and flat on mobile
		 * @param {Menu} menu - the context menu
		 * @param {WorkspaceTabs | undefined} tabGroup - the group to sort, nothing is added without one
		 * @param {WorkspaceLeaf} [leaf] - the clicked tab, which moves the submenu to the pane section
		 */
		function addSortItems(menu, tabGroup, leaf) {
			const tabGroupEl = tabGroup?.containerEl;
			if ( !tabGroupEl ) {
				return;
			}
			// Mobile menus have no submenus
			if ( app.isMobile === true ) {
				addSortActionItems(menu, tabGroup, tabGroupEl);
				return;
			}
			menu.addItem((item) => {
				if ( tabGroup.children?.length < 2 ) {
					item.setDisabled(true);
				}
				addSortActionItems(item.setTitle('Sort tabs').setIcon('arrow-up-narrow-wide').setSection(( leaf ? 'pane' : 'action' )).setSubmenu(), tabGroup, tabGroupEl);
			});
		}

		/**
		 * Adds one item per open action
		 * @param {Menu} menu - the menu or submenu to fill
		 * @param {Iterable<TAbstractFile | null>} files - the items the actions open
		 * @param {string} type - the label of the items, shown in the item titles
		 */
		function addOpenActionItems(menu, files, type) {
			for ( const [index, entry] of OPEN_ACTIONS.entries() ) {
				// A separator divides the in-group actions from the split actions
				if ( index === 2 ) {
					menu.addSeparator();
				}
				menu.addItem((item) => item
					.setTitle(entry.title.replace('{{type}}', type))
					.setIcon(entry.icon)
					.onClick(() => openItemsInTabs(files, entry.action, type, getTargetGroup()))
				);
			}
		}

		/**
		 * Adds the open items, as an "Open in multiple tabs" submenu, or flat in the mobile menus
		 * @param {Menu} menu - the context menu
		 * @param {TAbstractFile | Iterable<TAbstractFile | null> | undefined} file - a file, a folder or a list of items
		 * @param {string} type - the label of the items, shown in the item titles
		 * @param {string} [source] - the menu source, which decides the mobile layout
		 */
		function addOpenItems(menu, file, type, source) {
			const files = ( file instanceof TFile ? [file] : file instanceof TFolder ? file.children : file );
			if ( !files ) {
				return;
			}
			if ( app.isMobile === true && /file-explorer-context-menu|link-context-menu|links-menu/.test(source) ) {
				addOpenActionItems(menu, files, type);
				return;
			}
			menu.addItem((item) => addOpenActionItems(item.setTitle('Open in multiple tabs').setIcon('files').setSection('open').setSubmenu(), files, type));
		}

		/**
		 * Shows the open menu for the links of the query or Dataview block whose button was clicked
		 * @param {MouseEvent} event - the click on the block's button
		 */
		function showLinksMenu(event) {
			// Each block kind renders its links with different elements
			const linkSources = [
				['.cm-preview-code-block', 'a.internal-link,.search-result .tree-item-inner'],
				['.internal-query', '.search-result .tree-item-inner'],
				['.block-language-dataview', 'a.internal-link']
			];
			const [blockSelector, linkSelector] = linkSources.find(([selector]) => event.target.closest(selector) !== null) || [];
			const links = ( blockSelector ? event.target.closest(blockSelector).querySelectorAll(linkSelector) : [] );
			const files = getFilesFromLinks(Array.from(links, (link) => link.dataset?.href || link.innerText));

			const openLinksMenu = new Menu();
			openLinksMenu.setUseNativeMenu(false);
			addOpenItems(openLinksMenu, files, 'query block links', 'links-menu');
			openLinksMenu.showAtMouseEvent(event);
		}

		/**
		 * Handles the Longform plugin's explorer: shows the open menu for a whole project, or returns the files of a scene
		 * @param {MouseEvent | TFile} object - a click on the project title, or the scene file of a file-menu
		 * @returns {(TFile | null)[] | undefined} for a scene, its file and the files of the scenes nested under it
		 */
		function getLongformItems(object) {
			function getScenePath(scene) {
				return scene.querySelector('.scene-container').getAttribute('data-scene-path');
			}

			const longformExplorer = workspace.getLeavesOfType('VIEW_TYPE_LONGFORM_EXPLORER')[0]?.view.contentEl.children[0];
			if ( !longformExplorer ) {
				return undefined;
			}
			const scenes = Array.from(longformExplorer.querySelectorAll('#scene-list > ul > li'));

			if ( object.target?.classList.contains('current-draft-path') ) {
				const openLongformMenu = new Menu();
				openLongformMenu.setUseNativeMenu(false);
				addOpenItems(openLongformMenu, getFilesFromLinks(scenes.map(getScenePath)), 'Longform project');
				openLongformMenu.showAtMouseEvent(object);
				return undefined;
			}

			const targetIndex = scenes.findIndex((scene) => scene?.querySelector('.scene-container').getAttribute('data-scene-path') === object.path);
			if ( targetIndex === -1 ) {
				return undefined;
			}
			// The scenes nested under the target follow it with a deeper indent
			const targetScene = scenes[targetIndex];
			const selectedScenes = [targetScene];
			for ( const scene of scenes.slice(targetIndex + 1) ) {
				if ( !(scene.dataset.indent > targetScene.dataset.indent) ) {
					break;
				}
				selectedScenes.push(scene);
			}
			return getFilesFromLinks(selectedScenes.map(getScenePath));
		}

		/**
		 * Moves the File Explorer focus to the previous or next item and opens it in the most recent main-area tab
		 * @param {'backwards' | 'forwards'} direction - the direction of the move
		 */
		function navigateInPlace(direction) {
			const tree = workspace.getLeavesOfType('file-explorer')[0]?.view?.tree;
			if ( !tree ) {
				return;
			}
			tree.setFocusedItem(tree.view.activeDom);
			tree.changeFocusedItem(direction);

			const focusedFile = tree.focusedItem?.file;
			if ( focusedFile instanceof TFile ) {
				workspace.getMostRecentLeaf(workspace.rootSplit)?.openFile(focusedFile, { focus: true });
				return;
			}
			// The smooth-explorer plugin expects the folder to be selected in a focused explorer
			if ( focusedFile instanceof TFolder && [...(app.plugins?.enabledPlugins || [])].includes('smooth-explorer') ) {
				tree.selectItem(tree.focusedItem);
				tree.setFocusedItem(tree.focusedItem);
				workspace.setActiveLeaf(tree.view.leaf);
			}
		}

		// The two sources of the document links and search results commands
		const commandSources = [
			{
				type: 'document links',
				slug: 'document-links',
				splitType: 'active document links'
			},
			{
				type: 'search results',
				slug: 'search-results',
				splitType: 'current search results'
			}
		];
		for ( const { action, title } of OPEN_ACTIONS ) {
			const isSplit = action.startsWith('open-');
			const direction = action.replace('open-', '');

			this.addCommand({
				id: ( isSplit ? `open-selected-file-explorer-items-in-new-split-${direction}` : `${action}-selected-file-explorer-items` ),
				name: title.replace('{{type}}', 'selected File Explorer items'),
				callback: () => {
					const tree = workspace.getLeavesOfType('file-explorer')[0]?.view?.tree;
					const focusedItem = tree?.focusedItem?.file || tree?.activeDom?.file;
					if ( !focusedItem ) {
						new Notice('No File Explorer item selected.');
						return;
					}
					openItemsInTabs(( focusedItem instanceof TFolder ? focusedItem.children : [focusedItem] ), action, 'file explorer items', getTargetGroup());
				}
			});

			for ( const { type, slug, splitType } of commandSources ) {
				const ids = {
					append: `append-${slug}-in-active-tab-group`,
					replace: `replace-active-tab-group-with-${slug}`
				};
				this.addCommand({
					id: ids[action] || `open-${slug}-in-new-split-${direction}`,
					name: title.replace('{{type}}', ( isSplit ? splitType : type )),
					callback: () => {
						if ( type === 'search results' ) {
							openItemsInTabs(getSearchResultFiles(), action, type, getTargetGroup());
							return;
						}
						const leaf = workspace.getActiveViewOfType(View)?.leaf;
						openItemsInTabs(getFilesFromLinks(getDocumentLinks(leaf?.view?.file, leaf)), action, type, getTargetGroup());
					}
				});
			}
		}

		for ( const { key, command } of SORT_ORDERS ) {
			this.addCommand({
				id: `sort-files-${key}`,
				name: `Sort active tab group by ${command}`,
				callback: () => changeSortOrder(workspace.activeTabGroup, key)
			});
		}

		for ( const direction of ['previous', 'next'] ) {
			this.addCommand({
				id: `open-${direction}-file-explorer-item-in-place`,
				name: `Open ${direction} File Explorer item in place`,
				callback: () => navigateInPlace(( direction === 'previous' ? 'backwards' : 'forwards' ))
			});
		}
	}

	/**
	 * Removes the sort order keys and the injected block buttons
	 */
	onunload() {
		for ( const tabGroupEl of this.app.workspace.containerEl.querySelectorAll('.workspace-tabs') ) {
			delete tabGroupEl.dataset.sortOrder;
		}
		for ( const button of document.querySelectorAll('.continuous_mode_open_links_button') ) {
			button.remove();
		}
	}

	/**
	 * Loads the settings over the defaults and drops the keys of removed features
	 * @returns {Promise<void>}
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		for ( const key of Object.keys(this.settings) ) {
			if ( !Object.hasOwn(DEFAULT_SETTINGS, key) ) {
				delete this.settings[key];
			}
		}
		// Names saved with spaces would never match a file name
		this.settings.excludedNames = this.settings.excludedNames.map((name) => name.trim()).filter(Boolean);
		if ( this.settings.includedFileTypes.length === 0 ) {
			this.settings.includedFileTypes.push('markdown');
			await this.saveSettings();
		}
	}

	/**
	 * Saves the settings
	 * @returns {Promise<void>}
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * The plugin's settings tab
 */
class OpenInMultipleTabsSettings extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl, plugin } = this;
		const { settings } = plugin;
		containerEl.empty();

		/**
		 * Adds a toggle row
		 * @param {string} name - the row title
		 * @param {string | null} description - the row description, none when null
		 * @param {string[]} classNames - the indentation and show/hide classes of the row
		 * @param {boolean} value - the current value
		 * @param {(value: boolean) => Promise<void>} onChange - stores the new value
		 */
		function addToggleRow(name, description, classNames, value, onChange) {
			const setting = new Setting(containerEl).setName(name);
			if ( description !== null ) {
				setting.setDesc(description);
			}
			for ( const className of classNames ) {
				setting.setClass(className);
			}
			setting.addToggle((toggle) => toggle.setValue(value).onChange(onChange));
		}

		/**
		 * Stores one setting and saves the settings
		 * @param {string} key - a DEFAULT_SETTINGS key
		 * @param {unknown} value - the new value
		 * @returns {Promise<void>}
		 */
		async function saveSetting(key, value) {
			settings[key] = value;
			await plugin.saveSettings();
		}

		/**
		 * Adds or removes one file type; an empty list falls back to markdown and redraws the toggles to show it
		 * @param {string} fileType - a FILE_TYPE_EXTENSIONS key
		 * @param {boolean} value - whether the type is included
		 * @returns {Promise<void>}
		 */
		const setFileType = async (fileType, value) => {
			const index = settings.includedFileTypes.indexOf(fileType);
			if ( value === true && index === -1 ) {
				settings.includedFileTypes.push(fileType);
			}
			if ( value === false && index !== -1 ) {
				settings.includedFileTypes.splice(index, 1);
			}
			const isEmpty = ( settings.includedFileTypes.length === 0 );
			if ( isEmpty ) {
				settings.includedFileTypes.push('markdown');
			}
			await plugin.saveSettings();
			if ( isEmpty ) {
				this.display();
			}
		};

		new Setting(containerEl)
			.setName('1. File handling')
			.setHeading()
			.setDesc('These settings choose which items are opened as tabs when clicking File Explorer items, or when using the commands and context menus. Turning a file type off here does not prevent you from opening that type manually.');

		const fileTypeRows = [
			['markdown', 'Include markdown', 'Default.'],
			['images', 'Include images', 'Natively supported file types: avif, bmp, gif, jpg, png, svg, webp.'],
			['base', 'Include base files', null],
			['canvas', 'Include canvas files', null],
			['media', 'Include media', 'Natively supported file types: aac, aif, aiff, ape, flac, m4a, mka, mp3, ogg, opus, wav, m4v, mkv, mov, mp4, mpeg, webm.'],
			['pdf', 'Include pdfs', null]
		];
		for ( const [fileType, name, description] of fileTypeRows ) {
			addToggleRow(name, description, ['omit-setting-indent'], settings.includedFileTypes.includes(fileType), (value) => setFileType(fileType, value));
		}

		new Setting(containerEl)
			.setName('Include other file extensions')
			.setDesc('If you have installed plugins that allow Obsidian to support file types not listed above, add their extensions here, comma-separated.')
			.setClass('omit-setting-indent')
			.addText((text) => text
				.setPlaceholder('e.g. html, js, py, etc.')
				.setValue(settings.extraFileTypes?.join(',') || '')
				.onChange((value) => saveSetting('extraFileTypes', [...new Set(value.split(','))].filter(Boolean)))
			);

		new Setting(containerEl)
			.setName('Excluded files')
			.setDesc('Exclude files by exact name and extension, for example index.md or draft.canvas. Comma-separated and case-sensitive.')
			.setClass('omit-setting-indent')
			.addText((text) => text
				.setPlaceholder('e.g. index.md, draft.md')
				.setValue(settings.excludedNames?.join(',') || '')
				.onChange((value) => saveSetting('excludedNames', [...new Set(value.split(',').map((name) => name.trim()))].filter(Boolean)))
			);

		addToggleRow('Include embedded files', 'If true, include embedded files when opening all document links as tabs.', ['omit-setting-indent'], settings.includeEmbeddedFiles, (value) => saveSetting('includeEmbeddedFiles', value));
		addToggleRow('Include all Dataview and query block links', 'If true, include links in Dataview and query blocks when opening all document links as tabs. Whether true or false, the links of an individual block can still be opened from its own menu.', ['omit-setting-indent'], settings.includeBlockLinks, (value) => saveSetting('includeBlockLinks', value));

		new Setting(containerEl)
			.setName('2. Opening items')
			.setHeading()
			.setDesc('These settings control how items are opened as tabs.');

		// The CSS shows the `hidden` and `next-hidden` rows only while this toggle is on, so the three rows must stay adjacent
		addToggleRow('Allow single click to open File Explorer items', 'Enable this setting to open items from the File Explorer with a single click. Choose the action below.', ['omit-setting-indent'], settings.allowSingleClickOpenFolder, (value) => saveSetting('allowSingleClickOpenFolder', value));

		new Setting(containerEl)
			.setName('Set default single-click action:')
			.setClass('omit-setting-indent-2')
			.setClass('hidden')
			.addDropdown((dropdown) => {
				dropdown.addOption('disabled', '-');
				for ( const { action, title } of OPEN_ACTIONS ) {
					dropdown.addOption(action, title.replace('{{type}}', 'File Explorer items'));
				}
				dropdown.setValue(( settings.allowSingleClickOpenFolderAction === undefined || settings.allowSingleClickOpenFolder === false ? 'disabled' : settings.allowSingleClickOpenFolderAction ));
				dropdown.onChange(async (value) => {
					settings.allowSingleClickOpenFolderAction = value;
					if ( value !== 'disabled' ) {
						settings.allowSingleClickOpenFolder = true;
					}
					await plugin.saveSettings();
				});
			});

		addToggleRow('Warn on replace', 'Warn when replacing the items of the active tab group with new items.', ['next-hidden', 'omit-setting-indent-2'], settings.warnOnReplace, (value) => saveSetting('warnOnReplace', value));
		addToggleRow('Open folders recursively', 'Recursively open all items in a folder, including those in subfolders. Sorting follows the default sort order setting below. With File Explorer order, items in collapsed folders are ignored, because only the visible files have an order.', ['omit-setting-indent'], settings.openFoldersRecursively, (value) => saveSetting('openFoldersRecursively', value));

		new Setting(containerEl)
			.setName('Maximum number of items to open at one time')
			.setDesc('Leave empty (or set to 0) to open all items at once. A low value lets you append the items of a folder incrementally by clicking it repeatedly with the single-click action set to Append, which is useful for folders with a large number of items.')
			.setClass('omit-setting-indent')
			.addText((text) => text
				.setPlaceholder('10')
				.setValue(settings.maximumItemsToOpen?.toString() || '0')
				.onChange(async (value) => {
					if ( isNaN(Number(value)) || !Number.isInteger(Number(value)) ) {
						new Notice('Please enter a positive integer, 0, or leave the field empty.');
						text.setValue('');
						return;
					}
					await saveSetting('maximumItemsToOpen', Number(value.trim()) || 0);
				})
			);

		new Setting(containerEl)
			.setName('Default sort order:')
			.setDesc('If no value is set, items are sorted according to the current sort order of their source, such as the File Explorer or the search results. File Explorer order honors any custom sorting handled by other plugins and only works with expanded folders.')
			.setClass('omit-setting-indent')
			.addDropdown((dropdown) => {
				dropdown.addOption('disabled', '-');
				for ( const entry of SORT_ORDERS ) {
					dropdown.addOption(entry.key, entry.title);
				}
				dropdown.setValue(( settings.defaultSortOrder === undefined || settings.defaultSortOrder === false ? 'disabled' : settings.defaultSortOrder ));
				dropdown.onChange((value) => saveSetting('defaultSortOrder', value));
			});

		addToggleRow('Index files at top', 'If a directory contains an index.md file, or a file named after the directory itself, move it to the top of the opened tabs regardless of the sort order.', ['omit-setting-indent'], settings.indexFilesAtTop, (value) => saveSetting('indexFilesAtTop', value));
	}
}

module.exports = OpenInMultipleTabsPlugin;
