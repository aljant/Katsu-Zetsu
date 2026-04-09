// app.js
let tokenizer = null;
let currentIndex = 0;

const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const statusMsg = document.getElementById('status-msg');
const targetTextEl = document.getElementById('target-text');
const targetReadingEl = document.getElementById('target-reading');
const userTextEl = document.getElementById('user-text');
const scoreDisplay = document.getElementById('score-display');

// 1. kuromoji.js の初期化（辞書をCDNから直接読み込む）
const dicUrl = "https://unpkg.com/kuromoji@0.1.2/dict/";
kuromoji.builder({ dicPath: dicUrl }).build((err, _tokenizer) => {
  if (err) {
    statusMsg.textContent = "辞書の読み込みに失敗しました。";
    console.error(err);
    return;
  }
  tokenizer = _tokenizer;
  statusMsg.textContent = "準備完了！ボタンを押して話し始めてください。";
  startBtn.disabled = false;
  loadCurrentText();
});

// 2. お題の読み込み
function loadCurrentText() {
  const data = uirouriData[currentIndex];
  targetTextEl.textContent = data.display;
  targetReadingEl.textContent = data.reading;
  userTextEl.innerHTML = "";
  scoreDisplay.textContent = "";
  nextBtn.style.display = "none";
  startBtn.style.display = "inline-block";
}

// 3. Web Speech API の設定
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  statusMsg.textContent = "お使いのブラウザは音声認識に非対応です。Chromeをご利用ください。";
}
const recognition = new SpeechRecognition();
recognition.lang = 'ja-JP';
recognition.interimResults = false;
recognition.continuous = false;

// 録音開始イベント
startBtn.addEventListener('click', () => {
  recognition.start();
  statusMsg.textContent = "🔴 録音中... 話してください";
  startBtn.disabled = true;
});

// 音声認識終了時の処理
recognition.onresult = (event) => {
  const rawTranscript = event.results[0][0].transcript;
  statusMsg.textContent = "解析中...";
  
  // 取得した漢字混じりテキストをひらがなに変換
  const hiraganaTranscript = convertToHiragana(rawTranscript);
  
  // 判定ロジックへ
  compareAndDisplay(hiraganaTranscript, uirouriData[currentIndex].reading);
  
  statusMsg.textContent = "判定完了";
  startBtn.style.display = "none";
  nextBtn.style.display = "inline-block";
  startBtn.disabled = false;
};

recognition.onerror = (event) => {
  statusMsg.textContent = "エラーが発生しました: " + event.error;
  startBtn.disabled = false;
};

// 次へボタン
nextBtn.addEventListener('click', () => {
  currentIndex++;
  if (currentIndex >= uirouriData.length) {
    currentIndex = 0; // 最後までいったら最初に戻る
    alert("お疲れ様でした！一回り完了です。");
  }
  loadCurrentText();
});

// 4. kuromoji.js を使った「ひらがな変換」ロジック
function convertToHiragana(text) {
  if (!tokenizer) return text;
  
  const tokens = tokenizer.tokenize(text);
  let result = "";

  tokens.forEach(token => {
    // 読み情報があればそれを使用、なければ元の単語そのまま
    let kana = token.reading ? token.reading : token.surface_form;
    result += kana;
  });

  // カタカナをひらがなに変換
  return result.replace(/[\u30A1-\u30F6]/g, match => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

// 5. 正誤判定と比較結果の表示
function compareAndDisplay(userText, targetReading) {
  let displayHtml = "";
  let correctCount = 0;

  // ※記号や空白を除外して純粋に文字のみ比較
  const cleanUserText = userText.replace(/[、。，．\s]/g, "");
  const maxLength = Math.max(cleanUserText.length, targetReading.length);

  for (let i = 0; i < maxLength; i++) {
    const userChar = cleanUserText[i] || "";
    const targetChar = targetReading[i] || "";

    if (userChar === targetChar) {
      displayHtml += `<span class="correct">${userChar}</span>`;
      correctCount++;
    } else {
      // 間違えた文字、または余分な文字
      const charToDisplay = userChar ? userChar : "［抜け］";
      displayHtml += `<span class="incorrect">${charToDisplay}</span>`;
    }
  }

  userTextEl.innerHTML = displayHtml;

  // スコア計算
  const score = Math.floor((correctCount / targetReading.length) * 100);
  if (score >= 90) {
    scoreDisplay.style.color = "#27ae60";
    scoreDisplay.textContent = `🎯 素晴らしい！ スコア: ${score}%`;
  } else if (score >= 70) {
    scoreDisplay.style.color = "#f39c12";
    scoreDisplay.textContent = `👍 惜しい！ スコア: ${score}%`;
  } else {
    scoreDisplay.style.color = "#e74c3c";
    scoreDisplay.textContent = `💦 もう一度練習しましょう！ スコア: ${score}%`;
  }
}
