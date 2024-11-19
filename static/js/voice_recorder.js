document.addEventListener('DOMContentLoaded', function() {
    const startRecordingBtn = document.getElementById('startRecording');
    const stopRecordingBtn = document.getElementById('stopRecording');
    const recordingStatus = document.getElementById('recordingStatus');
    const noteContent = document.getElementById('noteContent');

    // Create canvas element for waveform
    const canvas = document.createElement('canvas');
    canvas.id = 'waveformCanvas';
    canvas.width = 600;
    canvas.height = 100;
    canvas.style.display = 'none';
    canvas.style.backgroundColor = '#2b3035';
    canvas.style.borderRadius = '4px';
    canvas.style.marginTop = '10px';
    canvas.style.width = '100%';

    // Insert canvas after recording buttons
    const recordingControls = startRecordingBtn.parentElement;
    recordingControls.appendChild(canvas);

    let mediaRecorder;
    let audioChunks = [];
    let audioContext;
    let analyser;
    let mediaStreamSource;
    let animationFrame;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    // Enhanced browser detection with version and feature checking
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        const browserData = {
            name: 'Other',
            version: '0',
            isMobile: /Mobile|Android|iPhone/i.test(ua),
            hasAdvancedAudio: false,
            hasVisualization: false,
            hasWorklet: false
        };

        if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
            browserData.name = 'Safari';
            browserData.version = ua.match(/Version\/(\d+)/)?.[1] || '0';
        } else if (/Chrome/i.test(ua)) {
            browserData.name = 'Chrome';
            browserData.version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
        } else if (/Firefox/i.test(ua)) {
            browserData.name = 'Firefox';
            browserData.version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
        }

        browserData.hasAdvancedAudio = typeof AudioContext !== 'undefined';
        browserData.hasVisualization = typeof AnalyserNode !== 'undefined';
        browserData.hasWorklet = typeof AudioWorkletNode !== 'undefined';

        return browserData;
    }

    // Enhanced MIME type detection with quality tiers and progressive enhancement
    function getBestSupportedFormat() {
        const browser = getBrowserInfo();
        const formats = {
            high: [
                { mimeType: 'audio/webm;codecs=opus', bitrate: 128000, sampleRate: 48000 },
                { mimeType: 'audio/mp4;codecs=mp4a.40.2', bitrate: 128000, sampleRate: 44100 },
                { mimeType: 'audio/ogg;codecs=opus', bitrate: 128000, sampleRate: 48000 }
            ],
            medium: [
                { mimeType: 'audio/webm', bitrate: 96000, sampleRate: 44100 },
                { mimeType: 'audio/mp4', bitrate: 96000, sampleRate: 44100 },
                { mimeType: 'audio/ogg', bitrate: 96000, sampleRate: 44100 }
            ],
            low: [
                { mimeType: 'audio/aac', bitrate: 64000, sampleRate: 22050 },
                { mimeType: 'audio/x-m4a', bitrate: 64000, sampleRate: 22050 },
                { mimeType: 'audio/wav', bitrate: 256000, sampleRate: 44100 }
            ]
        };

        let qualityTiers = ['high', 'medium', 'low'];
        if (browser.isMobile || browser.name === 'Safari') {
            qualityTiers = ['medium', 'low', 'high'];
        }

        for (const tier of qualityTiers) {
            for (const format of formats[tier]) {
                if (MediaRecorder.isTypeSupported(format.mimeType)) {
                    console.log(`Selected format: ${format.mimeType} at ${format.bitrate}bps, ${format.sampleRate}Hz`);
                    return format;
                }
            }
        }

        return { mimeType: 'audio/wav', bitrate: 256000, sampleRate: 44100 };
    }

    // Enhanced audio constraints with progressive features
    function getOptimalAudioConstraints() {
        const browser = getBrowserInfo();
        const constraints = {
            audio: {
                channelCount: { ideal: 1 },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };

        if (browser.hasAdvancedAudio) {
            constraints.audio.sampleRate = { ideal: browser.name === 'Safari' ? 44100 : 48000 };
            constraints.audio.latency = { ideal: 0.01 };
            constraints.audio.sampleSize = { ideal: 24 };
            
            if (!browser.isMobile) {
                constraints.audio.channelCount = { ideal: 2 };
            }
        } else {
            constraints.audio.sampleRate = { ideal: 44100 };
            constraints.audio.sampleSize = { ideal: 16 };
        }

        return constraints;
    }

    // Initialize audio context and analyzer for visualization
    async function initializeAudioContext(stream) {
        const browser = getBrowserInfo();
        if (!browser.hasAdvancedAudio || !browser.hasVisualization) {
            console.log('Advanced audio features not supported');
            return null;
        }

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            mediaStreamSource = audioContext.createMediaStreamSource(stream);
            
            // Configure analyser node for waveform visualization
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.3;
            mediaStreamSource.connect(analyser);

            return analyser;
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            return null;
        }
    }

    // Enhanced visualization with waveform display
    function visualizeAudio() {
        if (!analyser) return;

        const canvas = document.getElementById('waveformCanvas');
        const canvasCtx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function draw() {
            if (!mediaRecorder || mediaRecorder.state !== 'recording') {
                cancelAnimationFrame(animationFrame);
                canvas.style.display = 'none';
                return;
            }

            animationFrame = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            // Clear canvas and set styles
            canvasCtx.fillStyle = '#2b3035';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#00ff00';
            canvasCtx.beginPath();

            // Draw waveform
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();

            // Calculate and display volume level
            const average = dataArray.reduce((acc, val) => acc + Math.abs(val - 128), 0) / bufferLength;
            const level = Math.min(100, Math.round((average / 128) * 100));
            recordingStatus.textContent = `Recording... Level: ${level}%`;
        }

        draw();
    }

    // Reset UI state with enhanced feedback
    function resetUIState(error = false) {
        startRecordingBtn.style.display = 'inline-block';
        stopRecordingBtn.style.display = 'none';
        recordingStatus.style.display = error ? 'inline-block' : 'none';
        
        const canvas = document.getElementById('waveformCanvas');
        canvas.style.display = 'none';
        
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    }

    // Update status with enhanced visual feedback
    function updateStatus(message, isError = false) {
        recordingStatus.textContent = message;
        recordingStatus.className = `badge ${isError ? 'bg-danger' : 'bg-info'} ms-2`;
        recordingStatus.style.display = 'inline-block';
    }

    // Enhanced transcription with retry mechanism
    async function transcribeWithRetry(formData, retryCount = 0) {
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Transcription response:', data);

            if (data.text) {
                return data.text;
            } else if (data.error) {
                throw new Error(data.error);
            }
            throw new Error('No transcription text received');

        } catch (error) {
            console.error(`Transcription attempt ${retryCount + 1} failed:`, error);
            
            if (retryCount < MAX_RETRIES) {
                updateStatus(`Retrying transcription (${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return transcribeWithRetry(formData, retryCount + 1);
            }
            throw error;
        }
    }

    async function startRecording() {
        audioChunks = [];
        resetUIState();

        try {
            const browser = getBrowserInfo();
            console.log('Initializing recording with browser capabilities:', browser);
            
            const format = getBestSupportedFormat();
            if (!format) {
                throw new Error('No supported audio recording format found');
            }

            console.log('Requesting audio permissions with optimal constraints...');
            const constraints = getOptimalAudioConstraints();
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Audio stream settings:', stream.getAudioTracks()[0].getSettings());

            // Initialize audio context and visualization
            if (browser.hasAdvancedAudio) {
                await initializeAudioContext(stream);
            }

            try {
                const recorderOptions = {
                    mimeType: format.mimeType,
                    audioBitsPerSecond: format.bitrate
                };

                mediaRecorder = new MediaRecorder(stream, recorderOptions);
                console.log('MediaRecorder initialized:', {
                    mimeType: mediaRecorder.mimeType,
                    state: mediaRecorder.state,
                    ...recorderOptions
                });
            } catch (recorderError) {
                console.error('MediaRecorder initialization failed:', recorderError);
                throw new Error(`Failed to initialize audio recorder: ${recorderError.message}`);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log(`Received audio chunk: ${event.data.size} bytes`);
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('Recording stopped, processing audio...');
                updateStatus('Processing recording...');

                const audioBlob = new Blob(audioChunks, { type: format.mimeType });
                console.log(`Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

                if (audioBlob.size === 0) {
                    throw new Error('No audio data recorded');
                }

                const formData = new FormData();
                const fileExtension = format.mimeType.split('/')[1].split(';')[0];
                formData.append('audio', audioBlob, `recording.${fileExtension}`);

                try {
                    updateStatus('Transcribing...');
                    const transcribedText = await transcribeWithRetry(formData);
                    
                    const currentContent = noteContent.value;
                    noteContent.value = currentContent + (currentContent ? '\n\n' : '') + transcribedText;
                    resetUIState();
                    updateStatus('Transcription completed', false);
                    setTimeout(() => resetUIState(), 2000);

                } catch (error) {
                    console.error('Final transcription error:', error);
                    updateStatus(`Error: ${error.message}`, true);
                }

                // Clean up
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Audio track stopped:', track.label);
                });
                
                if (audioContext) {
                    await audioContext.close();
                    audioContext = null;
                    analyser = null;
                    mediaStreamSource = null;
                }
                
                audioChunks = [];
            };

            mediaRecorder.onerror = (error) => {
                console.error('MediaRecorder error:', error);
                updateStatus(`Recording error: ${error.message}`, true);
                resetUIState(true);
            };

            // Start recording with dynamic time slicing based on browser capabilities
            const timeslice = browser.name === 'Safari' ? 500 : 1000;
            mediaRecorder.start(timeslice);
            console.log(`Recording started with timeslice: ${timeslice}ms`);
            
            startRecordingBtn.style.display = 'none';
            stopRecordingBtn.style.display = 'inline-block';
            document.getElementById('waveformCanvas').style.display = 'block';
            updateStatus('Recording...', false);

            // Start audio visualization if supported
            if (analyser) {
                visualizeAudio();
            }

        } catch (error) {
            console.error('Failed to start recording:', error);
            updateStatus(`Error: ${error.message}`, true);
            resetUIState(true);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            console.log('Stopping recording...');
            mediaRecorder.stop();
            updateStatus('Processing...');
        }
    }

    if (startRecordingBtn && stopRecordingBtn) {
        startRecordingBtn.addEventListener('click', startRecording);
        stopRecordingBtn.addEventListener('click', stopRecording);
        console.log('Voice recorder initialized with waveform visualization support');
    }
});
