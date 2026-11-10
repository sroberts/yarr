function showPremiumModal(message) {
    var modal_backer = document.getElementById('instapaper-modal-backer');
    var premium_modal = document.getElementById('instapaper-premium-modal');
    if (premium_modal && modal_backer) {
        modal_backer.classList.add('active');
        premium_modal.classList.add('active');
        return;
    }

    var modal_backer = document.createElement('div');
    modal_backer.setAttribute('id', 'instapaper-modal-backer');
    modal_backer.setAttribute('class', 'instapaper-modal-backer');
    modal_backer.onclick = dismissModal;

    var modal = document.createElement('div');
    modal.setAttribute('id', 'instapaper-premium-modal');
    modal.setAttribute('class', 'instapaper-modal');

    var modal_title = document.createElement('div');
    modal_title.setAttribute('class', 'instapaper-modal-title');
    modal_title.appendChild(document.createTextNode('Upgrade to Premum'));

    var modal_close = document.createElement('div');
    modal_close.setAttribute('class', 'instapaper-modal-close');
    modal_close.appendChild(document.createTextNode('✕'));
    modal_close.onclick = dismissModal;

    var modal_group = document.createElement('div');
    modal_group.setAttribute('class', 'instapaper-modal-group');
    
    var modal_message = document.createElement('div');
    modal_message.appendChild(document.createTextNode(message));
    
    var premium_features = premiumFeatures();
    var premium_buttons = premiumSubscribeButtons();

    modal_group.appendChild(modal_message);
    modal_group.appendChild(premium_features);
    modal_group.appendChild(premium_buttons);
    
    modal.appendChild(modal_title);
    modal.appendChild(modal_close);
    modal.appendChild(modal_group);
    document.body.appendChild(modal_backer);
    document.body.appendChild(modal);
    setTimeout(function() {
        modal_backer.classList.add('active');
        modal.classList.add('active');
    }, 100);
}

window.instapaperShowPremiumModal = showPremiumModal;

function premiumFeatures() {
    var premium_features = document.createElement('div');
    premium_features.setAttribute('class', 'instapaper-premium-features');

    var features = [
        {'title': 'Full-Text Search', 'description': 'Search through all of the articles you\'ve saved to Instapaper, even ones you\'ve archived.', 'image_name': 'instapaper-premium-img-search'},
        {'title': 'Permanent Archive', 'description': 'Stores a permanent copy of your articles so they will always be available, even if they disappear from the Internet.', 'image_name': 'instapaper-premium-img-archive'},
        {'title': 'Unlimited Notes', 'description': 'Never worry about the 5-note monthly limit again.', 'image_name': 'instapaper-premium-img-notes'},
        {'title': 'Text-to-Speech Playlists', 'description': 'Create a playlist of saved articles, turn up the volume, and relax. (iOS & Android only)', 'image_name': 'instapaper-premium-img-playlist'},
    ];
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var premium_feature = premiumFeature(feature.title, feature.description, feature.image_name);
        premium_features.appendChild(premium_feature);
    }
    return premium_features;
}

function premiumFeature(title, description, image_name) {
    var premium_row = document.createElement('div');
    premium_row.setAttribute('class', 'instapaper-premium-row');
    
    var premium_feature = document.createElement('div');
    premium_feature.setAttribute('class', 'instapaper-premium-feature');

    var premium_image = document.createElement('div');
    premium_image.setAttribute('class', 'instapaper-premium-img ' + image_name);

    var premium_text = document.createElement('div');
    premium_text.setAttribute('class', 'instapaper-premium-text');

    var premium_title = document.createElement('div');
    premium_title.setAttribute('class', 'instapaper-premium-title');
    premium_title.appendChild(document.createTextNode(title));

    var premium_description = document.createElement('div');
    premium_description.setAttribute('class', 'instapaper-premium-description');
    premium_description.appendChild(document.createTextNode(description));

    premium_text.appendChild(premium_title);
    premium_text.appendChild(premium_description);

    premium_feature.appendChild(premium_image);
    premium_feature.appendChild(premium_text);

    premium_row.appendChild(premium_feature);
    return premium_row;
}

function premiumSubscribeButtons() {
    var button_container = document.createElement('div');

    var monthly_button = document.createElement('a');
    monthly_button.setAttribute('class', 'instapaper-button instapaper-premium-button instapaper-premium-monthly');
    monthly_button.setAttribute('href', 'https://www.instapaper.com/stripe/checkout?monthly=1');
    monthly_button.setAttribute('target', 'blank');

    var monthly_price = document.createElement('span');
    monthly_price.setAttribute('class', 'instapaper-price');
    monthly_price.appendChild(document.createTextNode('$5.99'));

    monthly_button.appendChild(monthly_price);
    monthly_button.appendChild(document.createTextNode(' per month'));

    var yearly_button = document.createElement('a');
    yearly_button.setAttribute('class', 'instapaper-button instapaper-premium-button instapaper-premium-yearly');
    yearly_button.setAttribute('href', 'https://www.instapaper.com/stripe/checkout?yearly=1');
    yearly_button.setAttribute('target', 'blank');

    var yearly_price = document.createElement('span');
    yearly_price.setAttribute('class', 'instapaper-price');
    yearly_price.appendChild(document.createTextNode('$59.99'));
    yearly_button.appendChild(yearly_price);
    yearly_button.appendChild(document.createTextNode(' per year'));

    button_container.appendChild(monthly_button);
    button_container.appendChild(yearly_button);

    return button_container;
}

function dismissModal() {
    var modal_backer = document.getElementById('instapaper-modal-backer');
    modal_backer.classList.remove('active');

    var modal = document.getElementById('instapaper-premium-modal');
    modal.classList.remove('active');
}
