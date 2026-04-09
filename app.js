// app.js
let tokenizer = null;
let currentIndex = 0;
let isRecording = false;
let recordStartTime = 0;

// DOM Elements - Navigation
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const navAnalysis = document.getElementById('nav-analysis');

// DOM Elements - Start View
const startPracticeBtn = document.getElementById('start-practice-btn');
const logReady = document.getElementById('log-ready');
const logReadyMsg = document.getElementById('log-ready-msg');
const logAwaiting = document.getElementById('log-awaiting');

// DOM Elements - Practice View
const sessionTitle = document.getElementById('session-title');
const paragraphCounter = document.getElementById('paragraph-counter');
const targetTextContainer = document.getElementById('target-text-container');
const recordBtn = document.getElementById('record-btn');
const recordBtnText = document.getElementById('record-btn-text');
const recordStatusText = document.getElementById('record-status-text');
const waveformIndicator = document.getElementById('waveform-indicator');
const pulseDot = document.querySelector('.pulse-dot');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// DOM Elements - Analysis View
const scoreAccuracy = document.getElementById('score-accuracy');
const scoreWpm = document.getElementById('score-wpm');
const scoreClarity = document.getElementById('score-clarity');
const clarityGrade = document.getElementById('clarity-grade');
const diffContent = document.getElementById('diff-content');
const techFeedback = document.getElementById('technical-feedback');
const optTip = document.getElementById('optimization-tip');
const analysisNextBtn = document.getElementById('analysis-next-btn');
const analysisRetryBtn = document.getElementById('analysis-retry-btn');

// DOM Elements - Dictionary View
const dictContent = document.getElementById('dictionary-content');
const dictBackBtn = document.getElementById('dict-back-btn');

// 1. Navigation Logic (SPA)
function showView(viewId) {
  views.forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`view-${viewId}`).classList.add('active');

  navItems.forEach(item => {
    item.classList.remove('active');
    if(item.dataset.target === viewId) {
      item.classList.add('active');
    }
  });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    if(!item.disabled) {
      showView(item.dataset.target);
    }
  });
});

dictBackBtn.addEventListener('click', () => showView('practice'));

// 2. Kuromoji Init and Terminal Animation
function simulateTerminal() {
  setTimeout(() => document.getElementById('log-time-2').textContent = geTimeStr(), 1000);
  setTimeout(() => {
    document.getElementById('log-time-3').textContent = geTimeStr();
    logReady.style.display = 'inline-block';
    logReadyMsg.style.display = 'inline-block';
  }, 2500);
}
function geTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

const dicUrl = "dict/"; // Path to dict directory
simulateTerminal();

kuromoji.builder({ dicPath: dicUrl }).build((err, _tokenizer) => {
  if (err) {
    console.error(err);
    document.getElementById('log-time-3').textContent = geTimeStr();
    logReady.textContent = "ERROR";
    logReady.style.color = "red";
    logReadyMsg.textContent = "Dictionary load failed.";
    logReady.style.display = 'inline-block';
    logReadyMsg.style.display = 'inline-block';
    return;
  }
  tokenizer = _tokenizer;
  
  setTimeout(() => {
    logAwaiting.style.display = 'block';
    startPracticeBtn.classList.remove('disabled');
    startPracticeBtn.addEventListener('click', () => {
      loadPracticeData();
      showView('practice');
    });
    populateDictionary();
  }, 3000); // Give terminal effect some time
});


// 3. Practice View Logic
function loadPracticeData() {
  const data = uirouriData[currentIndex];
  sessionTitle.textContent = `Section ${String(Math.floor(currentIndex/5)+1).padStart(2,'0')}: The Articulation`;
  paragraphCounter.textContent = `Paragraph ${currentIndex + 1} / ${uirouriData.length}`;
  
  // Generate Ruby
  if(tokenizer) {
    const tokens = tokenizer.tokenize(data.display);
    let html = "";
    tokens.forEach(token => {
      // If it has kanji and a reading, use ruby
      if(token.surface_form.match(/[\u4e00-\u9faf]/) && token.reading) {
         html += `<ruby>${token.surface_form}<rt>${katakanaToHiragana(token.reading)}</rt></ruby>`;
      } else {
         html += token.surface_form;
      }
    });
    targetTextContainer.innerHTML = html;
  } else {
    targetTextContainer.textContent = data.display;
  }

  resetRecordingUI();
}

