const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension://');
const isSafari = chrome.runtime.getURL('').startsWith('safari-web-extension://');

function initialize_defaults() {
    if (isSafari) {
        return;
    }
    chrome.storage.sync.get("defaults_initialized", function(obj) {
        if (obj.defaults_initialized)
            return;
        chrome.storage.sync.set({"twitter_enabled":true,
                                 "reddit_enabled":true,
                                 "hn_enabled":true,
                                 "shortcut_enabled":true,
                                 "defaults_initialized":true});
    });

    chrome.storage.sync.get("defaults_initialized2", function(obj) {
        if (obj.defaults_initialized2)
            return;
        chrome.storage.sync.set({"kindle_enabled": true,
                                 "highlights_enabled":true,
                                 "highlight_on_save":true,
                                 "highlight_menu":true,
                                 "highlight_quick":true,
                                 "lobsters_enabled":true,
                                 "defaults_initialized2":true});
    });
}

initialize_defaults();

chrome.action.onClicked.addListener(function(tab) {
    //Called when the user clicks on the browser action.
    bookmarklet(false)
});

function sendActiveTabMessage(messageName) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {'message': messageName});
    });
}

function bookmarklet(isShortcut) {
    var messageName = isShortcut ? 'shortcut' : 'bookmarklet';
    if (isFirefox) {
        chrome.storage.sync.get('consent', function(obj) {
            if (!obj.consent) {
                showOnboarding();
                return;
            }

            sendActiveTabMessage(messageName);
        });
    }
    else {
        sendActiveTabMessage(messageName);
    }
}

async function removeHighlight(highlight_id) {
    var url = 'https://www.instapaper.com/highlight/' + highlight_id + '/delete'
    try {
        var response = await fetch(url, {method: "POST"});
        if (response.status != 200) {
            console.log('[Delete highlight] Non-200 status code: ' + response.status);
        }
        else {
            await response.json();
            console.log('[Remove highlight] Success! ' + data);
        }
    } catch (e) {
        console.log('Error removing highlight with ID (' + highlight_id + '): ' + e);
    }
}

async function createHighlight(tab, localID, bookmarkID, text, position, comment) {
    var body = 'text=' + encodeURIComponent(text) + '&position=' + position;
    if (comment) {
        body += "&note=" + encodeURIComponent(comment);
    }
    try {
        var response = await fetch('https://www.instapaper.com/bookmark/' + bookmarkID + '/highlight', {
            method: "POST",
            headers: {"Content-Type": 'application/x-www-form-urlencoded'},
            body: body
        });
        if (response.status == 412) {
            console.log('[Create highlight] Highlight limit exceeded');
            chrome.tabs.sendMessage(tab.id, {'message': 'highlight_premium', 'local_id': localID});
        }
        else if (response.status != 200) {
            console.log('[Create highlight] Non-200 status code: ' + response.status);
            chrome.tabs.sendMessage(tab.id, {'message': 'highlight_error', 'local_id': localID, 'note': comment, 'code': response.status});
        }
        else {
            var data = await response.json();
            console.log('[Create highlight] Success! ' + JSON.stringify(data));
            chrome.tabs.sendMessage(tab.id, {'message': 'highlight_created', 'local_id': localID, 'api_id': data['highlight_id']});
        }
    } catch (e) {
        console.log('Exception: ' + e);
    }
}

async function updateNote(apiID, note) {
    var body = 'note=' + encodeURIComponent(note);
    try {
        var response = await fetch('https://www.instapaper.com/highlight/' + apiID + '/update_note', {
            method: "POST",
            headers: {"Content-Type": 'application/x-www-form-urlencoded'},
            body: body
        });
        if (response.status != 200) {
            console.log('[Update note] Non-200 status code: ' + response.status);
        }
        else {
            storeUpdateNote(apiID, note);
        }
    } catch (e) {
        console.log('Exception: ' + e);
    }
}

function saveLink(tab, url) {
    if (isFirefox) {
        chrome.storage.sync.get('consent', function(obj) {
            if (!obj.consent) {
                showOnboarding();
                return;
            }
            url = url.split('?')[0]
            chrome.tabs.sendMessage(tab.id, {'message': 'saveLink', 'url': url});
        });
    }
    else {
        chrome.tabs.sendMessage(tab.id, {'message': 'saveLink', 'url': url});
    }
}

