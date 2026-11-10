function parentWithClassName(el, className) {
    while ((el = el.parentNode) && (!el.classList || !el.classList.contains(className)));
    return el;
}

function addInstapaperAction() {
    var tweet_links = document.querySelectorAll('article a[target="_blank"]');
    for (var i = 0; i < tweet_links.length; i++) {
        var tweet_link = tweet_links[i];
        var link = tweet_link.href;
        if (!link.startsWith("https://t.co/")) {
            continue
        }
        
        var tweet = tweet_link.closest('article');
        if (tweet.getElementsByClassName('action-instapaper').length != 0) {
            continue;
        }

        var like_buttons = tweet.querySelectorAll('[data-testid="like"]');
        if (like_buttons.length == 0) {
            continue;
        }
        
        var like_button = like_buttons[0];
        var tweet_actions = like_button.closest('[role="group"]');
        var instapaper_element = document.createElement('div');
        var instapaper_link = document.createElement('a');
        instapaper_link.setAttribute('aria-label', 'Save to Instapaper');
        instapaper_link.href = link;
        instapaper_link.onclick = function(e) {
            var link = e.target;
            while (link && link.nodeName != "A")
                link = link.parentNode;
            if (link && link.href) {
                e.stopPropagation();
                e.preventDefault();
                saveLink(link.href);
            }
            return false;
        }
        instapaper_element.appendChild(instapaper_link);
        instapaper_element.className = like_button.parentNode.className + ' ProfileTweet-action action-instapaper';
        tweet_actions.insertBefore(instapaper_element, like_button.parentNode.nextSibling); 
    }
    
    setTimeout(addInstapaperAction, 1000);
}

chrome.runtime.sendMessage({'message': 'storage', 'keys': ['twitter_enabled']}).then((response) => {
    if (response.twitter_enabled)
        addInstapaperAction();
});
