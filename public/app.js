const API_BASE = window.location.origin;

// DOM Elements
const taskForm = document.getElementById('taskForm');
const tasksList = document.getElementById('tasksList');
const completedTasksList = document.getElementById('completedTasksList');
const refreshBtn = document.getElementById('refreshBtn');
const testWhatsAppBtn = document.getElementById('testWhatsApp');
const testTelegramBtn = document.getElementById('testTelegram');

// New feature elements
const themeToggle = document.getElementById('themeToggle');
const searchBox = document.getElementById('searchBox');
const filterRecurring = document.getElementById('filterRecurring');
const sortBy = document.getElementById('sortBy');
const bulkSelectToggle = document.getElementById('bulkSelectToggle');
const bulkActionsBar = document.getElementById('bulkActionsBar');
const bulkComplete = document.getElementById('bulkComplete');
const bulkDelete = document.getElementById('bulkDelete');
const cancelBulk = document.getElementById('cancelBulk');
const selectedCount = document.getElementById('selectedCount');
const editModal = document.getElementById('editModal');
const editTaskForm = document.getElementById('editTaskForm');
const modalClose = document.getElementById('modalClose');
const cancelEdit = document.getElementById('cancelEdit');

// Additional new elements
const templateSelect = document.getElementById('templateSelect');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const subtasksList = document.getElementById('subtasksList');
const editAddSubtaskBtn = document.getElementById('editAddSubtaskBtn');
const editSubtasksList = document.getElementById('editSubtasksList');
const testSMSBtn = document.getElementById('testSMS');
const requestNotificationBtn = document.getElementById('requestNotificationPermission');

// State
let allTasks = [];
let filteredTasks = [];
let bulkSelectMode = false;
let selectedTaskIds = new Set();
let subtasks = [];
let editSubtasks = [];
let templates = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadTasks();
    loadTemplates();
    setDefaultDateTime();
    setupEventListeners();
    requestNotificationPermission();
});

// Setup all event listeners
function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    searchBox.addEventListener('input', applyFilters);
    filterRecurring.addEventListener('change', applyFilters);
    sortBy.addEventListener('change', applyFilters);
    bulkSelectToggle.addEventListener('click', toggleBulkSelectMode);
    bulkComplete.addEventListener('click', handleBulkComplete);
    bulkDelete.addEventListener('click', handleBulkDelete);
    cancelBulk.addEventListener('click', exitBulkSelectMode);
    modalClose.addEventListener('click', closeEditModal);
    cancelEdit.addEventListener('click', closeEditModal);
    editTaskForm.addEventListener('submit', handleEditTask);
    templateSelect.addEventListener('change', applyTemplate);
    addSubtaskBtn.addEventListener('click', addSubtask);
    editAddSubtaskBtn.addEventListener('click', addEditSubtask);
    testSMSBtn.addEventListener('click', testSMS);
    requestNotificationBtn.addEventListener('click', requestNotificationPermission);

    // Toggle form visibility
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    if (toggleFormBtn) {
        toggleFormBtn.addEventListener('click', toggleTaskForm);
    }

    // Close modal on background click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
}