function onContextClick(info, tab) {
    if (info.linkUrl) {
        saveLink(tab, info.linkUrl);
    }
    else {
        bookmarklet(false)
    }
}

function showOnboarding() {
    const url = chrome.runtime.getURL("onboard.html");
    chrome.tabs.create({ url });
}

async function bookmarkletXpaths(url, success, failure) {
    if (isFirefox) {
        url = url.split('?')[0]
    }
    
    var response = await fetch('https://www.instapaper.com/bookmarklet/xpaths?url=' + encodeURIComponent(url));
    if (response.status != 200) {
        failure(response.status);
        return;
    }
    
    var data = await response.json();
    success(data)
}

chrome.commands.onCommand.addListener(function (command) {
    if (command === "ctrl-shift-s") {
        bookmarklet(true)
    }
});

chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
        "id": "instapaper_save",
        "title":"Save to Instapaper",
        "contexts":["page", "selection", "link"]
    });
    chrome.contextMenus.onClicked.addListener(onContextClick);
})

async function messageHandler(request, sender, sendResponse) {
    if (request.message == 'bookmarklet_upload') {
        try {
            var response = await fetch('https://www.instapaper.com/bookmarklet/post_v6', {
                method: "POST",
                headers: {"Content-Type": 'application/x-www-form-urlencoded'},
                body: request.postbody
            });

            if (response.status != 200) {
                chrome.tabs.sendMessage(sender.tab.id, {'message': 'bookmarklet_status', 'status': 'failure', 'code': response.status});
            }
            else {
                var text = await response.text();
                chrome.tabs.sendMessage(sender.tab.id, {'message': 'bookmarklet_status', 'status': 'success', 'response': text, 'link_save': request.link_save});
            }
        } catch (e) {
            chrome.tabs.sendMessage(sender.tab.id, {'message': 'bookmarklet_status', 'status': 'exception'})
        }
    }
    else if (request.message == 'bookmarklet_xpaths') {
        bookmarkletXpaths(
            request.url,
            function(data) {
                chrome.tabs.sendMessage(sender.tab.id, {'message': 'bookmarklet_xpath_status', 'status': 'success', 'xpaths': data['xpaths']})
            },
            function(status_code) {
                chrome.tabs.sendMessage(sender.tab.id, {'message': 'bookmarklet_xpath_status', 'status': 'failure', 'code': status_code})
            }
        );
    }
    else if (request.message == 'bookmark_move') {
        await fetch('https://www.instapaper.com/move/' + request.bookmark_id + '/to/' + request.folder_id);
    }
    else if (request.message == 'bookmark_archive') {
        var endpoint = request.archive? 'skip': 'mark_unread';
        await fetch('https://www.instapaper.com/' + endpoint + '/' + request.bookmark_id);
    }
    else if (request.message == 'bookmark_kindle') {
        await fetch('https://www.instapaper.com/bookmark/' + request.bookmark_id + '/kindle', {method: 'POST'});
    }
    else if (request.message == 'bookmark_tags_update') {
        await fetch('https://www.instapaper.com/update_tags/' + request.bookmark_id, {
            method: "POST",
            headers: {"Content-Type": 'application/x-www-form-urlencoded'},
            body: `remove_tags=${encodeURIComponent(request.remove_tags)}&add_tags=${encodeURIComponent(request.add_tags)}`,
        });
    }
    else if (request.message == 'remove_highlight') {
        removeHighlight(request.highlight_id);
    }
    else if (request.message == 'valid_selection') {
        var title = request.valid? "Save and Create Highlight": "Save to Instapaper";
        chrome.contextMenus.update("instapaper_save", {"title": title});
    }
    else if (request.message == 'create_highlight') {
        createHighlight(sender.tab, request.local_id, request.bookmark_id, request.text, request.position, request.comment);
    }
    else if (request.message == 'update_note') {
        updateNote(request.api_id, request.note);
    }
    else if (request.message == 'storage') {
        var promise = isSafari? browser.runtime.sendNativeMessage("application.id", request): chrome.storage.sync.get(request.keys);
        var response = await promise;
        sendResponse(response);
    }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    messageHandler(request, sender, sendResponse);
    return request.message == 'storage'; // Will actually use sendResponse
});


if (isFirefox) {
    chrome.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
        //if (temporary) return; // skip during development
        switch (reason) {
            case "install": {
                showOnboarding();
            }
            break;
        }
    });
}
