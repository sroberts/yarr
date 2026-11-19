var helperFunctions = {
  scrollContent: function(direction) {
    var padding = 40
    var scroll = document.querySelector('.content')
    if (!scroll) return

    var height = scroll.getBoundingClientRect().height
    var newpos = scroll.scrollTop + (height - padding) * direction

    if (typeof scroll.scrollTo == 'function') {
      scroll.scrollTo({top: newpos, left: 0, behavior: 'smooth'})
    } else {
      scroll.scrollTop = newpos
    }
  },
  // a short step through the open article, for j/k in the reader column
  scrollContentStep: function(direction, repeat) {
    var scroll = document.querySelector('.content')
    if (!scroll) return

    var step = Math.max(60, scroll.getBoundingClientRect().height * 0.2)
    var newpos = scroll.scrollTop + step * direction

    // a held key repeats faster than a smooth scroll settles; jump instead
    if (typeof scroll.scrollTo == 'function' && !repeat) {
      scroll.scrollTo({top: newpos, left: 0, behavior: 'smooth'})
    } else {
      scroll.scrollTop = newpos
    }
  },
}

// h/l walk this list; j/k act on whichever column is current.
var keyColumns = ['feeds', 'items', 'article']
var shortcutFunctions = {
  openItemLink: function() {
    if (vm.itemSelectedDetails && vm.itemSelectedDetails.link) {
      window.open(vm.itemSelectedDetails.link, '_blank', 'noopener,noreferrer')
    }
  },
  copyItemLink: function() {
    if (vm.itemSelectedDetails && vm.itemSelectedDetails.link) {
      vm.copyItemLink(vm.itemSelectedDetails)
    }
  },
  toggleReadability: function() {
    vm.toggleReadability()
  },
  toggleItemRead: function() {
    if (vm.itemSelected != null) {
      vm.toggleItemRead(vm.itemSelectedDetails)
    }
  },
  markAllRead: function() {
    // any filter, like the feed and folder menus; it's undoable
    vm.markItemsRead()
  },
  toggleItemStarred: function() {
    if (vm.itemSelected != null) {
      vm.toggleItemStarred(vm.itemSelectedDetails)
    }
  },
  saveToInstapaper: function() {
    if (vm.itemSelected != null) {
      vm.saveToInstapaper(vm.itemSelectedDetails)
    }
  },
  toggleListen: function() {
    vm.toggleListen()
  },
  focusSearch: function() {
    document.getElementById("searchbar").focus()
  },
  nextInColumn(event) {
    shortcutFunctions.stepInColumn(+1, event)
  },
  previousInColumn(event) {
    shortcutFunctions.stepInColumn(-1, event)
  },
  stepInColumn(direction, event) {
    if (vm.keyColumn === 'feeds') {
      vm.navigateToFeed(direction)
    } else if (vm.keyColumn === 'article' && vm.itemSelected != null && !vm.itemUnavailable) {
      helperFunctions.scrollContentStep(direction, event && event.repeat)
    } else {
      vm.navigateToItem(direction)
    }
  },
  columnLeft() {
    shortcutFunctions.moveColumn(-1)
  },
  columnRight() {
    shortcutFunctions.moveColumn(+1)
  },
  moveColumn(direction) {
    vm.keyColumnShown = true
    var next = keyColumns[keyColumns.indexOf(vm.keyColumn) + direction]
    if (!next) return
    if (next === 'article' && vm.itemSelected == null) {
      // nothing open: reopen the article last closed, else open the first,
      // and step into it
      if (!vm.items.length) return
      if (vm.itemCursorIndex() !== -1) vm.itemSelected = vm.itemCursor
      else vm.navigateToItem(+1)
    }
    vm.keyColumn = next
  },
  scrollForward: function() {
    helperFunctions.scrollContent(+1)
  },
  scrollBackward: function() {
    helperFunctions.scrollContent(-1)
  },
  closeItem: function () {
    vm.closeArticle()
  },
  // Esc closes the article too, unless it is closing a menu first
  escapeItem: function () {
    if (vm.feedContextMenu || document.querySelector('.dropdown-menu.show')) return
    vm.closeArticle()
  },
  showAll() {
    vm.filterSelected = ''
  },
  showUnread() {
    vm.filterSelected = 'unread'
  },
  showStarred() {
    vm.filterSelected = 'starred'
  },
  startTriage() {
    vm.filterSelected = 'triage'
  },
  showShortcuts: function() {
    vm.showSettings('shortcuts')
  },
  undoFeedAction: function() {
    vm.runFeedUndo()
  },
}