// Set default date and time to current
function setDefaultDateTime() {
    const now = new Date();
    const dateInput = document.getElementById('dueDate');
    const timeInput = document.getElementById('dueTime');

    // Set date to today
    dateInput.value = now.toISOString().split('T')[0];

    // Set time to current + 1 hour
    now.setHours(now.getHours() + 1);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}`;
}

// Event Listeners (existing)
taskForm.addEventListener('submit', handleAddTask);
refreshBtn.addEventListener('click', loadTasks);
testWhatsAppBtn.addEventListener('click', testWhatsApp);
testTelegramBtn.addEventListener('click', testTelegram);

// ===== DARK MODE =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Toggle task form visibility
function toggleTaskForm() {
    const content = document.getElementById('taskFormContent');
    const card = document.querySelector('.task-form-card');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        card.classList.add('open');
    } else {
        content.classList.add('hidden');
        card.classList.remove('open');
    }
}

// ===== SEARCH, FILTER & SORT =====
function applyFilters() {
    const searchTerm = searchBox.value.toLowerCase();
    const recurringFilter = filterRecurring.value;
    const sortOption = sortBy.value;

    // Filter tasks
    filteredTasks = allTasks.filter(task => {
        if (task.completed) return false;

        // Search filter
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) ||
                            (task.description && task.description.toLowerCase().includes(searchTerm));

        // Recurring filter
        const matchesRecurring = recurringFilter === 'all' || task.recurring === recurringFilter;

        return matchesSearch && matchesRecurring;
    });

    // Sort tasks
    filteredTasks.sort((a, b) => {
        switch (sortOption) {
            case 'date-asc':
                return new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`);
            case 'date-desc':
                return new Date(`${b.dueDate}T${b.dueTime}`) - new Date(`${a.dueDate}T${a.dueTime}`);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'created-asc':
                return new Date(a.createdAt) - new Date(b.createdAt);
            case 'created-desc':
                return new Date(b.createdAt) - new Date(a.createdAt);
            default:
                return 0;
        }
    });

    displayTasks(filteredTasks, tasksList, false);
}

