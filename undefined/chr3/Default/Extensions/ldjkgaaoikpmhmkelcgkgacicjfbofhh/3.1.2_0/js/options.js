function setupSetting(setting) {
    var element = document.querySelector('#' + setting);
    chrome.storage.sync.get(setting, function(obj) {
        element.checked = obj[setting];
        element.onchange = function() {
            chrome.storage.sync.set({[setting]: element.checked});
        };
    });
}

function setupHighlightSettings(highlightsEnabled) { 
    var highlightSettings = [
        'highlight_on_save',
        'highlight_menu',
        'highlight_quick',
    ];

    for (var i = 0; i < highlightSettings.length; i++) {
        var highlightSetting = highlightSettings[i];
        var element = document.querySelector('#' + highlightSetting);
        element.disabled = !highlightsEnabled;
   }
}


window.onload = function() {
    const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension://');
    var isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
    var shortcut_text = document.querySelector("#shortcut_text");
    if (isFirefox && isMac)
        shortcut_text.innerText = "Save (Cmd+Shift+I)";
    else if (isFirefox)
        shortcut_text.innerText = "Save (Ctrl+Shift+I)";
    else if (!isMac)
        shortcut_text.innerText = "Save (Ctrl+Shift+S)";

    var settings = [
        'shortcut_enabled',
        'kindle_enabled',
        'highlights_enabled',
        'highlight_on_save',
        'highlight_menu',
        'highlight_quick',
        'twitter_enabled',
        'hn_enabled',
        'lobsters_enabled',
    ];

    for (var i = 0; i < settings.length; i++) {
        setupSetting(settings[i]);
    }

    chrome.storage.sync.get("highlights_enabled", function(obj) {
        setupHighlightSettings(obj.highlights_enabled);
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
        for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
            if (key == "highlights_enabled" && oldValue != newValue) {
                setupHighlightSettings(newValue);
            }
        }
    });

    var current_year = document.getElementById('current_year');
    current_year.innerHTML = (new Date()).getFullYear();
}

