let ques = [];
let currentQuesIndex = 0;
let score = 0;
let canClick = true;
let bestScore = null;
let optionOrder = [0, 1];
const playerId = getPlayerId();
const apiUrl = (window.QUIZ_API_URL || '').replace(/\/$/, '');

function api(path) {
    if (!apiUrl || apiUrl.includes('PASTE_YOUR')) throw new Error('Quiz API URL has not been configured.');
    return `${apiUrl}${path}`;
}

function getPlayerId() {
    let id = localStorage.getItem('quiz-player-id');
    if (!id) { id = createUuid(); localStorage.setItem('quiz-player-id', id); }
    return id;
}

function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function shuffleOptions() {
    optionOrder = Math.random() < 0.5 ? [0, 1] : [1, 0];
}

async function startGame() {
    const playButton = document.querySelector('#start button');
    playButton.disabled = true; playButton.textContent = 'Loading...';
    try {
        const response = await fetch(api('/questions'));
        ques = await response.json();
        if (!response.ok) throw new Error(ques.error);
        if (!ques.length) throw new Error('No questions are available yet.');
        score = 0; currentQuesIndex = 0; canClick = true;
        document.getElementById('start').classList.add('hide');
        document.getElementById('quiz-game').classList.remove('hide');
        displayQues();
    } catch (error) { alert(error.message || 'Could not load questions.'); }
    finally { playButton.disabled = false; playButton.textContent = 'Play'; }
}

function displayQues() {
    if (currentQuesIndex >= ques.length) return showResult();
    canClick = true;
    document.querySelectorAll('.option').forEach((button) => { button.disabled = false; button.classList.remove('checking'); });
    const data = ques[currentQuesIndex];
    shuffleOptions();
    document.getElementById('question').textContent = data.question;
    document.getElementById('op0').textContent = data.options[optionOrder[0]];
    document.getElementById('op1').textContent = data.options[optionOrder[1]];
    document.getElementById('count').textContent = `Question ${currentQuesIndex + 1} of ${ques.length}`;
}

async function buttonClicked(option) {
    if (!canClick) return;
    canClick = false;
    const button = document.getElementById('op' + option);
    button.classList.add('checking');
    document.querySelectorAll('.option').forEach((optionButton) => { optionButton.disabled = true; });
    try {
        const selectedOption = optionOrder[option];
        const response = await fetch(api(`/questions/${ques[currentQuesIndex].id}/check`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ option: selectedOption }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        button.classList.remove('checking');
        if (result.correct) { score++; button.classList.add('correct'); }
        else { button.classList.add('wrong'); }
        setTimeout(() => { button.classList.remove('correct', 'wrong'); currentQuesIndex++; displayQues(); }, 700);
    } catch (error) {
        button.classList.remove('checking');
        document.querySelectorAll('.option').forEach((optionButton) => { optionButton.disabled = false; });
        canClick = true;
    }
}

async function showResult() {
    document.getElementById('score').classList.remove('hide');
    document.getElementById('quiz-game').classList.add('hide');
    const total = ques.length;
    const percentage = Math.round((score / total) * 100);
    const scoreT = document.getElementById('progress');
    scoreT.textContent = `${percentage}%`;
    scoreT.style.background = `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(rgb(143, 195, 255) ${percentage}%, rgba(0,0,0,0.05) 0)`;
    document.getElementById('score-summary').textContent = 'Best: --';
    document.getElementById('msg').textContent = percentage === 100 ? 'Congratulations!' : percentage >= 70 ? 'Great job!' : percentage >= 50 ? 'You can do better!' : 'Are you even trying?';
    try {
        const response = await fetch(api('/scores'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId, score, total }) });
        const result = await response.json();
        if (response.ok) {
            bestScore = result;
            updateBestScore();
            const bestPercentage = Math.round((result.bestScore / result.bestTotal) * 100);
            document.getElementById('score-summary').textContent = `Best: ${bestPercentage}%`;
        }
    } catch (_) { /* Current score remains visible if saving fails. */ }
}

function updateBestScore() { if (bestScore) document.getElementById('best-score').textContent = `Best score: ${bestScore.bestScore} / ${bestScore.bestTotal}`; }
function playAgain() { document.getElementById('score').classList.add('hide'); startGame(); }
function home() { ['score', 'quiz-game'].forEach((id) => document.getElementById(id).classList.add('hide')); document.getElementById('start').classList.remove('hide'); }

if (apiUrl && !apiUrl.includes('PASTE_YOUR')) {
    fetch(api(`/scores/${playerId}`)).then((response) => response.json()).then((result) => { if (result) { bestScore = result; updateBestScore(); } }).catch(() => {});
}
