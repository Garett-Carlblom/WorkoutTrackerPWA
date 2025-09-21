const storageKey = 'workout-tracker-data-v1';
const workoutForm = document.getElementById('workoutForm');
const exerciseList = document.getElementById('exerciseList');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const summaryGrid = document.getElementById('summaryGrid');
const historyContainer = document.getElementById('history');
const exerciseTemplate = document.getElementById('exerciseRowTemplate');
const toast = document.getElementById('toast');
const installBtn = document.getElementById('installBtn');

let workouts = loadWorkouts();
let editingWorkoutId = null;
let deferredPrompt;

init();

function init() {
  addExerciseRow();
  setDefaultDate();
  renderSummary();
  renderHistory();
  setupEventListeners();
  maybeApplyDarkTheme();
}

function setupEventListeners() {
  addExerciseBtn.addEventListener('click', () => addExerciseRow());

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
    if (event.target.classList.contains('remove-exercise')) {
      const row = event.target.closest('.exercise-row');
      removeExerciseRow(row);
    }
  });

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
  const clone = exerciseTemplate.content.cloneNode(true);
  const row = clone.querySelector('.exercise-row');
  const inputs = row.querySelectorAll('input');
  const { exercise = '', sets = '', reps = '', weight = '' } = values;
  inputs[0].value = exercise;
  inputs[1].value = sets;
  inputs[2].value = reps;
  inputs[3].value = weight;
  exerciseList.appendChild(clone);
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
      const input = row.querySelectorAll('input');
      const exercise = input[0].value.trim();
      const sets = Number(input[1].value);
      const reps = Number(input[2].value);
      const weight = Number(input[3].value);
      return {
        exercise,
        sets,
        reps,
        weight: Number.isNaN(weight) ? 0 : weight,
      };
    })
    .filter(({ exercise }) => exercise.length);

  return {
    date,
    focus,
    notes,
    exercises,
  };
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
  const workoutsThisWeek = sortedWorkouts.filter((workout) => new Date(workout.date) >= weekAgo).length;

  const strongest = sortedWorkouts.reduce(
    (acc, workout) => {
      workout.exercises.forEach((exercise) => {
        if (!exercise.exercise) return;
        if (exercise.weight > acc.weight) {
          acc = {
            name: exercise.exercise,
            weight: exercise.weight,
          };
        }
      });
      return acc;
    },
    { name: 'Add lifts', weight: 0 }
  );

  const lastWorkout = sortedWorkouts[0];
  const lastVolume = lastWorkout
    ? calculateVolume(lastWorkout.exercises).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0';

  const cards = [
    {
      label: 'Total workouts',
      value: totalWorkouts,
    },
    {
      label: 'Sessions this week',
      value: workoutsThisWeek,
    },
    {
      label: 'Top lift',
      value: strongest.weight ? `${strongest.name} • ${strongest.weight} kg` : 'Add lifts',
    },
    {
      label: 'Last session volume',
      value: `${lastVolume} kg reps`,
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

  if (!workouts.length) {
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

  workouts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((workout) => {
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
      workout.exercises.forEach((exercise) => {
        const item = document.createElement('li');
        const volume = calculateVolume([exercise]);
        item.innerHTML = `<strong>${exercise.exercise}</strong>: ${exercise.sets} × ${exercise.reps}${
          exercise.weight ? ` @ ${exercise.weight}kg` : ''
        } <span class="muted">(${volume} kg reps)</span>`;
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
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => startEditing(workout.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost small';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteWorkout(workout.id));

      footer.append(editBtn, deleteBtn);
      article.appendChild(footer);

      historyContainer.appendChild(article);
    });
}

function startEditing(id) {
  const workout = workouts.find((item) => item.id === id);
  if (!workout) return;

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
    const weight = Number(exercise.weight) || 0;
    const sets = Number(exercise.sets) || 0;
    const reps = Number(exercise.reps) || 0;
    return total + weight * sets * reps;
  }, 0);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