// Load all tasks
async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE}/api/tasks`, {
            credentials: 'include'
        });
        const tasks = await response.json();

        // Store all tasks in state
        allTasks = tasks;

        // Separate pending and completed tasks
        const pendingTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);

        // Apply filters to pending tasks
        filteredTasks = pendingTasks;
        applyFilters();

        displayTasks(completedTasks, completedTasksList, true);
    } catch (error) {
        console.error('Error loading tasks:', error);
        showMessage('Failed to load tasks', 'error');
    }
}

// Display tasks
function displayTasks(tasks, container, isCompleted) {
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks yet</p>';
        return;
    }

    const now = new Date();
    const currentDateTime = now.toISOString();

    container.innerHTML = tasks.map(task => {
        const taskDateTime = `${task.dueDate}T${task.dueTime}`;
        const isOverdue = !isCompleted && taskDateTime < currentDateTime;
        const isSelected = selectedTaskIds.has(task.id);
        const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil) > now;
        const priority = task.priority || 'medium';
        const category = task.category || 'general';

        // Calculate subtask progress
        const subtasksTotal = (task.subtasks || []).length;
        const subtasksCompleted = (task.subtasks || []).filter(st => st.completed).length;

        return `
            <div class="task-card priority-${priority} ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isSelected ? 'selected' : ''}"
                 data-task-id="${task.id}"
                 draggable="${!isCompleted && !bulkSelectMode}"
                 ondragstart="handleDragStart(event)"
                 ondragover="handleDragOver(event)"
                 ondrop="handleDrop(event)"
                 ondragend="handleDragEnd(event)">
                <div class="task-header">
                    <div class="task-checkbox-wrapper">
                        ${bulkSelectMode && !isCompleted ? `
                            <input type="checkbox"
                                   class="task-checkbox"
                                   ${isSelected ? 'checked' : ''}
                                   onchange="toggleTaskSelection(${task.id})">
                        ` : !bulkSelectMode && !isCompleted ? `
                            <span class="drag-handle">⋮⋮</span>
                        ` : ''}
                        <div>
                            <div class="task-title">
                                ${escapeHtml(task.title)}
                                ${task.alertCount > 0 ? `<span class="alert-count-badge">${task.alertCount}x</span>` : ''}
                            </div>
                            ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                        </div>
                    </div>
                    <div>
                        <span class="task-badge ${task.recurring !== 'none' ? 'recurring' : 'one-time'}">
                            ${task.recurring !== 'none' ? task.recurring : 'one-time'}
                        </span>
                        <span class="category-badge">${category}</span>
                    </div>
                </div>

                <div class="task-meta">
                    <span>📅 ${formatDate(task.dueDate)}</span>
                    <span>⏰ ${task.dueTime}</span>
                    ${task.reminderMinutes > 0 ? `<span>⏰ ${task.reminderMinutes}min reminder</span>` : ''}
                    ${task.notified ? '<span>✅ Notified</span>' : ''}
                    ${task.reminderSent ? '<span>⏰ Reminded</span>' : ''}
                    ${isOverdue ? '<span style="color: #f14668;">⚠️ Overdue</span>' : ''}
                    ${isSnoozed ? `<span class="snoozed-badge">😴 Snoozed</span>` : ''}
                </div>

                ${task.notes || subtasksTotal > 0 ? `
                    <div class="task-details">
                        ${task.notes ? `<div class="task-notes">📝 ${escapeHtml(task.notes)}</div>` : ''}
                        ${subtasksTotal > 0 ? `
                            <div class="task-subtasks">
                                <span class="task-subtasks-title">Subtasks</span>
                                <span class="subtasks-progress">(${subtasksCompleted}/${subtasksTotal})</span>
                                ${(task.subtasks || []).map((st, idx) => `
                                    <div class="subtask-item">
                                        <input type="checkbox"
                                               class="subtask-checkbox"
                                               ${st.completed ? 'checked' : ''}
                                               onchange="toggleTaskSubtask(${task.id}, ${idx})"
                                               ${isCompleted ? 'disabled' : ''}>
                                        <span class="subtask-text ${st.completed ? 'completed' : ''}">${escapeHtml(st.text)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="task-actions">
                    ${!isCompleted && !bulkSelectMode ? `
                        <button onclick="openSnoozeModal(${task.id})" class="btn btn-snooze btn-small">
                            😴 Snooze
                        </button>
                        <button onclick="openEditModal(${task.id})" class="btn btn-outline btn-small">
                            ✏️ Edit
                        </button>
                        <button onclick="completeTask(${task.id})" class="btn btn-success">
                            ✓ Complete
                        </button>
                    ` : ''}
                    ${!bulkSelectMode ? `
                        <button onclick="deleteTask(${task.id})" class="btn btn-danger">
                            🗑️ Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Add new task
async function handleAddTask(e) {
    e.preventDefault();

    // Filter out empty subtasks
    const validSubtasks = subtasks.filter(st => st.text.trim() !== '');

    const task = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        dueDate: document.getElementById('dueDate').value,
        dueTime: document.getElementById('dueTime').value,
        recurring: document.getElementById('recurring').value,
        priority: document.getElementById('priority').value,
        category: document.getElementById('category').value,
        reminderMinutes: parseInt(document.getElementById('reminderMinutes').value),
        notes: document.getElementById('notes').value,
        subtasks: validSubtasks
    };

    try {
        const response = await fetch(`${API_BASE}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(task)
        });

        if (response.ok) {
            showMessage('Task added successfully!', 'success');
            taskForm.reset();
            subtasks = [];
            renderSubtasks();
            setDefaultDateTime();
            loadTasks();

            // Show desktop notification if enabled
            showDesktopNotification('Task Created', `"${task.title}" has been added`);
        } else {
            throw new Error('Failed to add task');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        showMessage('Failed to add task', 'error');
    }
}

// Complete task
async function completeTask(id) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${id}/complete`, {
            method: 'PATCH',
            credentials: 'include'
        });

        if (response.ok) {
            showMessage('Task completed!', 'success');
            selectedTaskIds.delete(id);
            updateBulkActionsBar();
            loadTasks();
        } else {
            throw new Error('Failed to complete task');
        }
    } catch (error) {
        console.error('Error completing task:', error);
        showMessage('Failed to complete task', 'error');
    }
}

// Delete task
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/tasks/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            showMessage('Task deleted!', 'success');
            selectedTaskIds.delete(id);
            updateBulkActionsBar();
            loadTasks();
        } else {
            throw new Error('Failed to delete task');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showMessage('Failed to delete task', 'error');
    }
}

