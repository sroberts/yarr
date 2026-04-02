'use strict';

// Card swipe gesture handler for triage mode.
// Follows the same IIFE pattern as the pull-to-refresh handler in app.js.
(function() {
  var startX = 0
  var startY = 0
  var offsetX = 0
  var swiping = false
  var directionLocked = false
  var threshold = 80

  function getCard() {
    return document.getElementById('triage-card')
  }

  function getArea() {
    return document.getElementById('card-view')
  }

  function getIndicator() {
    return document.getElementById('card-action-indicator')
  }

  function showPill(indicator, type, label) {
    while (indicator.firstChild) indicator.removeChild(indicator.firstChild)
    var pill = document.createElement('span')
    pill.className = 'card-action-pill visible ' + type
    pill.textContent = label
    indicator.appendChild(pill)
  }

  function clearPill(indicator) {
    while (indicator.firstChild) indicator.removeChild(indicator.firstChild)
  }

  function updateVisuals(card, area, indicator, dx) {
    var rotation = dx * 0.05
    card.style.transform = 'translateX(' + dx + 'px) rotate(' + rotation + 'deg)'

    var progress = Math.min(Math.abs(dx) / threshold, 1)

    // Background tint
    if (dx < 0) {
      area.style.background = 'linear-gradient(90deg, rgba(255,102,0,' + (progress * 0.15) + ') 0%, transparent 60%)'
    } else if (dx > 0) {
      area.style.background = 'linear-gradient(90deg, transparent 40%, rgba(0,128,212,' + (progress * 0.15) + ') 100%)'
    } else {
      area.style.background = ''
    }

    // Action pill
    if (Math.abs(dx) > threshold) {
      if (dx < 0) {
        var label = vm.instapaperUsername ? 'Save to Instapaper' : 'Keep Unread'
        showPill(indicator, 'action-instapaper', label)
      } else {
        showPill(indicator, 'action-read', 'Mark Read')
      }
    } else {
      clearPill(indicator)
    }
  }

  function resetVisuals(card, area, indicator) {
    card.classList.remove('swiping')
    card.classList.add('snapping')
    card.style.transform = ''
    area.style.background = ''
    clearPill(indicator)
    setTimeout(function() {
      card.classList.remove('snapping')
    }, 300)
  }

  function flyAway(card, area, indicator, direction) {
    card.classList.remove('swiping')
    card.classList.add('flying')
    var flyX = direction < 0 ? '-120%' : '120%'
    var flyRotate = direction < 0 ? -15 : 15
    card.style.transform = 'translateX(' + flyX + ') rotate(' + flyRotate + 'deg)'
    card.style.opacity = '0'
    area.style.background = ''
    clearPill(indicator)

    setTimeout(function() {
      card.classList.remove('flying')
      card.style.transform = ''
      card.style.opacity = ''
      if (direction < 0) {
        vm.cardSwipeLeft()
      } else {
        vm.cardSwipeRight()
      }
    }, 300)
  }

  document.addEventListener('touchstart', function(e) {
    var card = getCard()
    if (!card || !vm.cardMode || vm.cardDone) return
    if (!card.contains(e.target)) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    offsetX = 0
    swiping = false
    directionLocked = false
    card.classList.remove('snapping', 'flying')
  }, { passive: true })

  document.addEventListener('touchmove', function(e) {
    var card = getCard()
    if (!card || !vm.cardMode || vm.cardDone) return
    if (!startX && !startY) return

    var dx = e.touches[0].clientX - startX
    var dy = e.touches[0].clientY - startY

    if (!directionLocked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      directionLocked = true
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical movement — not a swipe, bail out
        startX = 0
        startY = 0
        return
      }
      swiping = true
      card.classList.add('swiping')
    }

    if (!swiping) return

    e.preventDefault()
    offsetX = dx
    updateVisuals(card, getArea(), getIndicator(), offsetX)
  }, { passive: false })

  document.addEventListener('touchend', function() {
    var card = getCard()
    if (!card || !swiping) {
      startX = 0
      startY = 0
      return
    }

    var area = getArea()
    var indicator = getIndicator()

    if (Math.abs(offsetX) > threshold) {
      flyAway(card, area, indicator, offsetX < 0 ? -1 : 1)
    } else {
      resetVisuals(card, area, indicator)
    }

    startX = 0
    startY = 0
    offsetX = 0
    swiping = false
    directionLocked = false
  })
})();