// If you edit, make sure you update the help modal
var keybindings = {
  "o": shortcutFunctions.openItemLink,
  "c": shortcutFunctions.copyItemLink,
  "i": shortcutFunctions.toggleReadability,
  "r": shortcutFunctions.toggleItemRead,
  "R": shortcutFunctions.markAllRead,
  "s": shortcutFunctions.toggleItemStarred,
  "I": shortcutFunctions.saveToInstapaper,
  "p": shortcutFunctions.toggleListen,
  "/": shortcutFunctions.focusSearch,
  "j": shortcutFunctions.nextInColumn,
  "k": shortcutFunctions.previousInColumn,
  "l": shortcutFunctions.columnRight,
  "h": shortcutFunctions.columnLeft,
  "f": shortcutFunctions.scrollForward,
  "b": shortcutFunctions.scrollBackward,
  "q": shortcutFunctions.closeItem,
  "Escape": shortcutFunctions.escapeItem,
  "1": shortcutFunctions.showUnread,
  "2": shortcutFunctions.showStarred,
  "3": shortcutFunctions.showAll,
  "4": shortcutFunctions.startTriage,
  "?": shortcutFunctions.showShortcuts,
  "u": shortcutFunctions.undoFeedAction,
}

var codebindings = {
  "KeyO": shortcutFunctions.openItemLink,
  "KeyC": shortcutFunctions.copyItemLink,
  "KeyI": shortcutFunctions.toggleReadability,
  //"r": shortcutFunctions.toggleItemRead,
  //"KeyR": shortcutFunctions.markAllRead,
  "KeyS": shortcutFunctions.toggleItemStarred,
  "KeyP": shortcutFunctions.toggleListen,
  "Slash": shortcutFunctions.focusSearch,
  "KeyJ": shortcutFunctions.nextInColumn,
  "KeyK": shortcutFunctions.previousInColumn,
  "KeyL": shortcutFunctions.columnRight,
  "KeyH": shortcutFunctions.columnLeft,
  "KeyF": shortcutFunctions.scrollForward,
  "KeyB": shortcutFunctions.scrollBackward,
  "KeyQ": shortcutFunctions.closeItem,
  "Digit1": shortcutFunctions.showUnread,
  "Digit2": shortcutFunctions.showStarred,
  "Digit3": shortcutFunctions.showAll,
  "Digit4": shortcutFunctions.startTriage,
  "KeyU": shortcutFunctions.undoFeedAction,
}

// Card triage mode runs its own keyboard map: the swipe loop, by keyboard.
// Mirrors the touch gestures in swipe.js (left = instapaper/keep, right = read).
var triageBindings = {
  "ArrowRight": function() { vm.cardSwipeRight() },
  "ArrowLeft":  function() { vm.cardSwipeLeft() },
  // the list's keys mean the same here, so one grammar carries across:
  // j / r read the card and move on, k steps back, i reads it here,
  // I saves to Instapaper (the left swipe, when Instapaper is set up)
  "j":          function() { vm.cardSwipeRight() },
  "r":          function() { vm.cardSwipeRight() },
  "k":          function() { if (vm.cardUndo) vm.undoCardAction() },
  "i":          function() { vm.cardExpanded ? (vm.cardExpanded = false) : vm.cardTap() },
  "I":          function() { if (vm.instapaperConfigured) vm.cardSwipeLeft() },
  "Enter":      function() { vm.cardExpanded ? (vm.cardExpanded = false) : vm.cardTap() },
  "s":          function() { vm.cardStar() },
  "n":          function() { vm.cardSkip() },
  "o":          function() { vm.cardOpenOriginal() },
  "p":          function() { vm.toggleListen() },
  "u":          function() { vm.cardUndo ? vm.undoCardAction() : vm.runFeedUndo() },
  "Escape":     function() { vm.cardExpanded ? (vm.cardExpanded = false) : vm.exitCardMode() },
  // the global ways out and the help sheet work here too
  "?":          shortcutFunctions.showShortcuts,
  "1":          shortcutFunctions.showUnread,
  "2":          shortcutFunctions.showStarred,
  "3":          shortcutFunctions.showAll,
}

function isTextBox(element) {
  var tagName = element.tagName.toLowerCase()
  // Input elements that aren't text. `search` is deliberately NOT here: the
  // article search field is type="search", and listing it let every letter
  // shortcut fire mid-query while preventDefault() ate the character — typing
  // "crypto code" left "yt de" behind, plus a stray copy and a talking article.
  var inputBlocklist = ['button','checkbox','color','file','hidden','image','radio','range','reset','submit']
  // An input with no type attribute reports null here; treat it as 'text'.
  var inputType = (element.getAttribute('type') || 'text').toLowerCase()

  return tagName === 'textarea' ||
    ( tagName === 'input'
      && inputBlocklist.indexOf(inputType) == -1
    )
}