// Test WhatsApp
async function testWhatsApp() {
    try {
        testWhatsAppBtn.disabled = true;
        testWhatsAppBtn.textContent = '⏳ Sending...';

        const response = await fetch(`${API_BASE}/api/test/whatsapp`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('WhatsApp test message sent! Check your phone', 'success');
        } else {
            showMessage(`WhatsApp error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error testing WhatsApp:', error);
        showMessage('Failed to send WhatsApp test', 'error');
    } finally {
        testWhatsAppBtn.disabled = false;
        testWhatsAppBtn.textContent = '🟢 Test WhatsApp';
    }
}

// Test Telegram
async function testTelegram() {
    try {
        testTelegramBtn.disabled = true;
        testTelegramBtn.textContent = '⏳ Sending...';

        const response = await fetch(`${API_BASE}/api/test/telegram`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Telegram test message sent! Check your Telegram', 'success');
        } else {
            showMessage(`Telegram error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error testing Telegram:', error);
        showMessage('Failed to send Telegram test', 'error');
    } finally {
        testTelegramBtn.disabled = false;
        testTelegramBtn.textContent = '✈️ Test Telegram';
    }
}

// Test SMS
async function testSMS() {
    try {
        testSMSBtn.disabled = true;
        testSMSBtn.textContent = '⏳ Sending...';

        const response = await fetch(`${API_BASE}/api/test/sms`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('SMS test message sent! Check your phone', 'success');
        } else {
            showMessage(`SMS error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error testing SMS:', error);
        showMessage('Failed to send SMS test', 'error');
    } finally {
        testSMSBtn.disabled = false;
        testSMSBtn.textContent = '📱 Test SMS';
    }
}

// Show message
function showMessage(text, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;

    const container = document.querySelector('.container');
    container.insertBefore(message, container.firstChild);

    setTimeout(() => {
        message.remove();
    }, 5000);
}

// ===== DESKTOP NOTIFICATIONS =====
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showMessage('This browser does not support desktop notifications', 'error');
        return;
    }

    if (Notification.permission === 'granted') {
        showMessage('Desktop notifications already enabled!', 'success');
        showDesktopNotification('Test Notification', 'Desktop notifications are working!');
        return;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showMessage('Desktop notifications enabled!', 'success');
            showDesktopNotification('Test Notification', 'Desktop notifications are working!');
        } else {
            showMessage('Desktop notifications permission denied', 'error');
        }
    } else {
        showMessage('Desktop notifications are blocked. Please enable them in browser settings.', 'error');
    }
}

function showDesktopNotification(title, body, icon = '🔔') {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon,
            badge: icon,
            tag: 'todo-alert'
        });
    }
}

// ===== TEMPLATES =====
async function loadTemplates() {
    try {
        const response = await fetch(`${API_BASE}/api/templates`, {
            credentials: 'include'
        });
        templates = await response.json();

        templateSelect.innerHTML = '<option value="">💡 Use Template</option>';
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            templateSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function applyTemplate() {
    const templateId = parseInt(templateSelect.value);
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    document.getElementById('title').value = template.title;
    document.getElementById('description').value = template.description || '';
    document.getElementById('dueTime').value = template.dueTime;
    document.getElementById('recurring').value = template.recurring;
    document.getElementById('priority').value = template.priority || 'medium';
    document.getElementById('category').value = template.category || 'general';
    document.getElementById('reminderMinutes').value = template.reminderMinutes || 0;

    // Apply subtasks
    subtasks = template.subtasks ? template.subtasks.map(st => ({ ...st })) : [];
    renderSubtasks();

    showMessage(`Template "${template.name}" applied!`, 'success');
    templateSelect.value = '';
}

// ===== SUBTASKS =====
function addSubtask() {
    subtasks.push({ text: '', completed: false });
    renderSubtasks();
}

function removeSubtask(index) {
    subtasks.splice(index, 1);
    renderSubtasks();
}

function updateSubtaskText(index, text) {
    subtasks[index].text = text;
}

function renderSubtasks() {
    subtasksList.innerHTML = subtasks.map((subtask, index) => `
        <div class="subtask-item">
            <input type="text"
                   class="subtask-input"
                   placeholder="Subtask ${index + 1}"
                   value="${escapeHtml(subtask.text)}"
                   oninput="updateSubtaskText(${index}, this.value)">
            <button type="button" class="subtask-remove" onclick="removeSubtask(${index})">&times;</button>
        </div>
    `).join('');
}

function addEditSubtask() {
    editSubtasks.push({ text: '', completed: false });
    renderEditSubtasks();
}

function removeEditSubtask(index) {
    editSubtasks.splice(index, 1);
    renderEditSubtasks();
}

function updateEditSubtaskText(index, text) {
    editSubtasks[index].text = text;
}

function toggleEditSubtask(index) {
    editSubtasks[index].completed = !editSubtasks[index].completed;
    renderEditSubtasks();
}

function renderEditSubtasks() {
    editSubtasksList.innerHTML = editSubtasks.map((subtask, index) => `
        <div class="subtask-item">
            <input type="checkbox"
                   class="subtask-checkbox"
                   ${subtask.completed ? 'checked' : ''}
                   onchange="toggleEditSubtask(${index})">
            <input type="text"
                   class="subtask-input ${subtask.completed ? 'completed' : ''}"
                   placeholder="Subtask ${index + 1}"
                   value="${escapeHtml(subtask.text)}"
                   oninput="updateEditSubtaskText(${index}, this.value)">
            <button type="button" class="subtask-remove" onclick="removeEditSubtask(${index})">&times;</button>
        </div>
    `).join('');
}

// ===== BULK SELECTION =====
function toggleBulkSelectMode() {
    bulkSelectMode = !bulkSelectMode;
    selectedTaskIds.clear();

    if (bulkSelectMode) {
        bulkSelectToggle.textContent = '✗ Cancel Selection';
        bulkSelectToggle.classList.add('btn-danger');
        bulkSelectToggle.classList.remove('btn-outline');
    } else {
        bulkSelectToggle.textContent = '✓ Select Multiple';
        bulkSelectToggle.classList.remove('btn-danger');
        bulkSelectToggle.classList.add('btn-outline');
        bulkActionsBar.classList.add('hidden');
    }

    applyFilters();
}

function exitBulkSelectMode() {
    bulkSelectMode = false;
    selectedTaskIds.clear();
    bulkSelectToggle.textContent = '✓ Select Multiple';
    bulkSelectToggle.classList.remove('btn-danger');
    bulkSelectToggle.classList.add('btn-outline');
    bulkActionsBar.classList.add('hidden');
    applyFilters();
}

function toggleTaskSelection(taskId) {
    if (selectedTaskIds.has(taskId)) {
        selectedTaskIds.delete(taskId);
    } else {
        selectedTaskIds.add(taskId);
    }

    updateBulkActionsBar();
    applyFilters();
}

function updateBulkActionsBar() {
    const count = selectedTaskIds.size;
    selectedCount.textContent = count;

    if (count > 0) {
        bulkActionsBar.classList.remove('hidden');
    } else {
        bulkActionsBar.classList.add('hidden');
    }
}

async function handleBulkComplete() {
    if (selectedTaskIds.size === 0) return;

    if (!confirm(`Complete ${selectedTaskIds.size} tasks?`)) return;

    try {
        const promises = Array.from(selectedTaskIds).map(id =>
            fetch(`${API_BASE}/api/tasks/${id}/complete`, { method: 'PATCH', credentials: 'include' })
        );

        await Promise.all(promises);
        showMessage(`${selectedTaskIds.size} tasks completed!`, 'success');
        exitBulkSelectMode();
        loadTasks();
    } catch (error) {
        console.error('Error completing tasks:', error);
        showMessage('Failed to complete tasks', 'error');
    }
}

async function handleBulkDelete() {
    if (selectedTaskIds.size === 0) return;

    if (!confirm(`Delete ${selectedTaskIds.size} tasks? This cannot be undone.`)) return;

    try {
        const promises = Array.from(selectedTaskIds).map(id =>
            fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE', credentials: 'include' })
        );

        await Promise.all(promises);
        showMessage(`${selectedTaskIds.size} tasks deleted!`, 'success');
        exitBulkSelectMode();
        loadTasks();
    } catch (error) {
        console.error('Error deleting tasks:', error);
        showMessage('Failed to delete tasks', 'error');
    }
}

// ===== EDIT TASK =====
function openEditModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTitle').value = task.title;
    document.getElementById('editDescription').value = task.description || '';
    document.getElementById('editDueDate').value = task.dueDate;
    document.getElementById('editDueTime').value = task.dueTime;
    document.getElementById('editRecurring').value = task.recurring;
    document.getElementById('editPriority').value = task.priority || 'medium';
    document.getElementById('editCategory').value = task.category || 'general';
    document.getElementById('editReminderMinutes').value = task.reminderMinutes || 0;
    document.getElementById('editNotes').value = task.notes || '';

    // Load subtasks
    editSubtasks = (task.subtasks || []).map(st => ({ ...st }));
    renderEditSubtasks();

    editModal.classList.add('active');
}

function closeEditModal() {
    editModal.classList.remove('active');
    editTaskForm.reset();
    editSubtasks = [];
    renderEditSubtasks();
}

async function handleEditTask(e) {
    e.preventDefault();

    const taskId = parseInt(document.getElementById('editTaskId').value);
    const validSubtasks = editSubtasks.filter(st => st.text.trim() !== '');

    const updatedTask = {
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value,
        dueDate: document.getElementById('editDueDate').value,
        dueTime: document.getElementById('editDueTime').value,
        recurring: document.getElementById('editRecurring').value,
        priority: document.getElementById('editPriority').value,
        category: document.getElementById('editCategory').value,
        reminderMinutes: parseInt(document.getElementById('editReminderMinutes').value),
        notes: document.getElementById('editNotes').value,
        subtasks: validSubtasks,
        completed: false
    };

    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updatedTask)
        });

        if (response.ok) {
            showMessage('Task updated successfully!', 'success');
            closeEditModal();
            loadTasks();
        } else {
            throw new Error('Failed to update task');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showMessage('Failed to update task', 'error');
    }
}

// ===== SNOOZE TASK =====
async function toggleTaskSubtask(taskId, subtaskIndex) {
    try {
        const task = allTasks.find(t => t.id === taskId);
        if (!task || !task.subtasks || !task.subtasks[subtaskIndex]) return;

        const completed = !task.subtasks[subtaskIndex].completed;

        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/subtasks/${subtaskIndex}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ completed })
        });

        if (response.ok) {
            loadTasks();
        }
    } catch (error) {
        console.error('Error toggling subtask:', error);
    }
}

function openSnoozeModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const minutes = prompt(`Snooze "${task.title}" for how many minutes?`, '15');
    if (minutes && parseInt(minutes) > 0) {
        snoozeTask(taskId, parseInt(minutes));
    }
}

async function snoozeTask(taskId, minutes) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/snooze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ minutes })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(`Task snoozed for ${minutes} minutes`, 'success');
            loadTasks();
        } else {
            showMessage(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error snoozing task:', error);
        showMessage('Failed to snooze task', 'error');
    }
}

// ===== DRAG AND DROP =====
let draggedTaskId = null;

function handleDragStart(e) {
    draggedTaskId = parseInt(e.currentTarget.dataset.taskId);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const taskCard = e.currentTarget;
    if (taskCard.classList.contains('task-card') && !taskCard.classList.contains('dragging')) {
        taskCard.classList.add('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const targetTaskId = parseInt(e.currentTarget.dataset.taskId);

    if (draggedTaskId && targetTaskId && draggedTaskId !== targetTaskId) {
        reorderTasks(draggedTaskId, targetTaskId);
    }
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedTaskId = null;
}

function reorderTasks(movedTaskId, targetTaskId) {
    // Find the tasks
    const movedIndex = filteredTasks.findIndex(t => t.id === movedTaskId);
    const targetIndex = filteredTasks.findIndex(t => t.id === targetTaskId);

    if (movedIndex === -1 || targetIndex === -1) return;

    // Reorder in the filtered array
    const [movedTask] = filteredTasks.splice(movedIndex, 1);
    filteredTasks.splice(targetIndex, 0, movedTask);

    // Re-display
    displayTasks(filteredTasks, tasksList, false);
    showMessage('Task reordered!', 'success');
}

// Make functions global for onclick handlers
window.completeTask = completeTask;
window.deleteTask = deleteTask;
window.toggleTaskSelection = toggleTaskSelection;
window.openEditModal = openEditModal;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.removeSubtask = removeSubtask;
window.updateSubtaskText = updateSubtaskText;
window.removeEditSubtask = removeEditSubtask;
window.updateEditSubtaskText = updateEditSubtaskText;
window.toggleEditSubtask = toggleEditSubtask;
window.toggleTaskSubtask = toggleTaskSubtask;
window.openSnoozeModal = openSnoozeModal;

// Reports functionality
const loadReportBtn = document.getElementById('loadReportBtn');
const reportPeriod = document.getElementById('reportPeriod');

loadReportBtn.addEventListener('click', loadReports);

// Load overall summary and period stats
async function loadReports() {
    try {
        loadReportBtn.disabled = true;
        loadReportBtn.textContent = '⏳ Loading...';

        // Load summary stats
        const summaryResponse = await fetch(`${API_BASE}/api/stats/summary`, {
            credentials: 'include'
        });
        const summary = await summaryResponse.json();

        document.getElementById('totalTasks').textContent = summary.total;
        document.getElementById('completedTasks').textContent = summary.completed;
        document.getElementById('pendingTasks').textContent = summary.pending;
        document.getElementById('overdueTasks').textContent = summary.overdue;
        document.getElementById('completionRate').textContent = `${summary.completionRate}%`;

        // Load period stats
        const period = reportPeriod.value;
        const periodResponse = await fetch(`${API_BASE}/api/stats/${period}`, {
            credentials: 'include'
        });
        const periodStats = await periodResponse.json();

        displayPeriodStats(periodStats, period);
    } catch (error) {
        console.error('Error loading reports:', error);
        showMessage('Failed to load reports', 'error');
    } finally {
        loadReportBtn.disabled = false;
        loadReportBtn.textContent = 'Load Report';
    }
}

// Display period statistics
function displayPeriodStats(stats, period) {
    const container = document.getElementById('periodStats');

    if (stats.length === 0) {
        container.innerHTML = '<p class="empty-state">No data available for this period</p>';
        return;
    }

    const periodName = period.charAt(0).toUpperCase() + period.slice(1);

    let tableHTML = `
        <h3>${periodName} Performance</h3>
        <table class="period-table">
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Total</th>
                    <th>Completed</th>
                    <th>Pending</th>
                    <th>Overdue</th>
                    <th>Completion Rate</th>
                </tr>
            </thead>
            <tbody>
    `;

    stats.forEach(stat => {
        const rateClass = getRateClass(stat.completionRate);
        tableHTML += `
            <tr>
                <td><strong>${stat.period}</strong></td>
                <td>${stat.total}</td>
                <td style="color: #48c774;">${stat.completed}</td>
                <td style="color: #3298dc;">${stat.pending}</td>
                <td style="color: #f14668;">${stat.overdue}</td>
                <td>
                    <span class="rate-badge ${rateClass}">
                        ${stat.completionRate}%
                    </span>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

// Get rate class for styling
function getRateClass(rate) {
    if (rate >= 80) return 'excellent';
    if (rate >= 60) return 'good';
    if (rate >= 40) return 'average';
    return 'poor';
}

// Load reports on page load
setTimeout(() => {
    loadReports();
}, 2000);
