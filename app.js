// Burushaski Digital Archive - Application Controller
// Conforming to the visual layout and page architecture of digitalhimalaya.com

// Application State
const state = {
    currentView: 'home',          // 'home', 'audio-detail', 'lexicon', 'about'
    activePOS: 'all',
    searchQuery: '',
    currentlyPlaying: null,       // { id, audioEl, playBtn } (active audio record)
    dictAudioObj: null,           // Active pronunciation audio object
    dictAudioInterval: null       // Pronunciation playbounds timer
};

// Available SpeechSynthesis Voices for Fallback
let availableVoices = [];
function loadVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        availableVoices = window.speechSynthesis.getVoices();
    }
}
loadVoices();
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

// -------------------------------------------------------------
// View Management & Router
// -------------------------------------------------------------

function stopAllPlayback() {
    // Stop playing audio records
    if (state.currentlyPlaying) {
        state.currentlyPlaying.audioEl.pause();
        const btn = document.getElementById(`play-btn-${state.currentlyPlaying.id}`);
        if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Play';
        state.currentlyPlaying = null;
    }

    // Stop dictionary word audio
    if (state.dictAudioObj) {
        state.dictAudioObj.pause();
        state.dictAudioObj = null;
    }
    if (state.dictAudioInterval) {
        clearInterval(state.dictAudioInterval);
        state.dictAudioInterval = null;
    }

    // Cancel speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    // Reset pronunciation icons
    document.querySelectorAll('.speak-word-btn').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
    });
}

function updateBreadcrumb(steps) {
    const breadcrumb = document.getElementById('nav-breadcrumb');
    if (!breadcrumb) return;
    
    breadcrumb.innerHTML = '';
    
    steps.forEach((step, idx) => {
        const li = document.createElement('li');
        if (idx === steps.length - 1) {
            li.className = 'last';
            li.innerHTML = `<strong>${step.text}</strong>`;
        } else {
            li.innerHTML = `<a href="#" onclick="${step.action}">${step.text}</a>`;
        }
        breadcrumb.appendChild(li);
    });
}

// Show Home Dashboard View
function showHome() {
    stopAllPlayback();
    state.currentView = 'home';
    
    updateBreadcrumb([
        { text: 'Home', action: 'showHome()' }
    ]);

    const primary = document.getElementById('content-primary');
    if (!primary) return;

    primary.innerHTML = `
        <p><strong>A project to develop digital collection, storage, and distribution strategies for multimedia linguistic and ethnographic information from the Burushaski communities.</strong></p>
        <p>The Burushaski Digital Archive serves as a community-centered digital resource documenting the language isolate Burushaski. Spoken primarily in the high mountain valleys of Hunza, Nagar, and Yasin in Gilgit-Baltistan, a small historical diaspora community also preserves the language in the Hari Parbat area of Srinagar, India. This project presents collections of recorded oral narrative history, traditional songs, and a specialized bilingual dictionary focused on the endangered Srinagar dialect.</p>
        
        <div class="menu-wrapper">
            <dl class="menu">
                <dt>Collections</dt>
                
                <dd style="font-weight: bold; text-indent: 0; margin-top: 6px; border: none; font-family: var(--font-serif); font-size: 0.9rem; color: var(--accent-blue);">Stories</dd>
                <dd style="text-indent: 12px;"><a href="#" onclick="showAudioItem('arch_01')">An Intelligent Old Man</a></dd>
                
                <dd style="font-weight: bold; text-indent: 0; margin-top: 6px; border: none; font-family: var(--font-serif); font-size: 0.9rem; color: var(--accent-blue);">Poetry</dd>
                <dd style="text-indent: 12px;"><a href="#" onclick="showAudioItem('arch_02')">Um Ba Khudaye</a></dd>
                
                <dd style="font-weight: bold; text-indent: 0; margin-top: 6px; border: none; font-family: var(--font-serif); font-size: 0.9rem; color: var(--accent-blue);">Folk Songs</dd>
                <dd style="text-indent: 12px;"><a href="#" onclick="showAudioItem('arch_03')">Folk Song (Standard)</a></dd>
                <dd style="text-indent: 12px;"><a href="#" onclick="showAudioItem('arch_04')">Folk Song (Alternative)</a></dd>
            </dl>
            <dl class="menu">
                <dt>About the Project</dt>
                <dd><a href="#" onclick="showAbout()">Project Framework</a></dd>
            </dl>
        </div>
    `;
}