document.addEventListener('keydown',function(event) {
  // Ignore while focused on text or
  // when using modifier keys (to not clash with browser behaviour)
  if (isTextBox(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
    return
  }
  // A dialog or the palette is modal: nothing acts on the page behind it.
  // ? still swaps an open settings panel for the shortcut sheet.
  if (vm.settings || vm.promptModal || vm.paletteOpen) {
    if (event.key === '?' && vm.settings) {
      event.preventDefault()
      vm.showSettings('shortcuts')
    }
    return
  }
  // Enter / Space collapse or expand a sidebar folder: the one the keyboard
  // cursor is on in the feeds column, otherwise the one under the pointer.
  // A control focused elsewhere (a button, link, field) keeps its own
  // Enter / Space; focus on the page or a feed-list row doesn't. The folder
  // row's own chevron handles its keys itself and stops them.
  if ((event.key === 'Enter' || event.key === ' ') && !vm.cardMode &&
      !vm.feedContextMenu && !document.querySelector('.dropdown-menu.show')) {
    var focus = event.target
    var focusFree = focus === document.body || focus === document.documentElement ||
      (focus.closest && focus.closest('#feed-list-scroll') &&
        !focus.closest('button, a[href], [role="button"], select, textarea, input:not([type="radio"])'))
    var folderId = null
    var selected = /^folder:(\d+)$/.exec(vm.feedSelected || '')
    if (vm.keyColumnShown && vm.keyColumn === 'feeds' && selected) {
      folderId = +selected[1]
    } else if (vm.hoveredFolder && !vm.itemSelected &&
        // with an article open, Enter / Space are left to the reader rather
        // than a folder the pointer happens to rest on;
        // mouseleave never fires for a row hidden or removed under the
        // pointer (filter change, column hidden), so check it's still there
        document.querySelector('#feed-list-scroll .folder-row:hover input[value="folder:' + vm.hoveredFolder.id + '"]')) {
      folderId = vm.hoveredFolder.id
    }
    // a feed refresh replaces vm.folders, so act on the current object by id
    var folder = folderId !== null && vm.folders.find(function(f) { return f.id === folderId })
    if (focusFree && folder) {
      event.preventDefault()
      vm.toggleFolderExpanded(folder)
      return
    }
  }
  // In triage card mode the list/reader shortcuts don't apply; use the card map.
  if (vm.cardMode) {
    // An open menu owns the keys, Esc included: it closes the menu and
    // leaves triage alone, and letters don't triage the card behind it.
    if (vm.feedContextMenu || document.querySelector('.dropdown-menu.show')) return
    // A focused control keeps its own keys: Enter/Space press the button or
    // link, the arrows move through the folder picker. Everything else (and the
    // arrows on a clicked legend button) still triages.
    var tag = event.target.tagName
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('button, a[href], select, summary')) return
    if (tag === 'SELECT' && event.key !== 'Escape') return
    var triageFunction = triageBindings[event.key]
    if (triageFunction) {
      event.preventDefault()
      triageFunction()
    }
    return
  }
  var keybindFunction = keybindings[event.key] || codebindings[event.code]
  if (keybindFunction) {
    event.preventDefault()
    keybindFunction(event)
  }
})

// Once h/l have put the column marker up, a click moves it to the column
// clicked, so the next j/k acts where you are. Before that, clicks leave
// j/k on the article list as always. Only a click into a column's content
// counts (the feed tree, the article list, the reader body): toolbars, menus,
// a row's ⋯ button and dialogs leave the marker where it was. Match only the
// real columns (children of #app): feed content keeps SVG ids, so an
// <svg id="col-feed-list"> in an article must not pass for a column.
document.addEventListener('pointerdown', function(event) {
  if (!vm.keyColumnShown || vm.cardMode) return
  var target = event.target
  if (!target.closest) return
  if (target.closest('button, [role="button"], [role^="menu"], .dropdown-menu, [role="dialog"], .modal')) return
  var region = target.closest('#app > #col-feed-list > #feed-list-scroll, #app > #col-item-list > #item-list-scroll, #app > #col-item > .content')
  if (!region) return
  vm.keyColumn = ({'feed-list-scroll': 'feeds', 'item-list-scroll': 'items'})[region.id] || 'article'
})
