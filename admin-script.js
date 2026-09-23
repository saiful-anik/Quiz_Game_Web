const apiUrl = (window.QUIZ_API_URL || '').replace(/\/$/, '');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginMessage = document.getElementById('login-message');
const formMessage = document.getElementById('form-message');
const questionForm = document.getElementById('question-form');
let questions = [];

function api(path) {
    if (!apiUrl || apiUrl.includes('PASTE_YOUR')) throw new Error('Set QUIZ_API_URL in api-config.js first.');
    return `${apiUrl}${path}`;
}

function headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('quiz-admin-token') || ''}` };
}

function setButtonBusy(button, label) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
    return () => { button.disabled = false; button.textContent = originalText; };
}

async function readJson(response) {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; }
    catch { throw new Error('The deployed Function returned an invalid response. Redeploy the latest function code and try again.'); }
}

async function request(path, options = {}) {
    const response = await fetch(api(path), { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
}

function showLogin(message = '') {
    localStorage.removeItem('quiz-admin-token');
    dashboardView.classList.add('hide'); loginView.classList.remove('hide');
    loginMessage.textContent = message;
}

async function loadDashboard() {
    const [questionData, stats] = await Promise.all([request('/admin/questions'), request('/admin/stats')]);
    questions = questionData;
    document.getElementById('player-count').textContent = stats.totalPlayers;
    document.getElementById('question-count').textContent = `(${questions.length})`;
    renderQuestions();
}

function renderQuestions() {
    const list = document.getElementById('questions-list');
    list.replaceChildren();
    if (!questions.length) { list.textContent = 'No questions yet.'; return; }
    for (const question of questions) {
        const item = document.createElement('article'); item.className = 'question-item';
        const title = document.createElement('div'); title.className = 'question-text'; title.textContent = question.question;
        const options = document.createElement('div'); options.className = 'options-text';
        options.innerHTML = `<span class="${question.correct_option === 0 ? 'correct-option' : ''}">1. ${escapeHtml(question.option_one)}</span><br><span class="${question.correct_option === 1 ? 'correct-option' : ''}">2. ${escapeHtml(question.option_two)}</span>`;
        const buttons = document.createElement('div'); buttons.className = 'question-buttons';
        buttons.innerHTML = `<button data-edit="${question.id}" class="secondary">Edit</button><button data-delete="${question.id}" class="delete-button">Delete</button>`;
        item.append(title, options, buttons); list.append(item);
    }
}

function escapeHtml(value) {
    const div = document.createElement('div'); div.textContent = value; return div.innerHTML;
}

function resetForm() {
    questionForm.reset(); document.getElementById('question-id').value = '';
    document.getElementById('form-title').textContent = 'Add question';
    document.getElementById('save-button').textContent = 'Add question';
    document.getElementById('cancel-edit').classList.add('hide'); formMessage.textContent = '';
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); loginMessage.textContent = '';
    const restoreButton = setButtonBusy(event.submitter, 'Logging in...');
    try {
        const response = await fetch(api('/admin/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('admin-username').value, password: document.getElementById('admin-password').value }) });
        const data = await readJson(response); if (!response.ok) throw new Error(data.error);
        localStorage.setItem('quiz-admin-token', data.token);
        loginView.classList.add('hide'); dashboardView.classList.remove('hide'); await loadDashboard();
    } catch (error) { loginMessage.textContent = error.message; }
    finally { restoreButton(); }
});

questionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('question-id').value;
    const payload = { question: document.getElementById('new-question').value, optionOne: document.getElementById('option-one').value, optionTwo: document.getElementById('option-two').value, correctOption: Number(document.querySelector('input[name="correct-option"]:checked').value) };
    const restoreButton = setButtonBusy(document.getElementById('save-button'), id ? 'Saving...' : 'Adding...');
    try {
        await request(id ? `/admin/questions/${id}` : '/admin/questions', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        restoreButton();
        resetForm(); formMessage.textContent = id ? 'Question updated.' : 'Question added.'; await loadDashboard();
    } catch (error) { restoreButton(); formMessage.textContent = error.message; }
});

document.getElementById('questions-list').addEventListener('click', async (event) => {
    const id = Number(event.target.dataset.edit || event.target.dataset.delete); if (!id) return;
    const question = questions.find((item) => Number(item.id) === id); if (!question) return;
    if (event.target.dataset.edit) {
        document.getElementById('question-id').value = question.id;
        document.getElementById('new-question').value = question.question;
        document.getElementById('option-one').value = question.option_one;
        document.getElementById('option-two').value = question.option_two;
        document.querySelector(`input[name="correct-option"][value="${question.correct_option}"]`).checked = true;
        document.getElementById('form-title').textContent = 'Edit question'; document.getElementById('save-button').textContent = 'Save changes'; document.getElementById('cancel-edit').classList.remove('hide');
    } else if (confirm('Delete this question?')) {
        const restoreButton = setButtonBusy(event.target, 'Deleting...');
        try { await request(`/admin/questions/${id}`, { method: 'DELETE' }); await loadDashboard(); }
        catch (error) { formMessage.textContent = error.message; }
        finally { restoreButton(); }
    }
});

document.getElementById('cancel-edit').addEventListener('click', resetForm);
document.getElementById('logout-button').addEventListener('click', () => showLogin());

if (localStorage.getItem('quiz-admin-token')) {
    loginView.classList.add('hide'); dashboardView.classList.remove('hide');
    loadDashboard().catch(() => showLogin('Your session expired. Please log in again.'));
}
