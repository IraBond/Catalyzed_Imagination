document.addEventListener('DOMContentLoaded', function() {
    const noteContent = document.getElementById('noteContent');
    const modelSelect = document.getElementById('modelSelect');
    const expandIdeasBtn = document.getElementById('expandIdeasBtn');
    const analyzeConceptBtn = document.getElementById('analyzeConceptBtn');
    const relatedIdeasBtn = document.getElementById('relatedIdeasBtn');
    const mindMapBtn = document.getElementById('mindMapBtn');
    const aiThread = document.getElementById('aiThread');

    // UI containers
    const expandedIdeasDiv = document.querySelector('#expandedIdeas');
    const conceptAnalysisDiv = document.querySelector('#conceptAnalysis');
    const relatedIdeasDiv = document.querySelector('#relatedIdeas');
    const mindMapDiv = document.querySelector('#mindMap');
    const initialMessage = document.querySelector('.initial-message');

    // Function to update the conversation thread
    async function updateConversationThread() {
        const noteId = document.querySelector('input[name="note_id"]')?.value;
        if (!noteId) return;

        try {
            const response = await fetch(`/api/note/${noteId}/interactions`);
            if (!response.ok) throw new Error('Failed to fetch interactions');
            const data = await response.json();
            
            renderConversationThread(data.interactions);
        } catch (error) {
            console.error('Error updating conversation thread:', error);
        }
    }

    // Function to render the conversation thread
    function renderConversationThread(interactions) {
        if (!aiThread) return;

        aiThread.innerHTML = interactions.length ? '' : '<p class="text-muted">Start a conversation by using the AI tools...</p>';
        
        interactions.forEach(interaction => {
            const threadItem = document.createElement('div');
            threadItem.className = 'thread-item mb-3';
            threadItem.dataset.interactionId = interaction.id;
            
            threadItem.innerHTML = `
                <div class="d-flex justify-content-between">
                    <small class="text-muted">${interaction.model}</small>
                    <small class="text-muted">${new Date(interaction.created_at).toLocaleString()}</small>
                </div>
                <div class="content">${interaction.content}</div>
                <div class="actions mt-2">
                    <button class="btn btn-sm btn-outline-primary reply-btn">Reply</button>
                    <button class="btn btn-sm btn-outline-success add-to-note-btn">Add to Note</button>
                </div>
            `;
            
            if (interaction.metadata?.chain_insights) {
                const responsesDiv = document.createElement('div');
                responsesDiv.className = 'responses ms-4 mt-2';
                interaction.metadata.chain_insights.forEach(insight => {
                    responsesDiv.innerHTML += `
                        <div class="response-item mb-2">
                            <small class="text-muted">${insight.model}</small>
                            <div class="content">${insight.content}</div>
                        </div>
                    `;
                });
                threadItem.appendChild(responsesDiv);
            }
            
            aiThread.insertBefore(threadItem, aiThread.firstChild);
        });
        
        // Attach event listeners to new elements
        attachThreadEventListeners();
    }

    // Function to attach event listeners to thread items
    function attachThreadEventListeners() {
        document.querySelectorAll('.add-to-note-btn').forEach(button => {
            button.addEventListener('click', function() {
                const content = this.closest('.thread-item').querySelector('.content').textContent;
                appendToNote(content);
            });
        });

        document.querySelectorAll('.reply-btn').forEach(button => {
            button.addEventListener('click', function() {
                const interactionId = this.closest('.thread-item').dataset.interactionId;
                const content = noteContent.value;
                handleReply(interactionId, content);
            });
        });
    }

    // Function to append content to note
    function appendToNote(content) {
        const currentContent = noteContent.value;
        noteContent.value = currentContent + (currentContent ? '\n\n' : '') + content;
        noteContent.dispatchEvent(new Event('input'));
    }

    // Function to handle replies
    async function handleReply(parentId, content) {
        const noteId = document.querySelector('input[name="note_id"]')?.value;
        if (!noteId || !content) return;

        try {
            const response = await fetch(`/api/analyze-concept-chain?content=${encodeURIComponent(content)}&note_id=${noteId}&parent_id=${parentId}`);
            if (!response.ok) throw new Error('Failed to send reply');
            
            // Update the conversation thread
            await updateConversationThread();
        } catch (error) {
            console.error('Error sending reply:', error);
        }
    }

    async function fetchBrainstormingData(endpoint) {
        const content = noteContent.value;
        const model = modelSelect.value;
        const noteId = document.querySelector('input[name="note_id"]')?.value;
        
        if (!content) {
            alert('Please enter some content first.');
            return null;
        }

        try {
            const response = await fetch(`/api/${endpoint}?content=${encodeURIComponent(content)}&model=${encodeURIComponent(model)}${noteId ? `&note_id=${noteId}` : ''}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            const data = await response.json();
            
            // Update conversation thread after each interaction
            await updateConversationThread();
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            return null;
        }
    }

    function displayChainInsights(container, data) {
        if (!data.chain_insights) return;
        
        const insightsHtml = data.chain_insights.map(insight => `
            <div class="card mb-2">
                <div class="card-body">
                    <h6 class="card-subtitle mb-2 text-muted">${insight.model}</h6>
                    <p class="card-text">${insight.content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `).join('');
        
        container.innerHTML += `
            <div class="mt-3">
                <h6>AI Model Insights:</h6>
                ${insightsHtml}
            </div>
        `;
    }

    function updateUISection(container, content, chainData = null) {
        const contentDiv = container.querySelector('.content');
        contentDiv.innerHTML = `
            <div class="primary-content">
                ${content.replace(/\n/g, '<br>')}
            </div>
        `;
        
        if (chainData) {
            displayChainInsights(contentDiv, chainData);
        }
        
        container.style.display = 'block';
        initialMessage.style.display = 'none';
    }

    async function handleBrainstorming(endpoint, container, buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        
        const data = await fetchBrainstormingData(endpoint);
        
        if (data) {
            let content = '';
            if (endpoint === 'expand-idea-chain') {
                content = data.expanded;
                updateUISection(container, content, data);
            } else if (endpoint === 'analyze-concept-chain') {
                content = data.analysis;
                updateUISection(container, content, data);
            } else if (data.related_ideas) {
                content = data.related_ideas;
                updateUISection(container, content);
            } else if (data.mind_map) {
                content = data.mind_map;
                updateUISection(container, content);
            }
        }

        buttonElement.disabled = false;
        buttonElement.textContent = buttonElement.textContent.replace('Processing...', '').trim();
    }

    if (expandIdeasBtn) {
        expandIdeasBtn.addEventListener('click', () => {
            handleBrainstorming('expand-idea-chain', expandedIdeasDiv, expandIdeasBtn);
        });
    }

    if (analyzeConceptBtn) {
        analyzeConceptBtn.addEventListener('click', () => {
            handleBrainstorming('analyze-concept-chain', conceptAnalysisDiv, analyzeConceptBtn);
        });
    }

    if (relatedIdeasBtn) {
        relatedIdeasBtn.addEventListener('click', () => {
            handleBrainstorming('related-ideas', relatedIdeasDiv, relatedIdeasBtn);
        });
    }

    if (mindMapBtn) {
        mindMapBtn.addEventListener('click', () => {
            handleBrainstorming('mind-map', mindMapDiv, mindMapBtn);
        });
    }

    // Initial thread load if note_id exists
    const noteId = document.querySelector('input[name="note_id"]')?.value;
    if (noteId) {
        updateConversationThread();
    }
});
