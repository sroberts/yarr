function addInstapaperAction() {
    var entries = document.getElementsByClassName('h-entry');
    for (var i = 0; i < entries.length; i++) {
        var links = entries[i].getElementsByClassName('u-url');
        var byline = entries[i].getElementsByClassName('byline');
        if (links.length && byline.length) {
            const comments = byline[0].getElementsByClassName('comments_label');
            const beforeEl = comments.length > 0 ? comments[0] : null;

            const instapaper_link = document.createElement('a');
            instapaper_link.href = links[0].href;
            instapaper_link.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                saveLink(e.target.href);
                return false;
            }
            instapaper_link.appendChild(document.createTextNode('instapaper'));
            byline[0].insertBefore(instapaper_link, beforeEl);

            // Insert ' <span>|</span> ' before the link element
            const separator = document.createElement('span');
            separator.appendChild(document.createTextNode('|'));
            byline[0].insertBefore(separator, instapaper_link);
            byline[0].insertBefore(document.createTextNode(' '), separator);
            byline[0].insertBefore(document.createTextNode(' '), separator.nextSibling);
        }
    }
}

chrome.runtime.sendMessage({'message': 'storage', 'keys': ['lobsters_enabled']}).then((response) => {
    if (response.lobsters_enabled)
        addInstapaperAction();
});
