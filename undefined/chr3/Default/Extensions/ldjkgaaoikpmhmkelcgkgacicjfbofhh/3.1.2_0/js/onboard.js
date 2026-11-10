window.onload = function() {
    const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension://');
    var consent_checkbox = document.querySelector('#consent');
    chrome.storage.sync.get("consent", function(obj) {
        consent_checkbox.checked = obj.consent;
        consent_checkbox.onchange = function() {
            chrome.storage.sync.set({"consent": consent_checkbox.checked});
            if (consent_checkbox.checked && isFirefox) {
                browser.permissions.request({origins: ['http://*/*', 'https://*/*']}).then((response) => {
                    if (!response) {
                        consent_checkbox.checked = false;
                        chrome.storage.sync.set({"consent": false});
                        alert('In order to save articles properly, Instapaper needs access to the pages you visit.\n\nInstapaper only collects information when you save an article or take an action.');
                    }
                });
            }
        }
    });

    var continue_button = document.querySelector('#continue');
    continue_button.onclick = function() {
        if (!consent_checkbox.checked) {
            alert('Before continuing please consent to the data collection policy.');
        }
        else {
			chrome.tabs.getCurrent(function(tab) {
    			chrome.tabs.remove(tab.id, function() { });
			});
        }
    };

    var uninstall_link = document.querySelector('#uninstall');
    uninstall_link.onclick = function() {
        browser.management.uninstallSelf();
    };

    var current_year = document.getElementById('current_year');
    current_year.innerHTML = (new Date()).getFullYear();
}

