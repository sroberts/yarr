/********* Globals ********************/
var enterHandled = false;
var tagsAdded = 0;
var addedTags = [];
var removedTags = [];
var currentTags = [];
var availableTags = [];


/********* Data manipulation ***********/
function resetGlobals() {
    enterHandled = false;
    tagsAdded = 0;
    addedTags = [];
    removedTags = [];
    currentTags = [];
    availableTags = [];
}


function _updateTagsChanges(remove, add) {
    if (remove.length > 0 || add.length > 0) {
        chrome.runtime.sendMessage({
            'message': 'bookmark_tags_update',
            'bookmark_id': window.instapaperBookmarkId,
            'remove_tags': JSON.stringify(remove),
            'add_tags': JSON.stringify(add),
        });
    }
}

function _updateTagsLabel(tags_change) {
    tagsAdded += tags_change;
    if (tagsAdded < 0)
        tagsAdded = 0;
    if (tagsAdded > 0) {
        var tagLabel = tagsAdded == 1? 'Tag': 'Tags'
        window.instapaperUpdateOverlayText(`Added ${tagsAdded} ${tagLabel}`, '');
    }
    else {
        window.instapaperUpdateOverlayText('Saved', '');
    }
}

function _addAvailableTag(tag_data) {
    var availableTagsContainer = document.getElementById('instapaper-tags-available');
    var availableTag = _availableTagRow(tag_data, false);
    var i = 0;
    for (; i < availableTags.length; i++) {
        if (availableTags[i].slug >= tag_data.slug) {
            break;
        }       
    }           
    if (i == availableTags.length) {
        availableTags.push(tag_data);
        availableTagsContainer.appendChild(availableTag);
        if (i == 0) { /* availableTags.length was zero, needs a reflow */
            safariReflowElement(availableTagsContainer);
        }
    }
    else {  
        availableTags.splice(i, 0, tag_data);
        availableTagsContainer.insertBefore(availableTag, availableTagsContainer.children[i]);
    }
}


function _addTag(tag_data) {
    var currentTagIndex = _currentTagIndexForText(tag_data.slug);
    if (currentTagIndex != -1) {
        return; /* No-op */
    }

    _updateTagsLabel(1);
    var index = _availableTagIndexForText(tag_data.slug);
    if (index != -1) {
        availableTags.splice(index, 1);
        if (availableTags.length == 0) {
            var availableTagsContainer = document.getElementById('instapaper-tags-available');
            safariReflowElement(availableTagsContainer);
        }
    }
    currentTags.push(tag_data);
    _addCurrentTagElem(tag_data, true);
    
    addedTags.push(tag_data);
    _updateTagsChanges([], [tag_data]);
}


function _removeTag(currentTagElem, tag_data) {
    var currentTagIndex = _currentTagIndexForText(tag_data.slug);
    if (currentTagIndex != -1) {
        currentTags.splice(currentTagIndex, 1);
    }
    _addAvailableTag(tag_data);
    _updateTagsLabel(-1);

    removedTags.push(tag_data);
    addedTags = addedTags.filter((tag_iter) => tag_iter.slug != tag_data.slug);
    _updateTagsChanges([tag_data], []);
    
    currentTagElem.classList.add('instapaper-tag-hidden');
    setTimeout(function() {
        currentTagElem.remove();
    }, 150);
}


function _tagsDropdownVisibleToggle(e) {
    var tagsDropdown = document.getElementById('instapaper-tags-dropdown');
    var folderDropdown = document.getElementById('ofd');
    window.instapaperHideDropdown(folderDropdown);
    window.instapaperDropdownVisibleToggle(e, tagsDropdown);
}

