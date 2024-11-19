document.addEventListener('DOMContentLoaded', function() {
    const tagInput = document.getElementById('tagInput');
    const tagContainer = document.getElementById('tagContainer');
    const suggestTagsBtn = document.getElementById('suggestTagsBtn');
    const suggestedTags = document.getElementById('suggestedTags');
    const noteContent = document.getElementById('noteContent');
    const modelSelect = document.getElementById('modelSelect');
    
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    let retryCount = 0;

    function createTagElement(tagName) {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'badge bg-secondary me-1 mb-1';
        tagSpan.innerHTML = `
            ${tagName}
            <input type="hidden" name="tags[]" value="${tagName}">
            <button type="button" class="btn-close btn-close-white" aria-label="Remove"></button>
        `;
        
        tagSpan.querySelector('.btn-close').addEventListener('click', function() {
            tagSpan.remove();
            updateSuggestedTags();
        });
        
        return tagSpan;
    }

    function getExistingTags() {
        return Array.from(tagContainer.children).map(tag => 
            tag.textContent.toLowerCase().trim()
        );
    }

    function addTag(tagName) {
        const normalizedTag = tagName.toLowerCase().trim();
        if (!normalizedTag) return false;

        const existingTags = getExistingTags();
        if (existingTags.includes(normalizedTag)) {
            showFeedback(`Tag "${normalizedTag}" already exists`, 'warning');
            return false;
        }

        tagContainer.appendChild(createTagElement(normalizedTag));
        updateSuggestedTags();
        return true;
    }

    function showFeedback(message, type = 'info', autoHide = true) {
        const feedback = document.createElement('div');
        feedback.className = `alert alert-${type} alert-dismissible fade show mt-2`;
        feedback.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        suggestedTags.appendChild(feedback);
        
        if (autoHide) {
            setTimeout(() => {
                if (feedback.parentNode === suggestedTags) {
                    feedback.remove();
                }
            }, 3000);
        }
    }

    function updateSuggestedTags() {
        const existingTags = getExistingTags();
        const suggestionButtons = suggestedTags.querySelectorAll('button');
        
        suggestionButtons.forEach(btn => {
            if (btn.classList.contains('tag-suggestion')) {
                const tagName = btn.textContent.toLowerCase().trim();
                if (existingTags.includes(tagName)) {
                    btn.disabled = true;
                    btn.classList.remove('btn-outline-info', 'btn-outline-secondary');
                    btn.classList.add('btn-success');
                }
            }
        });
    }

    tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tags = this.value.split(',');
            let added = false;
            tags.forEach(tag => {
                if (addTag(tag)) added = true;
            });
            this.value = '';
        }
    });

    async function suggestTags(retry = false) {
        const content = noteContent.value;
        const model = modelSelect.value;
        
        if (content.length < 10) {
            showFeedback('Please add more content before requesting tag suggestions', 'warning');
            return;
        }

        try {
            suggestTagsBtn.disabled = true;
            suggestTagsBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Suggesting...';
            
            const response = await fetch(`/api/suggest-tags?content=${encodeURIComponent(content)}&model=${encodeURIComponent(model)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            retryCount = 0; // Reset retry counter on success
            suggestedTags.innerHTML = '';
            
            if (data.suggestions && data.suggestions.length > 0) {
                const suggestionsDiv = document.createElement('div');
                suggestionsDiv.className = 'mb-2';
                suggestionsDiv.innerHTML = `
                    <p class="text-muted mb-2">
                        Suggested tags: (${data.new} new, ${data.total - data.new} existing)
                    </p>
                `;
                
                data.suggestions.forEach(suggestion => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `btn btn-sm me-1 mb-1 tag-suggestion ${suggestion.exists ? 'btn-outline-secondary' : 'btn-outline-info'}`;
                    btn.textContent = suggestion.name;
                    
                    if (suggestion.exists) {
                        btn.title = `Used ${suggestion.usage_count} times in your notes`;
                    }
                    
                    const existingTags = getExistingTags();
                    if (existingTags.includes(suggestion.name)) {
                        btn.disabled = true;
                        btn.classList.remove('btn-outline-info', 'btn-outline-secondary');
                        btn.classList.add('btn-success');
                    }
                    
                    btn.addEventListener('click', function() {
                        if (addTag(suggestion.name)) {
                            btn.disabled = true;
                            btn.classList.remove('btn-outline-info', 'btn-outline-secondary');
                            btn.classList.add('btn-success');
                        }
                    });
                    
                    suggestionsDiv.appendChild(btn);
                });
                
                suggestedTags.appendChild(suggestionsDiv);
            } else {
                showFeedback('No tag suggestions found', 'info');
            }
        } catch (error) {
            console.error('Error getting tag suggestions:', error);
            
            if (!retry && retryCount < MAX_RETRIES) {
                retryCount++;
                showFeedback(`Retrying suggestion request (${retryCount}/${MAX_RETRIES})...`, 'warning', false);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await suggestTags(true);
                return;
            }
            
            showFeedback(`Error: ${error.message}. Please try again later.`, 'danger');
        } finally {
            suggestTagsBtn.disabled = false;
            suggestTagsBtn.textContent = 'Suggest Tags';
        }
    }

    suggestTagsBtn.addEventListener('click', () => suggestTags());

    // Add keyboard shortcut for suggesting tags
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            suggestTags();
        }
    });
    
    // Add visual feedback for keyboard shortcut
    suggestTagsBtn.setAttribute('title', 'Shortcut: Ctrl+T');
});
