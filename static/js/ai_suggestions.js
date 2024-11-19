document.addEventListener('DOMContentLoaded', function() {
    const noteContent = document.getElementById('noteContent');
    const suggestionsDiv = document.getElementById('suggestions');
    const modelSelect = document.getElementById('modelSelect');
    let timeout = null;

    if (noteContent && suggestionsDiv) {
        noteContent.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(async function() {
                const content = noteContent.value;
                const model = modelSelect.value;
                if (content.length > 10) {
                    try {
                        const response = await fetch(`/api/suggestions?content=${encodeURIComponent(content)}&model=${encodeURIComponent(model)}`);
                        const data = await response.json();
                        if (data.suggestions) {
                            suggestionsDiv.innerHTML = `<p>${data.suggestions}</p>`;
                        }
                    } catch (error) {
                        console.error('Error getting suggestions:', error);
                    }
                }
            }, 1000);
        });
    }
});
