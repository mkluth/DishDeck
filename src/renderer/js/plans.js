import {
  clearFeedback,
  showFeedback,
  loadPlans,
  savePlans,
  extractIngredients,
  scaleMeasurement,
  buildCookingInstructionsElement
} from '../../shared/utils.js';

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
  * This will displays the full recipe details plus user's note and planned
  * date.
  * plan: The stored plan object.
  */
function renderPlanCard(plan) {
  const meal = plan.meal;
  const card = document.createElement('article');
  card.className = 'plan-card';
  card.dataset.planId = meal.idMeal;

  const title = document.createElement('h3');
  title.className = 'plan-card__title';
  title.textContent = meal.strMeal;

  const image = document.createElement('img');
  image.className = 'plan-card__image';
  image.src = meal.strMealThumb;
  image.alt = meal.strMeal;

  const meta = document.createElement('p');
  meta.className = 'plan-card__meta';
  if (meal.strArea && meal.strArea.trim() !== '') {
    meta.textContent = `${meal.strCategory} | ${meal.strArea}`;
  } else {
    meta.textContent = meal.strCategory;
  }

  const userNote = document.createElement('p');
  userNote.className = 'plan-card__note';
  if (plan.note) {
    userNote.textContent = `Note: ${plan.note}`;
  } else {
    userNote.textContent = 'No written note yet.';
  }

  const userDate = document.createElement('p');
  userDate.className = 'plan-card__date';
  if (plan.plannedDate) {
    userDate.textContent = `Planned for: ${plan.plannedDate}`;
  } else {
    userDate.textContent = 'No date set.';
  }

  // The following is for the serving calculation feature
  const servingsLabel = document.createElement('label');
  servingsLabel.className = 'form-label';
  servingsLabel.textContent = 'Number of Servings (4 by default):';

  const servingsInput = document.createElement('input');
  servingsInput.type = 'number';
  servingsInput.min = '1';
  servingsInput.value = '4';
  servingsInput.className = 'form-input recipe-card__servings';
  servingsLabel.appendChild(servingsInput);

  const ingredientList = document.createElement('ul');
  ingredientList.className = 'recipe-card__ingredients';

  // The renderIngredients below is an anonymous function ok?
  const renderIngredients = (factor) => {
    ingredientList.textContent = '';
    const ingredients = extractIngredients(meal);
    ingredients.forEach((ingredient) => {
      const li = document.createElement('li');
      li.textContent =
          `${scaleMeasurement(ingredient.ingredientMeasurement, factor)} ` +
          `${ingredient.ingredientName}`
      ingredientList.appendChild(li);
    });
  }

  // Initial render for base servings is 1
  renderIngredients(1);

  servingsInput.addEventListener('input', () => {
    const servings = parseInt(servingsInput.value, 10);
    if (isNaN(servings) || servings < 1) {
      showFeedback(plansFeedback, 'Please enter a valid serving number.');
      return;
    }

    clearFeedback(plansFeedback);
    // Fun fact, by default the API measurements are based on 4 servings
    // So yeah...
    const factor = servings / 4;
    renderIngredients(factor);
  });

  const cookingInstructions = buildCookingInstructionsElement(
      meal.strInstructions
  );

  // Actions buttons (Edit/Delete)
  const actions = document.createElement('div');
  actions.className = 'plan-card__actions';

  const editButton = document.createElement('button');
  editButton.className = 'btn btn--secondary';
  editButton.textContent = 'Edit';
  editButton.dataset.action = 'edit';
  editButton.dataset.planId = meal.idMeal;

  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn btn--danger';
  deleteButton.textContent = 'Delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.planId = meal.idMeal;

  actions.append(editButton, deleteButton);
  card.append(
      title,
      image,
      meta,
      userNote,
      userDate,
      servingsLabel,
      ingredientList,
      cookingInstructions,
      actions
  );

  plansDisplay.appendChild(card);
}

/**
  * Renders all stored plans from the localStorage into the plans display area.
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

  plans.forEach((plan) => renderPlanCard(plan));
}

/**
  * Open the edit dialog and pre-fills it with the plan's current values.
  * planId: The id of the plan to edit.
  */
function openEditDialog(planId) {
  const plans = loadPlans();
  const plan = plans.find((item) => item.meal.idMeal === planId);
  if (!plan) {
    showFeedback(plansFeedback, 'Plan not found.');
    return;
  }

  editingPlanId = planId;
  editNote.value = plan.note || '';
  editDate.value = plan.plannedDate || '';
  editDialog.showModal();
}

/**
  * Deletes a plan from localStorage after confirmation (DELETE operation).
  * planId: The id of the targeted plan.
  */
function deletePlan(planId) {
  const confirmed = confirm('Delete this plan? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  const plans = loadPlans();
  const filtered = plans.filter((plan) => plan.meal.idMeal !== planId);
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
  const planIndex = plans.findIndex(
      (item) => item.meal.idMeal === editingPlanId
  );

  if (planIndex === -1) {
    // If planIndex is -1 that just means the searched item does not exist
    editDialog.close();
    showFeedback(plansFeedback, 'Plan could not be updated.');
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
