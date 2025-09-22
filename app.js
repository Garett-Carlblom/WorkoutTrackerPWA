const storageKey = 'workout-tracker-data-v1';
const templateStorageKey = 'workout-tracker-templates-v1';
const viewStorageKey = 'workout-tracker-active-view';
const defaultView = 'log';
const workoutForm = document.getElementById('workoutForm');
const exerciseList = document.getElementById('exerciseList');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const summaryGrid = document.getElementById('summaryGrid');
const historyContainer = document.getElementById('history');
const historyRangeSelect = document.getElementById('historyRange');
const historyFocusSelect = document.getElementById('historyFocus');
const historySummary = document.getElementById('historySummary');
const exerciseTemplate = document.getElementById('exerciseRowTemplate');
const setTemplate = document.getElementById('setRowTemplate');
const toast = document.getElementById('toast');
const installBtn = document.getElementById('installBtn');
const templateSelect = document.getElementById('templateSelect');
const applyTemplateBtn = document.getElementById('applyTemplateBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
const tabButtons = Array.from(document.querySelectorAll('[data-view-target]'));
const viewSections = Array.from(document.querySelectorAll('[data-view]'));

let workouts = loadWorkouts();
let templates = loadTemplates();
let editingWorkoutId = null;
let deferredPrompt;
let historyFilters = {
  range: 'all',
  focus: 'all',
};

init();

function init() {
  addExerciseRow();
  setDefaultDate();
  renderSummary();
  renderHistory();
  renderTemplateOptions();
  setupEventListeners();
  maybeApplyDarkTheme();
  restoreActiveView();
}

function setupEventListeners() {
  if (tabButtons.length) {
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        switchView(button.dataset.viewTarget);
      });
      button.addEventListener('keydown', handleTabKeydown);
    });
  }

  addExerciseBtn.addEventListener('click', () => {
    const row = addExerciseRow();
    const input = row.querySelector('input[name="exercise"]');
    if (input) {
      input.focus();
    }
  });

  workoutForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!workoutForm.reportValidity()) {
      return;
    }

    const workoutData = collectFormData();
    if (!workoutData.exercises.length) {
      showToast('Add at least one exercise.');
      return;
    }

    if (editingWorkoutId) {
      workouts = workouts.map((workout) =>
        workout.id === editingWorkoutId ? { ...workout, ...workoutData } : workout
      );
      showToast('Workout updated.');
    } else {
      workouts.unshift({
        ...workoutData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      });
      showToast('Workout saved.');
    }

    saveWorkouts();
    renderSummary();
    renderHistory();
    resetForm();
  });

  workoutForm.addEventListener('reset', () => {
    setTimeout(resetForm, 0);
  });

  exerciseList.addEventListener('click', (event) => {
    const removeExerciseButton = event.target.closest('.remove-exercise');
    if (removeExerciseButton) {
      const row = removeExerciseButton.closest('.exercise-row');
      removeExerciseRow(row);
      return;
    }

    const addSetButton = event.target.closest('.add-set');
    if (addSetButton) {
      const row = addSetButton.closest('.exercise-row');
      addSetRow(row, {}, { focus: true });
      return;
    }

    const removeSetButton = event.target.closest('.remove-set');
    if (removeSetButton) {
      const row = removeSetButton.closest('.exercise-row');
      const setRow = removeSetButton.closest('.set-row');
      removeSetRow(row, setRow);
    }
  });

  templateSelect.addEventListener('change', updateTemplateControlState);

  applyTemplateBtn.addEventListener('click', () => {
    const templateId = templateSelect.value;
    if (!templateId) {
      showToast('Choose a template to apply.');
      return;
    }
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      showToast('Template not found.');
      renderTemplateOptions();
      return;
    }
    if (!confirm(`Apply template "${template.name}"? This will replace the current exercises.`)) {
      return;
    }
    applyTemplate(template);
  });

  saveTemplateBtn.addEventListener('click', () => {
    if (!workoutForm.reportValidity()) {
      showToast('Complete the workout details before saving the template.');
      return;
    }
    const { focus, exercises } = collectFormData();
    if (!exercises.length) {
      showToast('Add at least one exercise to save as a template.');
      return;
    }
    const rawName = prompt('Name this template:');
    const name = rawName?.trim();
    if (!name) {
      showToast('Template name is required.');
      return;
    }
    const template = {
      id: generateId(),
      name,
      focus,
      exercises,
    };
    templates.push(template);
    saveTemplates();
    renderTemplateOptions(template.id);
    showToast('Template saved.');
  });

  deleteTemplateBtn.addEventListener('click', () => {
    const templateId = templateSelect.value;
    if (!templateId) {
      showToast('Choose a template to delete.');
      return;
    }
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      showToast('Template not found.');
      renderTemplateOptions();
      return;
    }
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) {
      return;
    }
    templates = templates.filter((item) => item.id !== templateId);
    saveTemplates();
    renderTemplateOptions();
    showToast('Template deleted.');
  });

  if (historyRangeSelect) {
    historyRangeSelect.addEventListener('change', () => {
      historyFilters.range = historyRangeSelect.value;
      renderHistory();
    });
  }

  if (historyFocusSelect) {
    historyFocusSelect.addEventListener('change', () => {
      historyFilters.focus = historyFocusSelect.value;
      renderHistory();
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Installing Workout Tracker...');
    }
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function addExerciseRow(values = {}) {
  const row = exerciseTemplate.content.firstElementChild.cloneNode(true);
  const nameInput = row.querySelector('input[name="exercise"]');
  nameInput.value = values.exercise || '';
  const sets = Array.isArray(values.sets) && values.sets.length ? values.sets : [{}];
  sets.forEach((setValues) => {
    addSetRow(row, setValues || {}, { focus: false });
  });
  exerciseList.appendChild(row);
  updateSetLabels(row);
  return row;
}

function removeExerciseRow(row) {
  const allRows = Array.from(exerciseList.querySelectorAll('.exercise-row'));
  if (allRows.length <= 1) {
    showToast('You need at least one exercise.');
    return;
  }
  row.remove();
}

function collectFormData() {
  const formData = new FormData(workoutForm);
  const date = formData.get('date');
  const focus = formData.get('focus')?.trim();
  const notes = formData.get('notes')?.trim();
  const exercises = Array.from(exerciseList.querySelectorAll('.exercise-row'))
    .map((row) => {
      const exerciseName = row.querySelector('input[name="exercise"]').value.trim();
      const sets = getSetRows(row).map((setRow) => {
        const repsInput = setRow.querySelector('input[name="reps"]');
        const weightInput = setRow.querySelector('input[name="weight"]');
        const repsValue = Number(repsInput.value);
        const weightRaw = weightInput.value;
        const weightValue =
          weightRaw === '' || weightRaw === null || weightRaw === undefined
            ? null
            : Number(weightRaw);
        return {
          reps: Number.isNaN(repsValue) ? 0 : repsValue,
          weight: weightValue === null || Number.isNaN(weightValue) ? null : weightValue,
        };
      });
      return {
        exercise: exerciseName,
        sets,
      };
    })
    .filter(({ exercise, sets }) => exercise.length && sets.length);

  return {
    date,
    focus,
    notes,
    exercises,
  };
}

function addSetRow(exerciseRow, values = {}, options = {}) {
  const setList = exerciseRow.querySelector('.set-list');
  if (!setList) {
    return null;
  }
  const setRow = setTemplate.content.firstElementChild.cloneNode(true);
  const repsInput = setRow.querySelector('input[name="reps"]');
  const weightInput = setRow.querySelector('input[name="weight"]');

  setNumberInputValue(repsInput, values.reps);
  setNumberInputValue(weightInput, values.weight);

  setList.appendChild(setRow);
  updateSetLabels(exerciseRow);

  if (options.focus) {
    setTimeout(() => repsInput.focus(), 0);
  }

  return setRow;
}

function removeSetRow(exerciseRow, setRow) {
  if (!setRow) {
    return;
  }
  const rows = getSetRows(exerciseRow);
  if (rows.length <= 1) {
    showToast('Keep at least one set.');
    return;
  }
  setRow.remove();
  updateSetLabels(exerciseRow);
}

function getSetRows(exerciseRow) {
  return Array.from(exerciseRow.querySelectorAll('.set-row'));
}

function updateSetLabels(exerciseRow) {
  getSetRows(exerciseRow).forEach((row, index) => {
    const label = row.querySelector('.set-label');
    if (label) {
      label.textContent = `Set ${index + 1}`;
    }
  });
}

function setNumberInputValue(input, value) {
  if (!input) {
    return;
  }
  if (value === null || value === undefined || value === '') {
    input.value = '';
    return;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    input.value = '';
    return;
  }
  input.value = numeric;
}

function renderSummary() {
  summaryGrid.innerHTML = '';

  if (!workouts.length) {
    summaryGrid.innerHTML = `
      <article class="summary-card" role="listitem">
        <span>Getting started</span>
        <strong>Log your first workout</strong>
      </article>
    `;
    return;
  }

  const sortedWorkouts = workouts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalWorkouts = sortedWorkouts.length;
  const weekAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const workoutsThisWeek = sortedWorkouts.filter((workout) => new Date(workout.date) >= weekAgo);
  const totalSets = sortedWorkouts
    .reduce(
      (total, workout) =>
        total + workout.exercises.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0),
      0
    );
  const volumeThisWeek = workoutsThisWeek.reduce(
    (total, workout) => total + calculateVolume(workout.exercises),
    0
  );
  const streak = calculateCurrentStreak(sortedWorkouts);

  const cards = [
    {
      label: 'Total workouts',
      value: totalWorkouts.toLocaleString(),
    },
    {
      label: 'Sessions this week',
      value: workoutsThisWeek.length.toLocaleString(),
    },
    {
      label: 'Sets logged',
      value: totalSets.toLocaleString(),
    },
    {
      label: 'Volume (7 days)',
      value: volumeThisWeek
        ? `${volumeThisWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg·reps`
        : '0 kg·reps',
    },
    {
      label: 'Current streak',
      value: `${streak} day${streak === 1 ? '' : 's'}`,
    },
  ];

  cards.forEach((card) => {
    const article = document.createElement('article');
    article.className = 'summary-card';
    article.setAttribute('role', 'listitem');
    article.innerHTML = `<span>${card.label}</span><strong>${card.value}</strong>`;
    summaryGrid.appendChild(article);
  });
}

function renderHistory() {
  historyContainer.innerHTML = '';

  if (historyFocusSelect) {
    populateHistoryFocusOptions();
  }

  if (historyRangeSelect) {
    const disableRange = workouts.length === 0;
    historyRangeSelect.disabled = disableRange;
    if (disableRange) {
      historyRangeSelect.value = 'all';
      historyFilters.range = 'all';
    }
  }

  if (!workouts.length) {
    updateHistorySummary([], { empty: true });
    const emptyState = document.createElement('div');
    emptyState.className = 'history-card';
    emptyState.innerHTML = `
      <header>
        <h3>No workouts yet</h3>
      </header>
      <p class="muted">Your logged workouts will show up here. Add one above to build your streak.</p>
    `;
    historyContainer.appendChild(emptyState);
    return;
  }

  const filteredWorkouts = workouts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((workout) => matchesHistoryRange(workout, historyFilters.range))
    .filter((workout) => matchesHistoryFocus(workout, historyFilters.focus));

  if (!filteredWorkouts.length) {
    updateHistorySummary([], { filtered: true });
    const emptyState = document.createElement('div');
    emptyState.className = 'history-card';
    emptyState.innerHTML = `
      <header>
        <h3>No workouts match filters</h3>
      </header>
      <p class="muted">Try adjusting the time range or focus to review past sessions.</p>
    `;
    historyContainer.appendChild(emptyState);
    return;
  }

  updateHistorySummary(filteredWorkouts);

  filteredWorkouts.forEach((workout) => {
    const article = document.createElement('article');
    article.className = 'history-card';
    article.tabIndex = 0;

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = workout.focus || 'Training session';
    header.appendChild(title);

    const time = document.createElement('time');
    time.dateTime = workout.date;
    time.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(workout.date));
    header.appendChild(time);

    article.appendChild(header);

    if (workout.focus) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = workout.focus;
      article.appendChild(tag);
    }

    const list = document.createElement('ul');
    list.className = 'exercise-summary';
    workout.exercises.forEach((exercise) => {
      const item = document.createElement('li');

      const name = document.createElement('strong');
      name.textContent = exercise.exercise || 'Exercise';
      item.appendChild(name);

      const setDetails = document.createElement('div');
      setDetails.className = 'set-detail-list';

      exercise.sets.forEach((set, index) => {
        const detail = document.createElement('div');
        detail.className = 'set-detail';

        const label = document.createElement('span');
        label.className = 'set-detail-label';
        label.textContent = `Set ${index + 1}`;

        const value = document.createElement('span');
        value.className = 'set-detail-value';
        const repsNumber = Number(set.reps);
        const repsText = Number.isNaN(repsNumber) ? '' : `${repsNumber} reps`;
        const weightNumber =
          set.weight === null || set.weight === undefined ? NaN : Number(set.weight);
        const weightText = Number.isNaN(weightNumber)
          ? ''
          : ` @ ${weightNumber.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
        value.textContent = `${repsText}${weightText}`.trim();

        detail.append(label, value);
        setDetails.appendChild(detail);
      });

      const exerciseVolume = calculateVolume([exercise]);
      if (exerciseVolume) {
        const total = document.createElement('div');
        total.className = 'set-total';
        total.textContent = `Volume: ${exerciseVolume.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })} kg·reps`;
        setDetails.appendChild(total);
      }

      item.appendChild(setDetails);
      list.appendChild(item);
    });
    article.appendChild(list);

    if (workout.notes) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Notes';
      const notes = document.createElement('p');
      notes.textContent = workout.notes;
      details.append(summary, notes);
      article.appendChild(details);
    }

    const footer = document.createElement('div');
    footer.className = 'history-actions';

    const repeatBtn = document.createElement('button');
    repeatBtn.type = 'button';
    repeatBtn.className = 'secondary small';
    repeatBtn.textContent = 'Repeat';
    repeatBtn.addEventListener('click', () => repeatWorkout(workout.id));

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEditing(workout.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost small danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteWorkout(workout.id));

    footer.append(repeatBtn, editBtn, deleteBtn);
    article.appendChild(footer);

    historyContainer.appendChild(article);
  });
}

function populateHistoryFocusOptions() {
  if (!historyFocusSelect) {
    return;
  }

  const previousValue = historyFocusSelect.value || 'all';
  const focusMap = new Map();

  workouts.forEach((workout) => {
    const focus = (workout.focus || '').trim();
    if (!focus) {
      return;
    }
    const key = focus.toLowerCase();
    if (!focusMap.has(key)) {
      focusMap.set(key, focus);
    }
  });

  historyFocusSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.textContent = 'All focuses';
  historyFocusSelect.appendChild(defaultOption);

  Array.from(focusMap.entries())
    .sort(([, labelA], [, labelB]) =>
      labelA.localeCompare(labelB, undefined, { sensitivity: 'base' })
    )
    .forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      historyFocusSelect.appendChild(option);
    });

  if (focusMap.size === 0) {
    historyFocusSelect.disabled = true;
    historyFocusSelect.value = 'all';
    historyFilters.focus = 'all';
    return;
  }

  historyFocusSelect.disabled = false;
  if (previousValue !== 'all' && focusMap.has(previousValue)) {
    historyFocusSelect.value = previousValue;
    historyFilters.focus = previousValue;
  } else {
    historyFocusSelect.value = 'all';
    historyFilters.focus = 'all';
  }
}

function matchesHistoryRange(workout, range) {
  if (range === 'all') {
    return true;
  }
  const workoutDate = startOfDay(new Date(workout.date));
  if (Number.isNaN(workoutDate.getTime())) {
    return false;
  }

  const today = startOfDay(new Date());
  if (range === 'week') {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - 6);
    return workoutDate >= threshold;
  }

  if (range === 'month') {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - 29);
    return workoutDate >= threshold;
  }

  return true;
}

function matchesHistoryFocus(workout, focus) {
  if (focus === 'all') {
    return true;
  }
  const workoutFocus = (workout.focus || '').trim().toLowerCase();
  return workoutFocus === focus;
}

function updateHistorySummary(filteredWorkouts, state = {}) {
  if (!historySummary) {
    return;
  }

  if (state.empty) {
    historySummary.textContent = 'No workouts yet. Add one above to build your streak.';
    return;
  }

  if (state.filtered) {
    historySummary.textContent = 'No workouts match the selected filters yet.';
    return;
  }

  if (!filteredWorkouts.length) {
    historySummary.textContent = '';
    return;
  }

  const count = filteredWorkouts.length;
  const label = count === 1 ? 'workout' : 'workouts';
  let message = `Showing ${count} ${label}`;

  if (historyFilters.range === 'week') {
    message += ' in the last 7 days';
  } else if (historyFilters.range === 'month') {
    message += ' in the last 30 days';
  }

  if (historyFilters.focus !== 'all') {
    const selectedOption = historyFocusSelect?.selectedOptions?.[0];
    const focusLabel = selectedOption ? selectedOption.textContent : '';
    if (focusLabel) {
      message += ` focused on ${focusLabel}`;
    }
  }

  historySummary.textContent = `${message}.`;
}

function repeatWorkout(id) {
  const workout = workouts.find((item) => item.id === id);
  if (!workout) {
    return;
  }

  switchView('log');
  editingWorkoutId = null;
  workoutForm.querySelector('.primary').textContent = 'Save workout';
  workoutForm.elements.focus.value = workout.focus || '';
  workoutForm.elements.notes.value = '';
  setDefaultDate();

  exerciseList.innerHTML = '';
  if (workout.exercises.length) {
    workout.exercises.forEach((exercise) => addExerciseRow(exercise));
  } else {
    addExerciseRow();
  }

  if (templateSelect) {
    templateSelect.value = '';
    updateTemplateControlState();
  }

  const firstExerciseInput = exerciseList.querySelector('input[name="exercise"]');
  if (firstExerciseInput) {
    firstExerciseInput.focus();
  }

  workoutForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Workout loaded. Save to log it again.');
}

function applyTemplate(template) {
  templateSelect.value = template.id;
  workoutForm.elements.focus.value = template.focus || '';
  exerciseList.innerHTML = '';
  if (template.exercises.length) {
    template.exercises.forEach((exercise) => addExerciseRow(exercise));
  } else {
    addExerciseRow();
  }
  updateTemplateControlState();
  showToast('Template applied.');
}

function renderTemplateOptions(selectedId) {
  const desiredValue = typeof selectedId === 'string' ? selectedId : templateSelect.value;
  templateSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a template...';
  templateSelect.appendChild(placeholder);

  templates.forEach((template) => {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });

  if (desiredValue && templates.some((template) => template.id === desiredValue)) {
    templateSelect.value = desiredValue;
  } else {
    templateSelect.value = '';
  }

  updateTemplateControlState();
}

function updateTemplateControlState() {
  const hasTemplates = templates.length > 0;
  templateSelect.disabled = !hasTemplates;
  applyTemplateBtn.disabled = !hasTemplates || !templateSelect.value;
  deleteTemplateBtn.disabled = !templateSelect.value;
}

function startEditing(id) {
  const workout = workouts.find((item) => item.id === id);
  if (!workout) return;

  switchView('log');
  editingWorkoutId = workout.id;
  workoutForm.querySelector('.primary').textContent = 'Update workout';
  workoutForm.scrollIntoView({ behavior: 'smooth', block: 'start' });

  workoutForm.elements.date.value = workout.date;
  workoutForm.elements.focus.value = workout.focus || '';
  workoutForm.elements.notes.value = workout.notes || '';

  exerciseList.innerHTML = '';
  workout.exercises.forEach((exercise) => addExerciseRow(exercise));
  showToast('Editing workout. Save to update.');
}

function deleteWorkout(id) {
  const workout = workouts.find((item) => item.id === id);
  if (!workout) return;
  if (!confirm('Delete this workout? This cannot be undone.')) {
    return;
  }
  workouts = workouts.filter((item) => item.id !== id);
  saveWorkouts();
  renderSummary();
  renderHistory();
  if (editingWorkoutId === id) {
    resetForm();
  }
  showToast('Workout deleted.');
}

function resetForm() {
  editingWorkoutId = null;
  workoutForm.reset();
  workoutForm.querySelector('.primary').textContent = 'Save workout';
  exerciseList.innerHTML = '';
  addExerciseRow();
  setDefaultDate();
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  workoutForm.elements.date.value = today;
}

function calculateVolume(exercises) {
  return exercises.reduce((total, exercise) => {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const exerciseTotal = sets.reduce((sum, set) => {
      const reps = Number(set?.reps);
      const weight = set?.weight === null || set?.weight === undefined ? 0 : Number(set.weight);
      const safeReps = Number.isNaN(reps) ? 0 : reps;
      const safeWeight = Number.isNaN(weight) ? 0 : weight;
      return sum + safeReps * safeWeight;
    }, 0);
    return total + exerciseTotal;
  }, 0);
}

function calculateCurrentStreak(sortedWorkouts) {
  if (!sortedWorkouts.length) {
    return 0;
  }

  const normalizedDates = sortedWorkouts
    .map((workout) => startOfDay(new Date(workout.date)))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (!normalizedDates.length) {
    return 0;
  }

  const dateKeys = new Set(normalizedDates.map(toDateKey));
  let streak = 0;
  let cursor = normalizedDates[0];

  while (dateKeys.has(toDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(date) {
  if (!(date instanceof Date)) {
    return '';
  }
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeWorkout)
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to parse stored workouts', error);
    return [];
  }
}

function saveWorkouts() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(workouts));
  } catch (error) {
    console.error('Failed to save workouts', error);
    showToast('Unable to save. Check storage availability.');
  }
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem(templateStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((template) => {
        if (!template || typeof template !== 'object') {
          return null;
        }
        const normalizedExercises = Array.isArray(template.exercises)
          ? template.exercises.map(normalizeExercise).filter(Boolean)
          : [];
        const name = typeof template.name === 'string' ? template.name.trim() : '';
        return {
          id: template.id || generateId(),
          name: name || 'Template',
          focus: typeof template.focus === 'string' ? template.focus : '',
          exercises: normalizedExercises,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to parse stored templates', error);
    return [];
  }
}

function saveTemplates() {
  try {
    localStorage.setItem(templateStorageKey, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save templates', error);
    showToast('Unable to save template. Check storage availability.');
  }
}

function normalizeWorkout(workout) {
  if (!workout || typeof workout !== 'object') {
    return null;
  }
  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises.map(normalizeExercise).filter(Boolean)
    : [];
  return {
    ...workout,
    exercises,
  };
}

function normalizeExercise(exercise) {
  if (!exercise || typeof exercise !== 'object') {
    return null;
  }

  const nameSource =
    typeof exercise.exercise === 'string'
      ? exercise.exercise
      : typeof exercise.name === 'string'
      ? exercise.name
      : typeof exercise.title === 'string'
      ? exercise.title
      : '';
  const name = nameSource.trim();

  if (Array.isArray(exercise.sets)) {
    const sets = exercise.sets
      .map((set) => {
        const repsValue = Number(set?.reps);
        const weightRaw = set?.weight;
        const weightValue =
          weightRaw === null || weightRaw === undefined || weightRaw === ''
            ? null
            : Number(weightRaw);
        return {
          reps: Number.isNaN(repsValue) || repsValue < 1 ? 1 : Math.round(repsValue),
          weight: weightValue === null || Number.isNaN(weightValue) ? null : weightValue,
        };
      })
      .filter((set) => set.reps || set.weight !== null);

    return {
      exercise: name,
      sets: sets.length ? sets : [{ reps: 1, weight: null }],
    };
  }

  const setsCount = Number(exercise.sets);
  const repsValue = Number(exercise.reps);
  const weightRaw = exercise.weight;
  const weightValue =
    weightRaw === null || weightRaw === undefined || weightRaw === '' ? null : Number(weightRaw);
  const safeWeight = weightValue === null || Number.isNaN(weightValue) ? null : weightValue;
  const safeReps = Number.isNaN(repsValue) || repsValue < 1 ? 1 : Math.round(repsValue);

  let sets = [];
  if (!Number.isNaN(setsCount) && setsCount > 0) {
    for (let index = 0; index < setsCount; index += 1) {
      sets.push({ reps: safeReps, weight: safeWeight });
    }
  } else if (!Number.isNaN(repsValue) || safeWeight !== null) {
    sets = [{ reps: safeReps, weight: safeWeight }];
  } else {
    sets = [{ reps: 1, weight: null }];
  }

  return {
    exercise: name,
    sets,
  };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2600);
}

function maybeApplyDarkTheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) {
    document.body.classList.add('dark-theme');
  }
}

function restoreActiveView() {
  if (!viewSections.length) {
    return;
  }

  const availableViews = viewSections
    .map((section) => section.dataset.view)
    .filter(Boolean);
  const storedView = getStoredView();
  const initialView = availableViews.includes(storedView)
    ? storedView
    : availableViews.includes(defaultView)
    ? defaultView
    : availableViews[0];

  if (initialView) {
    switchView(initialView);
  }
}

function getStoredView() {
  try {
    return localStorage.getItem(viewStorageKey) || '';
  } catch (error) {
    console.debug('Unable to read stored view', error);
    return '';
  }
}

function switchView(viewName) {
  if (!viewName || !viewSections.length) {
    return;
  }

  const targetSection = viewSections.find((section) => section.dataset.view === viewName);
  const targetButton = tabButtons.find((button) => button.dataset.viewTarget === viewName);

  if (!targetSection || !targetButton) {
    return;
  }

  viewSections.forEach((section) => {
    const isActive = section === targetSection;
    section.classList.toggle('is-active', isActive);
    section.toggleAttribute('hidden', !isActive);
  });

  tabButtons.forEach((button) => {
    const isActive = button === targetButton;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    button.classList.toggle('active', isActive);
  });

  try {
    localStorage.setItem(viewStorageKey, viewName);
  } catch (error) {
    console.debug('Unable to store active view', error);
  }
}

function handleTabKeydown(event) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return;
  }

  event.preventDefault();
  const currentIndex = tabButtons.indexOf(event.currentTarget);
  if (currentIndex === -1) {
    return;
  }

  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (currentIndex + direction + tabButtons.length) % tabButtons.length;
  const nextButton = tabButtons[nextIndex];
  if (nextButton) {
    nextButton.focus();
    switchView(nextButton.dataset.viewTarget);
  }
}
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