function _filterAvailableTags(query) {
    var availableTagsContainer = document.getElementById('instapaper-tags-available');
    availableTagsContainer.replaceChildren([]);

    if (query.length == 0) {
        for (var i = 0; i < availableTags.length; i++) {
            var availableTagElem = _availableTagRow(availableTags[i], false);
            availableTagsContainer.appendChild(availableTagElem);
        }
        safariReflowElement(availableTagsContainer);
        return;
    }


    var exactMatch = false;
    for (var i = 0; i < currentTags.length; i++) {
        var currentTag = currentTags[i];
        exactMatch = currentTag.slug == _tagNormalizeText(query);
        if (exactMatch) {
            break;
        }
    }

    for (var i = 0; i < availableTags.length; i++) {
        var availableTag = availableTags[i];
        if (availableTag.slug.startsWith(_tagNormalizeText(query))) {
            var availableTagElem = _availableTagRow(availableTag, false);
            availableTagsContainer.appendChild(availableTagElem);
            
            exactMatch = exactMatch || availableTag.slug == _tagNormalizeText(query);
        }
    }

    if (!exactMatch) {
        var availableTagElem = _availableTagRow({'name': query, 'slug': _tagNormalizeText(query)}, true);
        if (availableTagsContainer.children.length > 0) {
            availableTagsContainer.insertBefore(availableTagElem, availableTagsContainer.children[0]);
        }
        else {
            availableTagsContainer.appendChild(availableTagElem);
            safariReflowElement(availableTagsContainer);
        }
    }
}


function _tagNormalizeText(text) {
    return text.toLowerCase().replace('/', '').replace(/\s+/g, ' ').trim()
}

function _currentTagIndexForText(text) {
    for (var i = 0; i < currentTags.length; i++) {
        var currentTag = currentTags[i];
        if (currentTag.slug == _tagNormalizeText(text)) {
            return i;
        }
    }
    return -1;
}

function _availableTagIndexForText(text) {
    for (var i = 0; i < availableTags.length; i++) {
        var availableTag = availableTags[i];
        if (availableTag.slug == _tagNormalizeText(text)) {
            return i;
        }
    }
    return -1;
}


function _addTextInputTag(input, text) {
    if (enterHandled || text.length == 0) {
        return;
    }
    enterHandled = true;

    var availableTagIndex = _availableTagIndexForText(text);
    var tagToAdd = undefined;
    if (availableTagIndex != -1) {
        tagToAdd = availableTags[availableTagIndex];
        availableTags.splice(availableTagIndex, 1);
    }
    else {
        tagToAdd = {'name': text, 'slug': _tagNormalizeText(text)}
    }

    _addTag(tagToAdd);
    /* Reset */
    _filterAvailableTags('');
    input.value = '';
    enterHandled = false;
}


function _initializeTagsDropdown(json) {
    resetGlobals();
    try {
        var scale = window.innerWidth / screen.availWidth || 1;
        if (scale > 1)
            return;

        var inTagsBeta = json.tags_beta;
        if (window.instapaperBookmarkId && inTagsBeta) {
            currentTags = json.bookmark_tags || [];
            var currentTagIds = currentTags.map((tag_data) => tag_data.id)
            availableTags = json.all_tags.filter((tag_data) => currentTagIds.indexOf(tag_data.id) == -1);

            var tagsButton = document.getElementById('instapaper-tags-button');
            tagsButton.classList.remove('instapaper-icon-hidden');

            for (var i = 0; i < currentTags.length; i++) {
                _addCurrentTagElem(currentTags[i], false);
            }

            var availableTagsContainer = document.getElementById('instapaper-tags-available');
            availableTags.sort(function(a, b) {
                return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
            });
            for (var i = 0; i < availableTags.length; i++) {
                var availableTagElem = _availableTagRow(availableTags[i], false);
                availableTagsContainer.appendChild(availableTagElem);
            }
        }
    } catch (e) {
        console.log('Tags error: ' + e);
    }
}



/****** User Interface Functions *******/

function safariReflowElement(elem) {
    if (!window.instapaperIsSafari) {
        return;
    }
    
    /* Force a reflow of the element
     * It does not seem Safari animates
     * on the :empty selector
     */
    elem.style.display = 'none';
    elem.style.display = 'flex';
}

function _availableTagRow(tag_data, isNewTag) {
    var tag = document.createElement('div');
    tag.classList.add('instapaper-available-tag');
    if (isNewTag) {
        tag.classList.add('instapaper-new-tag');
    }
    tag.setAttribute('data-tag-id', '' + tag_data.id);
    tagIcon = document.createElement('span');
    tagIcon.setAttribute('class', 'instapaper-tag-img');
    tag.appendChild(tagIcon);

    var text = isNewTag? `Create tag: ${tag_data.name}`: tag_data.name;
    tag.appendChild(document.createTextNode(text));
    tag.onclick = function(e) {
        _addTag(tag_data);
        e.target.remove();
        preventDefault(e);
        if (isNewTag) {
            var searchInput = document.getElementById('instapaper-tags-search-input');
            searchInput.value = '';
            _filterAvailableTags('');
        }
    }
    return tag;
}


