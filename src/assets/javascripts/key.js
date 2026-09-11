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
  }
}
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
    // same condition as 'Mark all read button'
    if (vm.filterSelected == 'unread'){
      vm.markItemsRead()
    }
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
  nextItem(){
    vm.navigateToItem(+1)
  },
  previousItem() {
    vm.navigateToItem(-1)
  },
  nextFeed(){
    vm.navigateToFeed(+1)
  },
  previousFeed() {
    vm.navigateToFeed(-1)
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
  showAll() {
    vm.filterSelected = ''
  },
  showUnread() {
    vm.filterSelected = 'unread'
  },
  showStarred() {
    vm.filterSelected = 'starred'
  },
  showShortcuts: function() {
    vm.showSettings('shortcuts')
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
  "j": shortcutFunctions.nextItem,
  "k": shortcutFunctions.previousItem,
  "l": shortcutFunctions.nextFeed,
  "h": shortcutFunctions.previousFeed,
  "f": shortcutFunctions.scrollForward,
  "b": shortcutFunctions.scrollBackward,
  "q": shortcutFunctions.closeItem,
  "1": shortcutFunctions.showUnread,
  "2": shortcutFunctions.showStarred,
  "3": shortcutFunctions.showAll,
  "?": shortcutFunctions.showShortcuts,
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
  "KeyJ": shortcutFunctions.nextItem,
  "KeyK": shortcutFunctions.previousItem,
  "KeyL": shortcutFunctions.nextFeed,
  "KeyH": shortcutFunctions.previousFeed,
  "KeyF": shortcutFunctions.scrollForward,
  "KeyB": shortcutFunctions.scrollBackward,
  "KeyQ": shortcutFunctions.closeItem,
  "Digit1": shortcutFunctions.showUnread,
  "Digit2": shortcutFunctions.showStarred,
  "Digit3": shortcutFunctions.showAll,
}

// Card triage mode runs its own keyboard map: the swipe loop, by keyboard.
// Mirrors the touch gestures in swipe.js (left = instapaper/keep, right = read).
var triageBindings = {
  "ArrowRight": function() { vm.cardSwipeRight() },
  "ArrowLeft":  function() { vm.cardSwipeLeft() },
  "Enter":      function() { vm.cardTap() },
  "p":          function() { vm.toggleListen() },
  "u":          function() { vm.undoCardAction() },
  "Escape":     function() { vm.exitCardMode() },
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
  // In triage card mode the list/reader shortcuts don't apply; use the card map.
  if (vm.cardMode) {
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
    keybindFunction()
  }
})
