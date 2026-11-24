/* jshint esversion: 6 */

'use strict';

let obsidian = require('obsidian');
const { Notice } = obsidian;

let DEFAULT_SETTINGS = {
	'allowSingleClickOpenFolder': 		false,
	'allowSingleClickOpenFolderAction':	'disabled',
	'defaultSortOrder':					'alphabetical',
	'excludedNames':					[],
	'extraFileTypes':					[],
	'includeBlockLinks':				false,
	'includeEmbeddedFiles':				false,
	'includedFileTypes':				['markdown'],
	'indexFilesAtTop':					true,
	"maximumItemsToOpen":				'10',
	'openFoldersRecursively':			false,
	'warnOnReplace':					false
};

const SORT_ORDERS = [
	{ key: 'fileExplorer',			title: 'File Explorer order',		command: 'file explorer order',	icon: 'list'			},
	{ key: 'alphabetical',			title: 'File name (A to Z)',		command: 'file name (A to Z)',	icon: 'arrowDownAZ'		},
	{ key: 'alphabeticalReverse',	title: 'File name (Z to A)',		command: 'file name (Z to A)',	icon: 'arrowDownZA'		},
	{ key: 'byModifiedTime',		title: 'Modified time (new to old)',command: 'modified time (new to old)',	icon: 'arrowDown10'	},
	{ key: 'byModifiedTimeReverse',	title: 'Modified time (old to new)',command: 'modified time (old to new)',	icon: 'arrowDown01'	},
	{ key: 'byCreatedTime',			title: 'Created time (new to old)',	command: 'created time (new to old)',	icon: 'arrowDown10'	},
	{ key: 'byCreatedTimeReverse',	title: 'Created time (old to new)',	command: 'created time (old to new)',	icon: 'arrowDown01'	}
];

const OPEN_ACTIONS = [
	{ action: 'append',		title: 'Append {{type}} in active tab group',	icon: 'appendFolder'		},
	{ action: 'replace',	title: 'Replace active tab group with {{type}}',	icon: 'replaceFolder'		},
	{ action: 'open-left',	title: 'Open {{type}} in new split left',		icon: 'panel-left-close'	},
	{ action: 'open-right',	title: 'Open {{type}} in new split right',		icon: 'panel-right-close'	},
	{ action: 'open-up',	title: 'Open {{type}} in new split up',			icon: 'panel-top-close'		},
	{ action: 'open-down',	title: 'Open {{type}} in new split down',		icon: 'panel-bottom-close'	}
];