function katakanaToHiragana(kata) {
  return kata.replace(/[\u30A1-\u30F6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

function convertToHiragana(text) {
  if (!tokenizer) return text;
  const tokens = tokenizer.tokenize(text);
  let result = "";
  tokens.forEach(token => {
    let kana = token.reading ? token.reading : token.surface_form;
    result += kana;
  });
  return katakanaToHiragana(result);
}

prevBtn.addEventListener('click', () => {
  if(currentIndex > 0) currentIndex--;
  loadPracticeData();
});
nextBtn.addEventListener('click', () => {
  if(currentIndex < uirouriData.length - 1) currentIndex++;
  loadPracticeData();
});


// 4. Speech Recognition Logic
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const endTime = Date.now();
    const durationSec = (endTime - recordStartTime) / 1000;
    
    const rawTranscript = event.results[0][0].transcript;
    const hiraganaTranscript = convertToHiragana(rawTranscript);
    const targetReading = uirouriData[currentIndex].reading;
    
    // Switch to Analysis View and process
    navAnalysis.disabled = false;
    processAnalysis(hiraganaTranscript, targetReading, durationSec);
    showView('analysis');
    resetRecordingUI();
  };

  recognition.onerror = (event) => {
    alert("認識エラー: " + event.error);
    resetRecordingUI();
  };
  
  recognition.onend = () => {
    if(isRecording) resetRecordingUI();
  }
}

function resetRecordingUI() {
  isRecording = false;
  pulseDot.classList.remove('active');
  recordStatusText.textContent = "WAITING START...";
  recordBtnText.textContent = "START RECORDING";
  recordBtn.classList.add('start-mode');
  recordBtn.querySelector('.stop-icon').textContent = "▶";
}

recordBtn.addEventListener('click', () => {
  if(!recognition) {
    alert("Web Speech API is not supported in this browser.");
    return;
  }

  if (isRecording) {
    recognition.stop();
    // It will trigger onresult if it caught something, or onend.
  } else {
    try {
      recognition.start();
      isRecording = true;
      recordStartTime = Date.now();
      pulseDot.classList.add('active');
      recordStatusText.textContent = "LIVE WAVEFORM CAPTURE ACTIVE";
      recordBtnText.textContent = "STOP & ANALYZE";
      recordBtn.classList.remove('start-mode');
      recordBtn.querySelector('.stop-icon').textContent = "■";
    } catch(e) {
      console.error(e);
    }
  }
});

resetRecordingUI();

// 5. Analysis Logic
function processAnalysis(userText, targetReading, durationSec) {
  const cleanUserText = userText.replace(/[、。，．\s]/g, "");
  const maxLength = Math.max(cleanUserText.length, targetReading.length);
  
  let correctCount = 0;
  let html = "";
  
  // Diff Calculation
  for(let i=0; i<targetReading.length; i++) {
    const uChar = cleanUserText[i] || "";
    const tChar = targetReading[i];
    
    if(uChar === tChar) {
      // Find original surface character for nice UI (Approximation: using targetReading length, meaning we map it to Hiragana)
      // Since mapping to exact Kanji is complex without character-level alignment algorithm (like Levenshtein),
      // we display the Hiragana diff. Alternatively, we just display the hiragana target and highlight correctness.
      // Let's display the Hiragana diff to exactly match what the user pronounced vs should have pronounced.
      html += `<span class="diff-correct">${tChar}</span>`;
      correctCount++;
    } else {
      const displayChar = uChar ? uChar : "［抜］";
      html += `<span class="diff-incorrect" title="正解: ${tChar}">${displayChar}</span>`;
    }
  }
  
  // Calculate Metrics
  const accuracy = ((correctCount / targetReading.length) * 100).toFixed(1);
  const wpm = durationSec > 0 ? Math.floor((cleanUserText.length / durationSec) * 60) : 0;
  
  scoreAccuracy.textContent = accuracy;
  scoreWpm.textContent = wpm;
  
  // Clarity
  scoreClarity.className = 'score-value'; // Reset
  if(accuracy >= 90) {
    scoreClarity.classList.add('clarity-high');
    clarityGrade.textContent = "A+";
  } else if(accuracy >= 70) {
    scoreClarity.classList.add('clarity-mid');
    clarityGrade.textContent = "B";
    techFeedback.textContent = "Several phonetic drops detected. Focus on clear articulation.";
    optTip.textContent = "Maintain steady pace.";
  } else {
    scoreClarity.classList.add('clarity-low');
    clarityGrade.textContent = "C";
    techFeedback.textContent = "Significant mismatch detected. Speak more clearly and louder.";
    optTip.textContent = "Take a deep breath and articulate each syllable.";
  }
  
  diffContent.innerHTML = html;
}

analysisNextBtn.addEventListener('click', () => {
  if(currentIndex < uirouriData.length - 1) currentIndex++;
  loadPracticeData();
  showView('practice');
});

analysisRetryBtn.addEventListener('click', () => {
  loadPracticeData();
  showView('practice');
});


// 6. Dictionary Init
function populateDictionary() {
  let html = "";
  uirouriData.forEach((item, idx) => {
    html += `<p>${item.display}</p>`;
  });
  dictContent.innerHTML = html;
}
