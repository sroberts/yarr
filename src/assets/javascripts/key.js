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
    } else if (vm.keyColumn === 'article' && vm.itemSelected != null) {
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
      // nothing open yet: open the first article and step into it
      if (!vm.items.length) return
      vm.navigateToItem(+1)
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
    vm.itemSelected = null
  },
  // Esc closes the article too, unless it is closing a menu first
  escapeItem: function () {
    if (vm.feedContextMenu || document.querySelector('.dropdown-menu.show')) return
    vm.itemSelected = null
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
  // In triage card mode the list/reader shortcuts don't apply; use the card map.
  if (vm.cardMode) {
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
// j/k on the article list as always.
document.addEventListener('pointerdown', function(event) {
  if (!vm.keyColumnShown || vm.cardMode) return
  var col = event.target.closest && event.target.closest('#col-feed-list, #col-item-list, #col-item')
  if (!col) return
  vm.keyColumn = ({'col-feed-list': 'feeds', 'col-item-list': 'items', 'col-item': 'article'})[col.id]
})