function parseTime(timeStr) {
    const parts = timeStr.split(' - ');
    if (parts.length !== 2) return null;
    
    const convert = (str) => {
        const timeParts = str.split(':');
        if (timeParts.length === 2) {
            return parseInt(timeParts[0]) * 60 + parseFloat(timeParts[1]);
        } else if (timeParts.length === 3) {
            return parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
        }
        return 0;
    };
    return { start: convert(parts[0]), end: convert(parts[1]) };
}

function renderTranscript(transcriptArray) {
    if (!transcriptArray) return '';
    return transcriptArray.map((line, index) => {
        const bounds = parseTime(line.time);
        const start = bounds ? bounds.start : 0;
        const end = bounds ? bounds.end : 0;
        return `<div class="transcript-line" id="transcript-line-${index}" data-start="${start}" data-end="${end}" style="padding: 6px 8px; border-bottom: 1px dotted var(--border-grey); cursor: pointer; transition: all 0.25s;" onclick="seekAudioTo(${start})">
            <span style="color: var(--accent-brown); font-family: var(--font-sans); font-size: 0.75rem; font-weight: bold; margin-right: 8px; display: inline-block; min-width: 85px;">[${line.time}]</span>
            <span class="transcript-text" style="font-family: var(--font-serif); font-size: 0.9rem;">${line.text}</span>
        </div>`;
    }).join('');
}

function seekAudioTo(seconds) {
    const player = state.soundArchivePlayers;
    if (!player) return;
    player.audioEl.currentTime = seconds;
    if (player.audioEl.paused) {
        toggleArchiveAudio(player.id);
    }
}

