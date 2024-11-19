document.addEventListener('DOMContentLoaded', function() {
    const noteContent = document.getElementById('noteContent');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summaryDiv = document.getElementById('summary');
    const modelSelect = document.getElementById('modelSelect');

    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', async function() {
            const content = noteContent.value;
            const model = modelSelect.value;
            try {
                enhanceBtn.disabled = true;
                enhanceBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enhancing...';
                const response = await fetch(`/api/enhance?content=${encodeURIComponent(content)}&model=${encodeURIComponent(model)}`);
                if (!response.ok) throw new Error('Failed to enhance note');
                const data = await response.json();
                if (data.enhanced) {
                    noteContent.value = data.enhanced;
                }
            } catch (error) {
                console.error('Error enhancing note:', error);
                summaryDiv.innerHTML = '<p class="text-danger">Error: Failed to enhance note</p>';
            } finally {
                enhanceBtn.disabled = false;
                enhanceBtn.textContent = 'Enhance with AI';
            }
        });
    }

    if (summarizeBtn && summaryDiv) {
        summarizeBtn.addEventListener('click', async function() {
            const content = noteContent.value;
            const model = modelSelect.value;
            try {
                summarizeBtn.disabled = true;
                summarizeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Summarizing...';
                summaryDiv.innerHTML = '<p class="text-muted">Generating summary...</p>';
                
                const response = await fetch(`/api/summarize?content=${encodeURIComponent(content)}&model=${encodeURIComponent(model)}`);
                if (!response.ok) throw new Error('Failed to summarize note');
                
                const data = await response.json();
                if (data.summary) {
                    summaryDiv.innerHTML = `<p>${data.summary}</p>`;
                } else {
                    throw new Error('No summary received');
                }
            } catch (error) {
                console.error('Error summarizing note:', error);
                summaryDiv.innerHTML = '<p class="text-danger">Error: Failed to generate summary</p>';
            } finally {
                summarizeBtn.disabled = false;
                summarizeBtn.textContent = 'Summarize';
            }
        });
    }
});
