const readBtn = document.querySelector('#read-btn');
readBtn.addEventListener('click', async () => {
    readBtn.textContent = 'Loading...';
    readBtn.disabled = true;
    try {
        // tu lógica de extracción
    } finally {
        readBtn.textContent = 'Read Here';
        readBtn.disabled = false;
    }
});