class OpenInMultipleTabsPlugin extends obsidian.Plugin {
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new OpenInMultipleTabsSettings(this.app, this));
		/*-----------------------------------------------*/
		// HELPERS
		const workspace = this.app.workspace;
		const getTargetGroup = () =>			{ return workspace.getMostRecentLeaf(workspace.rootSplit)?.parent; }
		const getFileExplorerItems = (event) => {																						// get the files in their exact File Explorer order
			let type = ( /folder/.test(event.target.className) ? 'folder' : 'file' ), explorerItems, items = [], returnedItems = [];
			let collapsed = !event.target.closest('.nav-folder.tree-item')?.querySelector('.tree-item-children.nav-folder-children');
			let recursive = this.settings.openFoldersRecursively, sortOrder = this.settings.defaultSortOrder;
			switch (type) {
				case 'folder':																				// get folder items according to collapsed state and recursive & sort order settings
					switch (true) {
						case !collapsed && recursive && sortOrder === 'fileExplorer':						// open visible items recursively in File Explorer order
							explorerItems = event.target.closest('.nav-folder.tree-item')?.querySelector('.tree-item-children.nav-folder-children')?.querySelectorAll('.tree-item.nav-file');	break;
						case collapsed && recursive && sortOrder === 'fileExplorer':						// open collapsed items in alphabetical order instead of File Explorer order
						case collapsed && recursive && sortOrder !== 'fileExplorer':						// open all items recursively in sort order
						case !collapsed && recursive && sortOrder !== 'fileExplorer':
							items = this.app.vault.getFolderByPath(event.target.closest('.nav-folder.tree-item')?.querySelector('.tree-item-self.nav-folder-title').dataset.path)?.children || [];
							items = getFileExplorerItemsRecursively(items, returnedItems);					break;
						case !collapsed && !recursive && sortOrder === 'fileExplorer':						// open top level items in File Explorer order
						case !collapsed && !recursive && sortOrder !== 'fileExplorer':
							items = this.app.vault.getFolderByPath(event.target.closest('.nav-folder.tree-item')?.querySelector('.tree-item-self.nav-folder-title').dataset.path)?.children || [];	break;
					}																					break;
				case 'file':
					explorerItems = [event.target.closest('.nav-file-title.tree-item-self')];			break;
			}
			if ( explorerItems !== undefined ) {
				for ( const explorerItem of explorerItems ) {
					items.push(this.app.vault.getFileByPath(explorerItem?.querySelector('.nav-file-title')?.dataset?.path || explorerItem?.dataset?.path));
				}
			}
			return items;
		}
		const getFileExplorerItemsRecursively = (items, returnedItems) => {
			for ( const item of items ) {
				switch (true) {
					case item instanceof obsidian.TFolder: getFileExplorerItemsRecursively(item.children, returnedItems);	break;
					case item instanceof obsidian.TFile:   returnedItems.push(item);										break;
				}
			}
			return returnedItems;
		}
		const getDocumentLinks = (file, leaf) => {																						// get document links and query block links
			if ( !file ) { return }
			let documentLinks = ( this.app.metadataCache?.getFileCache(file)?.links)?.map((link) => link?.link) || [];
			let documentEmbeds = ( this.app.metadataCache?.getFileCache(file)?.embeds)?.map((link) => link?.link) || [];
			if ( this.settings.includeEmbeddedFiles === true ) { documentLinks = documentLinks.concat(documentEmbeds); }
			let queryLinks, queryBlockLinks = [];
			let queryBlocks = leaf.view?.editor?.containerEl?.querySelectorAll('.block-language-folder-overview,.block-language-dataview,.internal-query .search-result-container');
			for ( let i = 0; i < queryBlocks?.length; i++ ) {
				queryLinks = [];
				const anchors = queryBlocks[i].querySelectorAll('a');
				const results = queryBlocks[i].querySelectorAll('.search-result-container .tree-item-inner span:nth-of-type(2)');
				if ( anchors.length > 0 ) {
					for ( const anchor of anchors ) { queryLinks.push(anchor.href) }
				} else {
					for ( const queryResult of results ) { queryLinks.push(queryResult?.innerText) }
				}
				queryBlockLinks.push(queryLinks);
			}
			if ( this.settings.includeBlockLinks === true ) { documentLinks = documentLinks.concat(queryBlockLinks).flat(); }
			return documentLinks.filter((link) => link).map((link) => obsidian.normalizePath(link.split('//obsidian.md/').reverse()[0].replace(/%20/g, ' ')));
		}
		const getFilesFromLinks = (documentLinks) => {																					// get files from links
			let files = [];
			if ( documentLinks ) {
				for ( const link of documentLinks ) {
					files.push(this.app.vault.getFileByPath(link) || this.app.metadataCache.getFirstLinkpathDest(link, ''));
				}
			}
			return files;
		}
		const getSearchResultFiles = () => {																							// get the files listed in the search pane
			const activeLeaf = workspace.getActiveViewOfType(obsidian.View)?.leaf;
			const searchLeaf = ( activeLeaf?.view?.getViewType?.() === 'search' ? activeLeaf : workspace.getLeavesOfType('search')[0] );
			const view = searchLeaf?.view;
			if ( !view ) { return [] }
			const domFiles = ( view.dom?.getFiles ? view.dom.getFiles() : view.dom?.vChildren?._children?.map((item) => item.file) || [] );
			const seen = new Set(), files = [];
			for ( const file of domFiles ) {
				if ( file instanceof obsidian.TFile && !seen.has(file.path) ) { seen.add(file.path); files.push(file) }
			}
			return files;
		}
		/*-----------------------------------------------*/
		// SORT ITEMS
		const getSortOrder = (type) => {
			const fileExplorerSortOrder = workspace.getLeavesOfType('file-explorer')[0]?.view?.sortOrder;
			switch (true) {
				case ( /fileExplorer|alphabetical|alphabeticalReverse|byModifiedTime|byModifiedTimeReverse|byCreatedTime|byCreatedTimeReverse/i.test(type) ):
					return type;																										// explicit sort order
				case fileExplorerSortOrder === 'custom':
					return 'none';																										// honor custom File Explorer order
				case ( /search|links|longform/i.test(type) ):
					return 'none';																										// keep listed order
				case this.settings.defaultSortOrder !== undefined && this.settings.defaultSortOrder !== 'disabled':
					return this.settings.defaultSortOrder;																				// default sort order from settings
				default:
					return fileExplorerSortOrder || 'alphabetical';
			}
		}
		const sortItemsByOrder = (event, items, sortOrder) => {
			let sorted = [];
			const collapsedFolder = ( !event || event.target.closest('.tree-item.nav-folder')?.querySelector('.tree-item-children.nav-folder-children') === null );
			if ( collapsedFolder && sortOrder === 'fileExplorer' ) { sortOrder = 'alphabetical' }							// visible order is unavailable for a collapsed folder
			switch (sortOrder) {
				case 'alphabetical':			sorted = items.toSorted((a, b) => (a.parent.path + '/' + a.basename).localeCompare((b.parent.path + '/' + b.basename), navigator.language, { numeric: true }));	break;
				case 'alphabeticalReverse':		sorted = items.toSorted((a, b) => (b.parent.path + '/' + b.basename).localeCompare((a.parent.path + '/' + a.basename), navigator.language, { numeric: true }));	break;
				case 'byModifiedTime':			sorted = items.toSorted((a, b) => (b.stat?.mtime) - (a.stat?.mtime));				break;
				case 'byModifiedTimeReverse':	sorted = items.toSorted((a, b) => (a.stat?.mtime) - (b.stat?.mtime));				break;
				case 'byCreatedTime':			sorted = items.toSorted((a, b) => (b.stat?.ctime) - (a.stat?.ctime));				break;
				case 'byCreatedTimeReverse':	sorted = items.toSorted((a, b) => (a.stat?.ctime) - (b.stat?.ctime));				break;
				case 'fileExplorer':
				case 'none':					sorted = items;																	break;
			}
			if ( this.settings.indexFilesAtTop === true && sortOrder !== 'none' ) {											// move index files to the top
				const isIndexFile = (item) => ( /^index$/im.test(item.basename) || item.basename === item.parent.name );
				const index = sorted.filter(isIndexFile);
				const nonindex = sorted.filter((item) => !isIndexFile(item));
				sorted = [...index, ...nonindex];
			}
			return sorted;
		}
		// Returns the file a tab shows, or null for a non-file pane; a background tab holds a DeferredView with no file
		// until shown, and a linked pane (local graph, outline) stores a file it does not show, hence the view type check
		const getLeafFile = (leaf) => {
			const viewState = leaf.getViewState();
			const file = this.app.vault.getFileByPath(viewState.state?.file ?? '');
			return ( file && viewState.type === this.app.viewRegistry.getTypeByExtension(file.extension) ? file : null );
		};
		const changeSortOrder = (tabGroup, sortOrder) => {																	// manually change sort order
			if ( !tabGroup || tabGroup.children?.length === 0 ) { return }
			const leaves = tabGroup.children.filter((leaf) => leaf.getViewState().type !== 'empty');				// empty tabs are dropped by the replace
			const files = leaves.map(getLeafFile);
			if ( files.length === 0 ) { return }
			if ( files.some((file) => !file) ) {																// a non-file pane cannot be reordered without closing it
				new Notice('This tab group contains tabs that cannot be reopened as plain file tabs, so it cannot be sorted.');
				return;
			}
			tabGroup.containerEl.dataset.sortOrder = sortOrder;															// submenu checkmarks read this key
			openItemsInTabs(files, 'replace-change-sort', sortOrder, tabGroup);
		};
		const prepareItems = (items, action, type, tabGroup, event) => {													// filter, dedupe, sort the items before opening them
			if ( this.settings.openFoldersRecursively === true ) { items = getFileExplorerItemsRecursively(items, []) }
			const sortOrder = getSortOrder(type);
			const extensions = {
				markdown:	['md'],
				base:		['base'],
				images:		['avif', 'bmp', 'jpg', 'jpeg', 'gif', 'png', 'svg', 'webp'],
				canvas:		['canvas'],
				media:		['aac', 'aif', 'aiff', 'ape', 'flac', 'm4a', 'mka', 'mp3', 'ogg', 'opus', 'wav', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'webm'],
				pdf:		['pdf']
			};
			let includedExtensions = [];
			for ( const [key, value] of Object.entries(extensions) ) {
				if ( this.settings.includedFileTypes.includes(key) ) { includedExtensions.push(value) }
			}
			includedExtensions = includedExtensions.concat(this.settings.extraFileTypes).flat(Infinity).map((extension) => extension.trim());
			if ( !/change-sort/.test(action) ) {
				items = Array.from(items).filter((item) =>
					item instanceof obsidian.TFile																			// item must be a TFile
					&& includedExtensions.includes(item.extension)															// item must be an included file type
					&& !this.settings.excludedNames.includes(`${item.basename}.${item.extension}`)							// item must not be excluded by name
				);
			}
			const seenPaths = new Set();
			items = items.filter((item) => {
				if ( seenPaths.has(item.path) ) { return false }
				seenPaths.add(item.path);
				return true;
			});
			if ( /append/.test(action) ) {
				if ( items.length === 1 ) {																				// appending one item that is already open: just show it
					const found = tabGroup.children.find((leaf) => getLeafFile(leaf)?.path === items[0].path);
					if ( found ) { workspace.setActiveLeaf(found, { focus: true }); return [] }
				}
				const openPaths = new Set(tabGroup.children.map((leaf) => getLeafFile(leaf)?.path));
				items = items.filter((item) => !openPaths.has(item.path));
			}
			return sortItemsByOrder(event, items, sortOrder);
		}
		/*-----------------------------------------------*/
		// ICONS
		const icons = {
			appendFolder: `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-down" version="1.1" id="svg2" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"> <defs id="defs2" /> <rect width="18" height="18" x="3" y="3" rx="2" id="rect1" /> <path d="m 12,8 v 8" id="path1" /> <path d="m 8,12 4,4 4,-4" id="path2" /> <path d="M 15.999999,8 H 8" id="path1-2" /></svg>`,
			replaceFolder: `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-down" version="1.1" id="svg2" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"> <defs id="defs2" /> <rect width="18" height="18" x="3" y="3" rx="2" id="rect1" /> <path d="m 8,14 4,4 4,-4" id="path2" /> <path d="m 8,9.9999586 4,-4 4,4" id="path2-3" /></svg>`,
			arrowDownAZ: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-az-icon lucide-arrow-down-a-z"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/></svg>`,
			arrowDownZA: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-za-icon lucide-arrow-down-z-a"><path d="m3 16 4 4 4-4"/><path d="M7 4v16"/><path d="M15 4h5l-5 6h5"/><path d="M15 20v-3.5a2.5 2.5 0 0 1 5 0V20"/><path d="M20 18h-5"/></svg>`,
			arrowDown01: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down01-icon lucide-arrow-down-0-1"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><rect x="15" y="4" width="4" height="6" ry="2"/><path d="M17 20v-6h-2"/><path d="M15 20h4"/></svg>`,
			arrowDown10: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down10-icon lucide-arrow-down-1-0"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M17 10V4h-2"/><path d="M15 10h4"/><rect x="15" y="14" width="4" height="6" ry="2"/></svg>`
		}
		const addIcons = () => {
			for ( const key of Object.keys(icons) ) { (0, obsidian.addIcon)(key, icons[key]) }
		};
		addIcons();
		/*-----------------------------------------------*/
		// OPEN ITEMS IN TABS
		const openItemsInTabs = async (items, action, type, tabGroup, event) => {
			if ( !items ) { return }
			const targetGroup = tabGroup || getTargetGroup();
			if ( !targetGroup ) { return }
			const files = prepareItems(items, action, type, targetGroup, event);
			if ( files.length === 0 ) { return }
			const maximumItemsToOpen = ( /change-sort/.test(action) || this.settings.maximumItemsToOpen < 1 || this.settings.maximumItemsToOpen === undefined ? Infinity : this.settings.maximumItemsToOpen );
			const toOpen = files.slice(0, maximumItemsToOpen);
			if ( files.length > maximumItemsToOpen ) { new Notice(`Opening ${toOpen.length} of ${files.length} items.`) }
			if ( /replace/.test(action) && !/change-sort/.test(action) && this.settings.warnOnReplace === true
				&& !window.confirm('You are about to replace all items currently open in the active tab group.\nAre you sure you want to do this?\n\n(This warning can be disabled in the settings.)') ) { return }
			const openedLeaves = [];
			switch (true) {
				case ( /replace/.test(action) ): {																	// open tabs in the target group
					for ( const leaf of targetGroup.children.slice(1) ) { leaf.detach() }
					const firstLeaf = targetGroup.children[0];
					if ( firstLeaf ) {
						await firstLeaf.openFile(toOpen[0], { active: false });
						openedLeaves.push(firstLeaf);
					}
					for ( const file of toOpen.slice(firstLeaf ? 1 : 0) ) {
						const leaf = workspace.createLeafInParent(targetGroup, targetGroup.children.length);
						await leaf.openFile(file, { active: false });
						openedLeaves.push(leaf);
					}
					workspace.setActiveLeaf(openedLeaves[0], { focus: false });									break;
				}
				case ( /append/.test(action) ): {
					for ( const file of toOpen ) {
						const leaf = workspace.createLeafInParent(targetGroup, targetGroup.children.length);
						await leaf.openFile(file, { active: false });
						openedLeaves.push(leaf);
					}
					workspace.setActiveLeaf(openedLeaves[0], { focus: false });
					break;
				}
				default: {																									// open the items in one new split
					const referenceLeaf = targetGroup.children.find((leaf) => leaf === workspace.activeLeaf) || targetGroup.children[0];
					if ( !referenceLeaf ) { return }
					const splitLeaf = workspace.createLeafBySplit(referenceLeaf, /left|right/.test(action) ? 'vertical' : 'horizontal', /left|up/.test(action));
					const splitGroup = splitLeaf.parent;
					await splitLeaf.openFile(toOpen[0], { active: false });
					openedLeaves.push(splitLeaf);
					for ( const file of toOpen.slice(1) ) {
						const leaf = workspace.createLeafInParent(splitGroup, splitGroup.children.length);
						await leaf.openFile(file, { active: false });
						openedLeaves.push(leaf);
					}
					workspace.setActiveLeaf(openedLeaves[0], { focus: true });									break;
				}
			}
		}
		/*-----------------------------------------------*/
		// REGISTER DOM EVENTS
		this.registerDomEvent(document, 'click', (event) => {
			switch (true) {
				case event.target.classList.contains('continuous_mode_open_links_button'):													// nobreak
				case event.target.closest('.continuous_mode_open_links_button') !== null:	showLinksMenu(event);							break;
			}
		});
		this.registerDomEvent(document, 'mousedown', (event) => {
			switch (true) {
				case event.target.closest('.workspace-tabs.mod-stacked') !== null:																	return true;
				case ( /nav-folder-title/.test(event.target.className) && this.settings.allowSingleClickOpenFolder === true && !event.altKey && !event.ctrlKey && !event.shiftKey && event.button !== 2 ):
					event.target.closest('.nav-folder-title').addEventListener('click', (clickEvent) => { clickEvent.preventDefault(); }, { once: true });		break;	// prevent default folder collapse
				case ( /nav-file-title/.test(event.target.className) && this.settings.allowSingleClickOpenFolder === true && !event.altKey && !event.ctrlKey && !event.shiftKey && event.button !== 2 ):
					event.target.closest('.nav-file-title').addEventListener('click', (clickEvent) => { clickEvent.preventDefault(); }, { once: true });	break;	// prevent default open file
				case ( event.buttons === 2 || event.ctrlKey ) && event.target.closest('.longform-explorer') !== null:	getLongformItems(event);	break;
			}
		});
		this.registerDomEvent(document, 'mouseup', (event) => {
			const action = this.settings.allowSingleClickOpenFolderAction;
			switch (true) {
				case event.target.closest('.workspace-tabs.mod-stacked') !== null:																	return;
				case ( /nav-folder-title/.test(event.target.className) && this.settings.allowSingleClickOpenFolder === true )							// open folders on single click
					&& event.target.closest('.nav-folder-collapse-indicator') === null && event.target.closest('.collapse-icon') === null
					&& !event.altKey && !event.ctrlKey && !event.shiftKey && event.button !== 2:
					if ( action === 'disabled' ) { new Notice('Choose a single click action in the settings.'); return }
					openItemsInTabs(getFileExplorerItems(event), action, 'file explorer items', getTargetGroup(), event);								break;
				case ( /nav-file-title/.test(event.target.className) && this.settings.allowSingleClickOpenFolder === true )
					&& !event.altKey && !event.ctrlKey && !event.shiftKey && event.button !== 2:
					if ( action === 'disabled' ) { new Notice('Choose a single click action in the settings.'); return }
					openItemsInTabs(getFileExplorerItems(event), action, 'file explorer items', getTargetGroup(), event);								break;
			}
		});
		this.registerDomEvent(window, 'mouseover', (event) => {
			let buttonContainerEl;
			switch (true) {
				case event.target.closest('.markdown-reading-view,.markdown-preview-view') !== null:											// reading view
					switch (true) {
						case event.target.closest('.block-language-dataview') !== null:
							buttonContainerEl = event.target.closest('.block-language-dataview');										break;
						case event.target.closest('.internal-query') !== null:
							buttonContainerEl = event.target.closest('.internal-query')?.querySelector('.internal-query-header');		break;
					}																													break;
				case event.target.closest('.markdown-source-view') !== null:																// editing view
					switch (true) {
						case event.target.closest('.cm-preview-code-block')?.querySelector('.internal-query-header') !== null:
							buttonContainerEl = event.target.closest('.cm-preview-code-block')?.querySelector('.internal-query-header');	break;
						case event.target.closest('.cm-preview-code-block')?.querySelector('.internal-query-header') === null:
							buttonContainerEl = event.target.closest('.cm-preview-code-block');											break;
					}																													break;
			}
			if ( buttonContainerEl?.querySelector('.continuous_mode_open_links_button') === null ) {								// add the open links button if needed
				const button = buttonContainerEl?.createEl('div', { cls: 'continuous_mode_open_links_button clickable-icon' });
				button.setAttribute('aria-label', 'Open in multiple tabs');
				button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
			}
		});
		/*-----------------------------------------------*/
		// REGISTER EVENTS
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source, leaf) => {															// on file-menu
				const type = ( file instanceof obsidian.TFolder ? 'folder contents' : file instanceof obsidian.TFile ? 'file' : undefined );
				switch (true) {
					case (/link-context-menu/.test(source)):																			// click a link
						addOpenItems(menu, file, 'link', source);									break;
					case (/file-explorer-context-menu/.test(source)):																	// link context menu and file explorer menu
						addOpenItems(menu, file, type, source);									break;
					case (/file-explorer/.test(source)):																				// file-tree-alternative plugin support
						if ( this.app.workspace.getActiveViewOfType(obsidian.View)?.leaf === this.app.workspace.getLeavesOfType('file-tree-view')[0] ) {
							addOpenItems(menu, file, type, source);
						}																											break;
					case (/longform/.test(source)):																						// longform plugin support
						addOpenItems(menu, getLongformItems(file, 'scenes'), 'Longform scenes', source);	break;
					default: {																											// file menu
						addSortItems(menu, leaf?.parent, leaf);
						if ( leaf && leaf.containerEl.closest('.mod-sidedock') === null ) {
							const links = getDocumentLinks(file, leaf) || [];
							if ( links.length > 0 ) { addOpenItems(menu, getFilesFromLinks(links), 'document links', source) }
						}																											break;
					}
				}
			})
		);
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files, source) => {															// on files-menu
				switch (true) {
					case (/link-context-menu|file-explorer-context-menu/.test(source)):
						addOpenItems(menu, files, 'selected files', source);										break;
				}
			})
		);
		this.registerEvent(
			this.app.workspace.on('leaf-menu', (menu, leaf) => {																// on leaf-menu (e.g. sidebar tab headers)
				if ( leaf !== workspace.getActiveViewOfType(obsidian.View)?.leaf ) { workspace.setActiveLeaf(leaf, { focus: true }) }
				if ( leaf.containerEl.closest('.mod-left-split,.mod-right-split') ) {
					addSortItems(menu, leaf.parent, leaf);
				}
			})
		);
		this.registerEvent(
			this.app.workspace.on('tab-group-menu', (menu, tabGroup) => {														// on tab-group-menu
				addSortItems(menu, tabGroup);
			})
		);
		this.registerEvent(
			this.app.workspace.on('search:results-menu', (menu) => {																// on search results menu
				addOpenItems(menu, getSearchResultFiles(), 'search results');
			})
		);
		const addSortActionItems = (menu, tabGroup, tabGroupEl) => {
			SORT_ORDERS.forEach((entry, index) => {
				if ( index === 3 || index === 5 ) { menu.addSeparator() }													// group by name, modified time, created time
				menu.addItem((item) => {
					item.setTitle(entry.title)
						.setIcon(entry.icon)
						.setChecked( tabGroupEl?.dataset?.sortOrder === entry.key ? true : false )
						.onClick(() => changeSortOrder(tabGroup, entry.key));
				});
			});
		}
		const addSortItems = (menu, tabGroup, leaf) => {																		// add the sort entries
			const tabGroupEl = tabGroup?.containerEl;
			if ( !tabGroupEl ) { return }
			if ( this.app.isMobile === true ) { addSortActionItems(menu, tabGroup, tabGroupEl); return }					// mobile menus are flat
			menu.addItem((item) => {
				if ( tabGroup.children?.length < 2 ) { item.setDisabled(true) }
				addSortActionItems(item.setTitle('Sort tabs').setIcon('arrow-up-narrow-wide').setSection( leaf ? 'pane' : 'action' ).setSubmenu(), tabGroup, tabGroupEl);
			});
		}
		const addOpenActionItems = (menu, files, type) => {
			OPEN_ACTIONS.forEach((entry, index) => {
				if ( index === 2 ) { menu.addSeparator() }
				menu.addItem((item) => {
					item.setTitle(entry.title.replace('{{type}}', type))
						.setIcon(entry.icon)
						.onClick(() => openItemsInTabs(files, entry.action, type, getTargetGroup()));
				});
			});
		}
		const addOpenItems = (menu, file, type, source) => {																	// add the open items submenu
			const files = ( file instanceof obsidian.TFile ? [file] : file instanceof obsidian.TFolder ? file.children : file );
			if ( !files ) { return }
			if ( this.app.isMobile === true && /file-explorer-context-menu|link-context-menu|links-menu/.test(source) ) {
				addOpenActionItems(menu, files, type);																		// mobile menus are flat
				return;
			}
			menu.addItem((item) => addOpenActionItems(item.setTitle('Open in multiple tabs').setIcon('files').setSection('open').setSubmenu(), files, type));
		}
		const showLinksMenu = (event) => {
			const openLinksMenu = new obsidian.Menu();
			let links;
			switch (true) {
				case event.target.closest('.cm-preview-code-block') !== null:															// editing view
					links = event.target.closest('.cm-preview-code-block')?.querySelectorAll('a.internal-link,.search-result .tree-item-inner');	break;
				case event.target.closest('.internal-query') !== null:																	// reading view
					links = event.target.closest('.internal-query')?.querySelectorAll('.search-result .tree-item-inner');					break;
				case event.target.closest('.block-language-dataview') !== null:															// reading view
					links = event.target.closest('.block-language-dataview')?.querySelectorAll('a.internal-link');							break;
			}
			const files = getFilesFromLinks(Array.from(links || []).map((link) => link.dataset?.href || link.innerText));
			openLinksMenu.setUseNativeMenu(false);
			addOpenItems(openLinksMenu, files, 'query block links', 'links-menu');
			openLinksMenu.showAtMouseEvent(event);
		}
		/*-----------------------------------------------*/
		// OTHER PLUG-INS SUPPORT
		const getLongformItems = (object) => {																						// object = mousedown event or file
			const longformExplorer = workspace.getLeavesOfType('VIEW_TYPE_LONGFORM_EXPLORER')[0]?.view.contentEl.children[0];
			if ( !longformExplorer ) { return }
			let longformScenesArr = Array.from(longformExplorer.querySelectorAll('#scene-list > ul > li'));
			let targetItem, filteredItems, paths = [];
			let kind = ( object.target?.classList.contains('current-draft-path') ? 'project' : 'scenes' );
			const openLongformMenu = new obsidian.Menu();
			switch (kind) {
				case 'project':
					longformScenesArr.forEach((scene) => { paths.push( scene.querySelector('.scene-container').getAttribute('data-scene-path') ) });	// get all scene paths
					openLongformMenu.setUseNativeMenu(false);
					addOpenItems(openLongformMenu, getFilesFromLinks(paths), 'Longform project');
					openLongformMenu.showAtMouseEvent(object);																	break;
				case 'scenes':
					if ( longformScenesArr === undefined ) { return }
					targetItem = longformScenesArr.find((item) => item?.querySelector('.scene-container').getAttribute('data-scene-path') === object.path);
					if ( !targetItem ) { return }
					filteredItems = [targetItem];
					longformScenesArr = longformScenesArr.slice(longformScenesArr.indexOf(targetItem));							// remove the scenes before the target
					for ( let i = 1; i < longformScenesArr.length; i++ ) {														// start at 1 to keep the target scene
						if ( longformScenesArr[i].dataset.indent > targetItem.dataset.indent ) { filteredItems.push(longformScenesArr[i]) } else { break }
					}
					if ( filteredItems ) {
						filteredItems.forEach((filteredItem) => { paths.push( filteredItem.querySelector('.scene-container').getAttribute('data-scene-path') ) });
					}
					return getFilesFromLinks(paths);
			}
		}
		/*-----------------------------------------------*/
		// NAVIGATE IN PLACE
		const navigateInPlace = (event, direction) => {
			const tree = workspace.getLeavesOfType('file-explorer')[0]?.view?.tree;
			if ( !tree ) { return }
			direction = ( direction !== undefined ? direction : event?.key === 'ArrowUp' ? 'backwards' : 'forwards' );
			tree.setFocusedItem(tree.view.activeDom);
			tree.changeFocusedItem(direction);
			switch (true) {
				case tree.focusedItem?.file instanceof obsidian.TFile:
					workspace.getMostRecentLeaf(workspace.rootSplit)?.openFile(tree.focusedItem.file, { focus: true });
					break;
				case tree.focusedItem?.file instanceof obsidian.TFolder:
					if ( [ ...(this.app.plugins?.enabledPlugins || []) ].includes('smooth-explorer') ) {
						tree.selectItem(tree.focusedItem);
						tree.setFocusedItem(tree.focusedItem);
						workspace.setActiveLeaf(tree.view.leaf);
					}																										break;
			}
		}
		/*-----------------------------------------------*/
		// ADD COMMAND PALETTE ITEMS
		['left', 'right', 'up', 'down', 'append', 'replace'].forEach((action) => {														// open the selected File Explorer items
			const labels = {
				append: 'Append selected File Explorer items in active tab group',
				replace: 'Replace active tab group with selected File Explorer items',
				left: 'Open selected File Explorer items in new split left',
				right: 'Open selected File Explorer items in new split right',
				up: 'Open selected File Explorer items in new split up',
				down: 'Open selected File Explorer items in new split down'
			};
			this.addCommand({
				id: ( /append|replace/.test(action) ? `${action}-selected-file-explorer-items` : `open-selected-file-explorer-items-in-new-split-${action}` ),
				name: labels[action],
				callback: () => {
					const tree = workspace.getLeavesOfType('file-explorer')[0]?.view?.tree;
					const focusedFile = tree?.focusedItem?.file || tree?.activeDom?.file;
					if ( !focusedFile ) { new Notice('No File Explorer item selected.'); return }
					const items = ( focusedFile.children ? focusedFile.children : [focusedFile] );							// a single file must be wrapped in an array
					openItemsInTabs(items, ( /append|replace/.test(action) ? action : `open-${action}` ), 'file explorer items', getTargetGroup());
				}
			});
		});
		['left', 'right', 'up', 'down', 'append', 'replace'].forEach((action) => {														// open document links and search results
			['document links', 'search results'].forEach((type) => {
				this.addCommand({
					id: ( action === 'append' ? `append-${type.replace(/ /, '-')}-in-active-tab-group`
						: action === 'replace' ? `replace-active-tab-group-with-${type.replace(/ /, '-')}`
						: `open-${type.replace(/ /, '-')}-in-new-split-${action}` ),
					name: ( action === 'append' ? `Append ${type} in active tab group`
						: action === 'replace' ? `Replace active tab group with ${type}`
						: `Open ${type === 'document links' ? 'active' : 'current'} ${type} in new split ${action}` ),
					callback: () => {
						let items;
						switch (true) {
							case type === 'document links':
								const leaf = workspace.getActiveViewOfType(obsidian.View)?.leaf;
								items = getFilesFromLinks(getDocumentLinks(leaf?.view?.file, leaf));						break;
							case type === 'search results':
								items = getSearchResultFiles();																break;
						}
						openItemsInTabs(items, ( /append|replace/.test(action) ? action : `open-${action}` ), type, getTargetGroup());
					}
				});
			});
		});
		SORT_ORDERS.forEach((entry) => {																							// sort the active tab group
			this.addCommand({
				id: `sort-files-${entry.key}`,
				name: `Sort active tab group by ${entry.command}`,
				callback: () => { changeSortOrder(workspace.activeTabGroup, entry.key) }
			});
		});
		['previous', 'next'].forEach((direction) => {																				// open File Explorer items in place
			this.addCommand({
				id: `open-${direction}-file-explorer-item-in-place`,
				name: `Open ${direction} File Explorer item in place`,
				callback: () => { navigateInPlace(null, ( direction === 'previous' ? 'backwards' : 'forwards' )) }
			});
		});
	};
	// end onload
	/*-----------------------------------------------*/
	// on plugin unload
	onunload() {
		this.app.workspace.containerEl.querySelectorAll('.workspace-tabs').forEach((tabGroupEl) => {
			delete tabGroupEl?.dataset?.sortOrder;
			tabGroupEl.querySelectorAll('.continuous_mode_open_links_button').forEach((button) => button.remove());
		});
	}
	// load settings
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		for ( const key of Object.keys(this.settings) ) {
			if ( !Object.hasOwn(DEFAULT_SETTINGS, key) ) { delete this.settings[key] }											// drop settings of removed features
		}
		this.settings.excludedNames = this.settings.excludedNames.map((name) => name.trim()).filter(Boolean);			// names saved untrimmed never match
		if ( this.settings.includedFileTypes.length === 0 ) { this.settings.includedFileTypes.push('markdown'); this.saveSettings() }
	}
	// save settings
	async saveSettings() { await this.saveData(this.settings); }
} // end class OpenInMultipleTabsPlugin
/*-----------------------------------------------*/
// SETTINGS
let OpenInMultipleTabsSettings = class extends obsidian.PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display() {
		const { containerEl } = this;
		containerEl.empty();

		// Adds or removes one file type; an empty list falls back to markdown and redraws the toggles to show it
		const setFileType = async (value, key) => {
			const includedFileTypes = this.plugin.settings.includedFileTypes;
			const index = includedFileTypes.indexOf(key);
			if ( value === true && index === -1 ) { includedFileTypes.push(key) }
			if ( value === false && index !== -1 ) { includedFileTypes.splice(index, 1) }
			const isEmpty = ( includedFileTypes.length === 0 );
			if ( isEmpty ) { includedFileTypes.push('markdown') }
			await this.plugin.saveSettings();
			if ( isEmpty ) { this.display() }
		};

		new obsidian.Setting(containerEl).setName('1. File handling').setHeading().setDesc('These settings choose which items are opened as tabs when clicking File Explorer items, or when using the commands and context menus. Turning a file type off here does not prevent you from opening that type manually.');
		new obsidian.Setting(containerEl).setName('Include markdown').setDesc('Default.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('markdown') ? true : false)
			.onChange(async (value) => {
				await setFileType(value, 'markdown');
		}));
		new obsidian.Setting(containerEl).setName('Include images').setDesc('Natively supported file types: avif, bmp, gif, jpg, png, svg, webp.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('images'))
			.onChange(async (value) => {
				await setFileType(value, 'images');
		}));
		new obsidian.Setting(containerEl).setName('Include base files').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('base'))
			.onChange(async (value) => {
				await setFileType(value, 'base');
		}));
		new obsidian.Setting(containerEl).setName('Include canvas files').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('canvas'))
			.onChange(async (value) => {
				await setFileType(value, 'canvas');
		}));
		new obsidian.Setting(containerEl).setName('Include media').setDesc('Natively supported file types: aac, aif, aiff, ape, flac, m4a, mka, mp3, ogg, opus, wav, m4v, mkv, mov, mp4, mpeg, webm.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('media'))
			.onChange(async (value) => {
				await setFileType(value, 'media');
		}));
		new obsidian.Setting(containerEl).setName('Include pdfs').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includedFileTypes.includes('pdf'))
			.onChange(async (value) => {
				await setFileType(value, 'pdf');
		}));
		new obsidian.Setting(containerEl).setName('Include other file extensions').setDesc('If you have installed plugins that allow Obsidian to support file types not listed above, add their extensions here, comma-separated.').setClass('omit-setting-indent')
			.addText((text) => text.setPlaceholder('e.g. html, js, py, etc.').setValue(this.plugin.settings.extraFileTypes?.join(',') || '')
			.onChange(async (value) => {
				this.plugin.settings.extraFileTypes = [...new Set(value.split(','))].filter(Boolean);							// unique extensions only
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Excluded files').setDesc('Exclude files by exact name and extension, for example index.md or draft.canvas. Comma-separated and case-sensitive.').setClass('omit-setting-indent')
			.addText((text) => text.setPlaceholder('e.g. index.md, draft.md').setValue(this.plugin.settings.excludedNames?.join(',') || '')
			.onChange(async (value) => {
				this.plugin.settings.excludedNames = [...new Set(value.split(',').map((name) => name.trim()))].filter(Boolean);						// unique names only
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Include embedded files').setDesc('If true, include embedded files when opening all document links as tabs.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includeEmbeddedFiles)
			.onChange(async (value) => {
				this.plugin.settings.includeEmbeddedFiles = value;
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Include all Dataview and query block links').setDesc('If true, include links in Dataview and query blocks when opening all document links as tabs. Whether true or false, the links of an individual block can still be opened from its own menu.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.includeBlockLinks)
			.onChange(async (value) => {
				this.plugin.settings.includeBlockLinks = value;
				await this.plugin.saveSettings();
		}));

		new obsidian.Setting(containerEl).setName('2. Opening items').setHeading().setDesc('These settings control how items are opened as tabs.');
		new obsidian.Setting(containerEl).setName('Allow single click to open File Explorer items').setDesc('Enable this setting to open items from the File Explorer with a single click. Choose the action below.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.allowSingleClickOpenFolder)
			.onChange(async (value) => {
				this.plugin.settings.allowSingleClickOpenFolder = value;
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Set default single-click action:').setClass('omit-setting-indent-2').setClass('hidden')
			.addDropdown((dropDown) => {
				dropDown.addOption('disabled', '-');
				dropDown.addOption('append', 'Append File Explorer items in active tab group');
				dropDown.addOption('replace', 'Replace active tab group with File Explorer items');
				dropDown.addOption('open-left', 'Open File Explorer items in new split left');
				dropDown.addOption('open-right', 'Open File Explorer items in new split right');
				dropDown.addOption('open-up', 'Open File Explorer items in new split up');
				dropDown.addOption('open-down', 'Open File Explorer items in new split down');
				dropDown.setValue( ( this.plugin.settings.allowSingleClickOpenFolderAction === undefined || this.plugin.settings.allowSingleClickOpenFolder === false ? 'disabled' : this.plugin.settings.allowSingleClickOpenFolderAction ) );
				dropDown.onChange(async (value) => {
					this.plugin.settings.allowSingleClickOpenFolderAction = value;
					if ( value !== 'disabled' ) { this.plugin.settings.allowSingleClickOpenFolder = true }
					await this.plugin.saveSettings();
		  });
		});
		new obsidian.Setting(containerEl).setName('Warn on replace').setClass('next-hidden').setDesc('Warn when replacing the items of the active tab group with new items.').setClass('omit-setting-indent-2')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.warnOnReplace)
			.onChange(async (value) => {
				this.plugin.settings.warnOnReplace = value;
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Open folders recursively').setDesc('Recursively open all items in a folder, including those in subfolders. Sorting follows the default sort order setting below. With File Explorer order, items in collapsed folders are ignored, because only the visible files have an order.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.openFoldersRecursively)
			.onChange(async (value) => {
				this.plugin.settings.openFoldersRecursively = value;
				await this.plugin.saveSettings();
		}));
		new obsidian.Setting(containerEl).setName('Maximum number of items to open at one time').setDesc('Leave empty (or set to 0) to open all items at once. A low value lets you append the items of a folder incrementally by clicking it repeatedly with the single-click action set to Append, which is useful for folders with a large number of items.').setClass('omit-setting-indent')
			.addText((text) => text.setPlaceholder('10').setValue(this.plugin.settings.maximumItemsToOpen?.toString() || '0')
			.onChange(async (value) => {
				if ( isNaN(Number(value)) || !Number.isInteger(Number(value)) ) {
					new Notice('Please enter a positive integer, 0, or leave the field empty.');
					text.setValue('');
				} else {
					this.plugin.settings.maximumItemsToOpen = Number(value.trim()) || 0;
					await this.plugin.saveSettings();
				}
		}));
		new obsidian.Setting(containerEl).setName('Default sort order:').setDesc('If no value is set, items are sorted according to the current sort order of their source, such as the File Explorer or the search results. File Explorer order honors any custom sorting handled by other plugins and only works with expanded folders.').setClass('omit-setting-indent')
			.addDropdown((dropDown) => {
				dropDown.addOption('disabled', '-');
				SORT_ORDERS.forEach((entry) => { dropDown.addOption(entry.key, entry.title) });
				dropDown.setValue( ( this.plugin.settings.defaultSortOrder === undefined || this.plugin.settings.defaultSortOrder === false ? 'disabled' : this.plugin.settings.defaultSortOrder ) );
				dropDown.onChange(async (value) => {
					this.plugin.settings.defaultSortOrder = value;
					await this.plugin.saveSettings();
		  });
		});
		new obsidian.Setting(containerEl).setName('Index files at top').setDesc('If a directory contains an index.md file, or a file named after the directory itself, move it to the top of the opened tabs regardless of the sort order.').setClass('omit-setting-indent')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.indexFilesAtTop)
			.onChange(async (value) => {
				this.plugin.settings.indexFilesAtTop = value;
				await this.plugin.saveSettings();
		}));
	} // end display()
};
module.exports = OpenInMultipleTabsPlugin;
