import {
  LOCAL_STORAGE_KEY,
  clearFeedback,
  showFeedback,
  loadPlans,
  savePlans
} from './utils.js';

const plansDisplay = document.getElementById('plans-display');
const plansFeedback = document.getElementById('plans-feedback');
const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const editNote = document.getElementById('edit-note');
const editDate = document.getElementById('edit-date');
const editCancel = document.getElementById('edit-cancel');

// This thing below will holds the id of the plan currently being edited
let editingPlanId = null;

/**
  * Renders a single plan card into the plans display area.
  * plan: The plan object to render.
  */
function renderPlanCard(plan) {
  const card = document.createElement('article');
  card.className = 'plan-card';
  card.dataset.planId = plan.id;

  const image = document.createElement('img');
  image.className = 'plan-card__image';
  image.src = plan.strMealThumb;
  image.alt = plan.strMeal;

  const body = document.createElement('div');
  body.className = 'plan-card__body';

  const title = document.createElement('h3');
  title.className = 'plan-card__title';
  title.textContent = plan.strMeal;

  const note = document.createElement('p');
  note.className = 'plan-card__note';
  note.textContent = plan.note || 'No written note yet.';

  const date = document.createElement('p');
  date.className = 'plan-card__date';
  if (plan.plannedDate) {
    date.textContent = `Planned for: ${plan.plannedDate}`;
  } else {
    date.textContent = 'No setted date.';
  }

  const actions = document.createElement('button');
  actions.className = 'plan-card__actions';

  const editButton = document.createElement('button');
  editButton.className = 'btn btn--secondary';
  editButton.textContent = 'Edit';
  editButton.dataset.action = 'edit';
  editButton.dataset.planId = plan.id;

  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn btn--danger';
  deleteButton.textContent = 'Delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.planId = plan.id;

  actions.append(editButton, deleteButton);
  body.append(title, note, date, actions);
  card.append(image, body);
  plansDisplay.appendChild(card);
}

/**
  * Renders all stored plans from the localStorage into the plans display area.
  * If there is no plans stored yet, a simple sentence will be displayed.
  */
function renderAllPlans() {
  plansDisplay.textContent = '';
  const plans = loadPlans();

  if (plans.length === 0) {
    // It turns out we received an empty list from loadPlans()
    const empty = document.createElement('p');
    empty.className = 'plans-empty';
    empty.textContent = 'No meal plans saved yet. Go to Search and ' +
        'add a recipe.';
    plansDisplay.appendChild(empty);
    return;
  }

  // Alright we render one by one
  plans.forEach((plan) => renderPlanCard(plan));
}

/**
  * Open the edit dialog and pre-fills it with the plan's current values.
  * planId: The id of the plan to edit.
  */
function openEditDialog(planId) {
  // Ok we double check the planId becoz the user may throw tantrums
  const plans = loadPlans();
  const plan = plans.find((item) => item.id === planId);
  if (!plan) {
    // Safer this way
    showFeedback(plansFeedback, 'Plan not found.');
    return;
  }

  // Update the global variable
  editingPlanId = planId;
  editNote.value = plan.note || '';
  editDate.value = plan.plannedDate || '';

  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal
  // if you're interested
  editDialog.showModal();
}

/**
  * Deletes a plan from localStorage after confirmation (DELETE operation).
  * planId: The id of the targeted plan.
  */
function deletePlan(planId) {
  const confirmed = confirm('Delete this plan? This cannot be undone.');
  if (!confirmed) {
    // The user clicked on Cancel
    return;
  }

  const plans = loadPlans();
  const filtered = plans.filter((plan) => plan.id !== planId);
  savePlans(filtered);
  renderAllPlans();
  showFeedback(plansFeedback, 'Plan deleted successfully.', true);
}

/**
  * Handles clicks on Edit or Delete buttons through the click event.
  * event: The click event done by the user.
  */
function handlePlansClick(event) {
  const target = event.target;
  if (!target.dataset.action) {
    // No action is selected yet
    return;
  }

  const planId = target.dataset.planId;
  if (target.dataset.action === 'edit') {
    // This basically means the edit button is clicked
    openEditDialog(planId);
  } else if (target.dataset.action === 'delete') {
    // This basically means the delete button is clicked *munch munch*
    deletePlan(planId);
  }
}

/**
  * Handles the edit form submission (UPDATE operation).
  * event: The submit event.
  */
function handleEditSubmit(event) {
  // https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
  // I don't want the browser to execute its own default built-in action
  event.preventDefault();

  const newNote = editNote.value.trim();
  const newDate = editDate.value;

  if (newNote.length > 120) {
    // I look around and Google says the recommended limit is 120+ characters
    showFeedback(plansFeedback, 'Note must be 120 characters or fewer.');
    return;
  }

  const plans = loadPlans();
  const planIndex = plans.findIndex((item) => item.id === editingPlanId);
  if (planIndex === -1) {
    // If planIndex is -1 that just means the searched item does not exist
    editDialog.close();
  }

  plans[planIndex].note = newNote;
  plans[planIndex].plannedDate = newDate;
  savePlans(plans);

  editDialog.close();
  editingPlanId = null;
  renderAllPlans();
  showFeedback(plansFeedback, 'Plan updated successfully.', true);
}

plansDisplay.addEventListener('click', handlePlansClick);
editForm.addEventListener('submit', handleEditSubmit);
editCancel.addEventListener('click', () => {
  editDialog.close();
  editingPlanId = null;
});

// The first render when the page loads
renderAllPlans();