function _addCurrentTagElem(tag_data, animated) {
    var tag = document.createElement('div');
    tag.setAttribute('class', 'instapaper-tag-current');
    tag.setAttribute('data-tag-id', tag_data.id);
    tag.appendChild(document.createTextNode(tag_data.name));

    removeIcon = document.createElement('span');
    removeIcon.classList.add('instapaper-icon-tiny');
    removeIcon.classList.add('instapaper-icon-close');
    tag.appendChild(removeIcon);

    tag.onclick = function(e) {
        var currentTagElem = e.target;
        while (!currentTagElem.classList.contains('instapaper-tag-current')) {
            currentTagElem = currentTagElem.parentNode;
        }

        if (currentTagElem == undefined) {
            return;
        }

        _removeTag(currentTagElem, tag_data);
        preventDefault(e);
        return false;
    }

    var currentTagElem = document.getElementById('instapaper-tags-current');

    if (animated) {
        tag.classList.add('instapaper-tag-hidden');
        safariReflowElement(currentTagElem);
    }
    currentTagElem.appendChild(tag);
    if (animated) {
        setTimeout(function() {
            tag.classList.remove('instapaper-tag-hidden');
        }, 100);
    }
}


function _tagsDropdown() {
    var tagsButton = document.createElement('div');
    tagsButton.setAttribute('id', 'instapaper-tags-button');
    tagsButton.classList.add('instapaper-icon');
    tagsButton.classList.add('instapaper-icon-hidden');
    tagsButton.onclick = _tagsDropdownVisibleToggle;
    addTooltip(tagsButton, 'Tags');

    tagsDropdown = document.createElement('div');
    tagsDropdown.setAttribute('id', 'instapaper-tags-dropdown');
    tagsDropdown.setAttribute('style', 'visibility: hidden;');
    tagsDropdown.classList.add('instapaper-dropdown');
    tagsDropdown.onclick = preventDefault

    tagsArrowContainer  = document.createElement('div');
    tagsArrowContainer.setAttribute('id', 'instapaper-tags-arrow-container');
    tagsArrowContainer.classList.add('instapaper-arrow-container');
    tagsArrowIndicator = document.createElement('div');
    tagsArrowIndicator.setAttribute('id', 'instapaper-tags-arrow-indicator');
    tagsArrowIndicator.classList.add('instapaper-arrow');
    tagsArrowContainer.appendChild(tagsArrowIndicator);
    tagsDropdown.append(tagsArrowContainer);

    tagsBodyContainer = document.createElement('div');

    searchTags = document.createElement('div');
    searchTags.setAttribute('id', 'instapaper-tags-search');

    searchIcon = document.createElement('span');
    searchIcon.classList.add('instapaper-icon-search');
    searchIcon.classList.add('instapaper-icon-small');
    searchTags.appendChild(searchIcon);

    searchInput = document.createElement('input');
    searchInput.setAttribute('id', 'instapaper-tags-search-input');
    searchInput.setAttribute('placeholder', 'Add Tags');
    searchInput.onfocus = preventDefault;
    searchInput.addEventListener("input", function(e) {
        enterHandled = false;
        _filterAvailableTags(searchInput.value);
    });
    searchInput.addEventListener("keydown", function(e) {
        if (e.key == "Enter") {
            _addTextInputTag(searchInput, searchInput.value);
        }
    });
    searchTags.appendChild(searchInput);

    tagsDropdown.append(searchTags);

    currentTags = document.createElement('div');
    currentTags.setAttribute('id', 'instapaper-tags-current');
    tagsDropdown.append(currentTags);

    allTags = document.createElement('div');
    allTags.setAttribute('id', 'instapaper-tags-available');
    tagsBodyContainer.append(allTags);

    tagsDropdown.append(tagsBodyContainer);

    tagsButton.append(tagsDropdown);
    return tagsButton;
}


/********* Export global handlers ****************/
window.instapaperCreateTagsDropdown = _tagsDropdown
window.instapaperInitializeTagsDropdown = _initializeTagsDropdown