// Show Audio Record Detailed Card
function showAudioItem(id) {
    stopAllPlayback();
    state.currentView = 'audio-detail';
    
    const item = audioArchiveData.find(r => r.id === id);
    if (!item) return;

    updateBreadcrumb([
        { text: 'Home', action: 'showHome()' },
        { text: 'Collections', action: 'showHome()' },
        { text: item.title, action: '' }
    ]);

    const primary = document.getElementById('content-primary');
    if (!primary) return;

    primary.innerHTML = `
        <div class="audio-card-classic">
            <div class="audio-header-classic">
                <h2>${item.title}</h2>
                <span class="audio-genre-tag">${item.genre}</span>
            </div>
            
            <table class="metadata-table-classic">
                <tr>
                    <td>Format</td>
                    <td>MP3 Digital Audio</td>
                </tr>
                <tr>
                    <td>Duration</td>
                    <td>${item.duration}</td>
                </tr>
                <tr>
                    <td>Category</td>
                    <td style="text-transform: capitalize;">${item.category}</td>
                </tr>
                <tr>
                    <td>Collector</td>
                    <td>${item.collector}</td>
                </tr>
            </table>

            <p class="audio-desc-classic">${item.description}</p>
            
            <div class="audio-keywords">
                ${item.keywords.map(kw => `<span class="keyword-tag">#${kw}</span>`).join('')}
            </div>

            <!-- Custom Retro Player -->
            <div class="custom-player-classic" id="player-${item.id}">
                <button class="retro-btn" id="play-btn-${item.id}" onclick="toggleArchiveAudio('${item.id}')">
                    <i class="fas fa-play"></i> Play
                </button>
                <div class="player-timeline-container">
                    <span class="time-display" id="time-current-${item.id}">0:00</span>
                    <input type="range" class="timeline-slider-classic" id="scrub-${item.id}" value="0" min="0" max="100" step="0.1" oninput="scrubAudio('${item.id}', this.value)">
                    <span class="time-display" id="time-duration-${item.id}">0:00</span>
                </div>
                <div class="volume-container">
                    <button class="volume-btn" id="volume-icon-${item.id}" onclick="toggleMute('${item.id}')" aria-label="Mute">
                        <i class="fas fa-volume-up"></i>
                    </button>
                    <input type="range" class="vol-slider-classic" id="volume-${item.id}" min="0" max="1" step="0.05" value="0.8" oninput="changeVolume('${item.id}', this.value)">
                </div>
            </div>

            <!-- Transcript Section -->
            ${item.transcript ? `
            <div class="transcript-section-classic" style="margin-top: 25px; border-top: 1px dashed var(--border-grey); padding-top: 15px;">
                <h3 style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: bold; color: var(--accent-blue); margin-bottom: 10px;">Audio Transcript (Click line to seek)</h3>
                <div class="transcript-container" style="background-color: #faf9f5; border: 1px solid var(--border-grey); padding: 4px; max-height: 250px; overflow-y: scroll; text-align: left; color: var(--text-color);">${renderTranscript(item.transcript)}</div>
            </div>
            ` : ''}
        </div>
        
        <div class="back-link-row">
            <a href="#" onclick="showHome()">&laquo; Back to Home Collections</a>
        </div>
    `;

    // Initialize Audio
    const audioPath = `audios/${item.filename}`;
    const audio = new Audio(audioPath);

    audio.addEventListener('loadedmetadata', () => {
        const durEl = document.getElementById(`time-duration-${item.id}`);
        if (durEl) durEl.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        const current = audio.currentTime;
        const duration = audio.duration || 1;
        const percentage = (current / duration) * 100;
        
        const curEl = document.getElementById(`time-current-${item.id}`);
        const scrubEl = document.getElementById(`scrub-${item.id}`);
        if (curEl) curEl.textContent = formatTime(current);
        if (scrubEl) scrubEl.value = percentage;

        // Sync transcript highlighting
        if (item.transcript) {
            const lines = document.querySelectorAll('.transcript-line');
            lines.forEach((lineEl) => {
                const start = parseFloat(lineEl.getAttribute('data-start'));
                const end = parseFloat(lineEl.getAttribute('data-end'));
                if (current >= start && current <= end) {
                    if (!lineEl.classList.contains('active-highlight')) {
                        // Reset other lines
                        document.querySelectorAll('.transcript-line').forEach(el => {
                            el.classList.remove('active-highlight');
                            el.style.backgroundColor = '';
                            el.style.color = '';
                            el.style.borderLeft = '';
                            el.style.paddingLeft = '8px';
                        });
                        // Highlight current line
                        lineEl.classList.add('active-highlight');
                        lineEl.style.backgroundColor = '#eae6dd';
                        lineEl.style.color = 'var(--accent-blue)';
                        lineEl.style.borderLeft = '3px solid var(--accent-blue)';
                        lineEl.style.paddingLeft = '5px';
                        // Scroll into view within the container
                        lineEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            });
        }
    });

    audio.addEventListener('ended', () => {
        const playBtn = document.getElementById(`play-btn-${item.id}`);
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
        const scrubEl = document.getElementById(`scrub-${item.id}`);
        if (scrubEl) scrubEl.value = 0;
        const curEl = document.getElementById(`time-current-${item.id}`);
        if (curEl) curEl.textContent = '0:00';
        
        if (state.currentlyPlaying && state.currentlyPlaying.id === item.id) {
            state.currentlyPlaying = null;
        }
    });

    // Save temporary reference
    state.soundArchivePlayers = {
        id: item.id,
        audioEl: audio,
        muted: false,
        previousVolume: 0.8
    };
}

function toggleArchiveAudio(id) {
    const player = state.soundArchivePlayers;
    if (!player || player.id !== id) return;

    const audio = player.audioEl;
    const playBtn = document.getElementById(`play-btn-${id}`);
    
    if (state.currentlyPlaying) {
        audio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
        state.currentlyPlaying = null;
        return;
    }

    audio.play();
    playBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
    state.currentlyPlaying = {
        id: id,
        audioEl: audio,
        playBtn: playBtn
    };
}

function scrubAudio(id, value) {
    const player = state.soundArchivePlayers;
    if (!player || player.id !== id) return;
    const audio = player.audioEl;
    if (audio.duration) {
        audio.currentTime = (value / 100) * audio.duration;
    }
}

function changeVolume(id, value) {
    const player = state.soundArchivePlayers;
    if (!player || player.id !== id) return;
    const audio = player.audioEl;
    audio.volume = value;
    player.previousVolume = value;
}

function toggleMute(id) {
    const player = state.soundArchivePlayers;
    if (!player || player.id !== id) return;
    const audio = player.audioEl;
    const volIcon = document.getElementById(`volume-icon-${id}`);
    const volSlider = document.getElementById(`volume-${id}`);

    if (player.muted) {
        audio.volume = player.previousVolume || 0.8;
        volSlider.value = audio.volume;
        player.muted = false;
        volIcon.innerHTML = '<i class="fas fa-volume-up"></i>';
    } else {
        player.previousVolume = audio.volume;
        audio.volume = 0;
        volSlider.value = 0;
        player.muted = true;
        volIcon.innerHTML = '<i class="fas fa-volume-mute"></i>';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// Show Lexicon Search View
function showLexicon() {
    stopAllPlayback();
    state.currentView = 'lexicon';

    updateBreadcrumb([
        { text: 'Home', action: 'showHome()' },
        { text: 'Dictionary', action: '' }
    ]);

    const primary = document.getElementById('content-primary');
    if (!primary) return;

    primary.innerHTML = `
        <div style="border: 1px solid var(--border-grey); background: #ffffff; padding: 0; margin-top: 10px;">
            <iframe id="dict-iframe" src="burushaski-dictionary/index.html"></iframe>
        </div>
    `;

    // If there is an active search query, inject it into the iframe once loaded
    if (state.searchQuery) {
        const iframe = document.getElementById('dict-iframe');
        iframe.addEventListener('load', () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const searchInput = iframeDoc.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = state.searchQuery;
                    const event = new Event('input', { bubbles: true });
                    searchInput.dispatchEvent(event);
                }
            } catch (e) {
                console.error("Could not inject search term into dictionary iframe:", e);
            }
        });
    }
}



// -------------------------------------------------------------
// About View (Project team, Academic Framework)
// -------------------------------------------------------------
function showAbout() {
    stopAllPlayback();
    state.currentView = 'about';

    updateBreadcrumb([
        { text: 'Home', action: 'showHome()' },
        { text: 'About', action: '' }
    ]);

    const primary = document.getElementById('content-primary');
    if (!primary) return;

    primary.innerHTML = `
        <div class="about-container">
            <div class="about-section">
                <h2>Project Framework & Documentation</h2>
                <p>The Burushaski Digital Archive was developed to support digital preservation and online access to multimedia materials of the Burushaski language. Burushaski is a prominent language isolate primarily spoken in Gilgit-Baltistan (Hunza, Yasin, Nagar valleys) and in the Hari Parbat diaspora enclave in Srinagar, Jammu and Kashmir, India.</p>
                <p>Because Burushaski has no verified genetic relationship to any other language family, documenting its grammar, lexicography, and oral narratives represents a key priority for comparative historical linguistics and anthropological preservation.</p>
            </div>

            <div class="about-section">
                <h2>Field Research & Informants</h2>
                <p>This archive focuses specifically on the lexicographical and phonetic preservation of the <strong>Srinagar Dialect (Hari Parbat)</strong>. Spoken by families who relocated from Gilgit-Baltistan to Srinagar during the early 1900s, this variant displays localized vowel shifts, phonetic centralization (/a/ → /ʌ/), and lexical structural loan adaptation from Kashmiri.</p>
                <p> Labeled files and lexicon records were compiled using academic field notes and informant logs:</p>
                <ul class="about-list">
                    <li><strong>Fieldwork Investigator:</strong> Dr. Sadaf Munshi (Associate Professor, Linguistics, University of North Texas).</li>
                    <li><strong>Primary Srinagar Informants:</strong> Mr. Raja Zeeshan, Mr. Raja Yawar, Mr. Raja Anees.</li>
                    <li><strong>Sources:</strong> UNT Digital Library Archive - Burushaski Collection.</li>
                </ul>
            </div>

            <div class="about-section">
                <h2>Archive Development Team</h2>
                <p>This digital archive was designed, developed, and maintained by:</p>
                <ul class="about-list">
                    <li><strong>Aazim Ameen</strong></li>
                    <li><strong>Mehboob ul Haq</strong></li>
                    <li><strong>Manan Qadri</strong></li>
                </ul>
            </div>
        </div>
        
        <div class="back-link-row">
            <a href="#" onclick="showHome()">&laquo; Back to Home Collections</a>
        </div>
    `;
}

// -------------------------------------------------------------
// Citations & Clipboard Copy
// -------------------------------------------------------------
function openCitationModal(itemId, isDictionaryItem) {
    const modal = document.getElementById('citation-modal');
    if (!modal) return;

    let chicagoText = "";
    let mlaText = "";
    let apaText = "";
    let itemTitle = "";

    if (isDictionaryItem) {
        const entry = dictionaryData.find(e => e.id === itemId);
        if (!entry) return;
        itemTitle = `Citation for Lexicon Term: "${entry.word}"`;

        chicagoText = `"${entry.word}." In Burushaski Digital Archive, compiled by Sadaf Munshi. Accessed July 4, 2026. http://burushaski-archive.org/lexicon?word=${entry.word}.`;
        mlaText = `"${entry.word}." Burushaski Digital Archive, compiled by Sadaf Munshi, 2026, http://burushaski-archive.org/lexicon?word=${entry.word}.`;
        apaText = `Munshi, S. (Comp.). (2026). ${entry.word}. In Burushaski Digital Archive. http://burushaski-archive.org/lexicon?word=${entry.word}.`;
    } else {
        const record = audioArchiveData.find(r => r.id === itemId);
        if (!record) return;
        itemTitle = `Citation for Sound Recording: "${record.title}"`;

        chicagoText = `${record.collector}. "${record.title}." In Burushaski Digital Archive. Recorded by ${record.collector}, 2026. http://burushaski-archive.org/audios/${record.filename}.`;
        mlaText = `"${record.title}." Burushaski Digital Archive, collected by ${record.collector}, 2026, http://burushaski-archive.org/audios/${record.filename}.`;
        apaText = `${record.collector}. (2026). ${record.title} [Audio recording]. Burushaski Digital Archive. http://burushaski-archive.org/audios/${record.filename}.`;
    }

    document.getElementById('modal-item-title').textContent = itemTitle;
    
    document.getElementById('citation-chicago').innerHTML = `
        <span>${chicagoText}</span>
        <button class="copy-citation-icon-btn" onclick="copyCitation('${escapeHtml(chicagoText)}', 'Chicago')" title="Copy Chicago Style">
            <i class="far fa-copy"></i>
        </button>
    `;
    document.getElementById('citation-mla').innerHTML = `
        <span>${mlaText}</span>
        <button class="copy-citation-icon-btn" onclick="copyCitation('${escapeHtml(mlaText)}', 'MLA')" title="Copy MLA Style">
            <i class="far fa-copy"></i>
        </button>
    `;
    document.getElementById('citation-apa').innerHTML = `
        <span>${apaText}</span>
        <button class="copy-citation-icon-btn" onclick="copyCitation('${escapeHtml(apaText)}', 'APA')" title="Copy APA Style">
            <i class="far fa-copy"></i>
        </button>
    `;

    modal.classList.add('active');
}

function closeModal(event) {
    const modal = document.getElementById('citation-modal');
    if (modal) modal.classList.remove('active');
}

function copyCitation(text, format) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast(`${format} Style Citation copied to clipboard.`);
    } catch (err) {
        console.error("Could not copy citation:", err);
    }
    
    document.body.removeChild(textArea);
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Toast alerts
function showToast(message) {
    const wrapper = document.getElementById('toast-wrapper');
    if (!wrapper) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    wrapper.appendChild(toast);

    toast.offsetHeight; // Reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Render home view on load
    showHome();
});
