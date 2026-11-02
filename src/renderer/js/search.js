import {
  LOCAL_STORAGE_KEY,
  clearFeedback,
  showFeedback,
  loadPlans,
  savePlans
} from './utils.js';

const API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchFeedback = document.getElementById('search-feedback');
const categorySelect = document.getElementById('category-select');
const suggestionFeedback = document.getElementById('suggestion-feedback');
const recipeDisplay = document.getElementById('recipe-display');

/**
  * Fetches recipes from TheMealDB using the given keyword.
  * keyword: The dish name to search for.
  * Return: An array of meals.
  */
function fetchRecipes(keyword) {
  const url = `${API_BASE_URL}/search.php?s=${encodeURIComponent(keyword)}`;
  return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API request failed with ${response.status}`);
        } else {
          return response.json();
        }
      })
      .then((data) => {
        // If there is no result found, the API shall returns {"meals": null}.
        return data.meals || [];
      });
}

/**
  * Fetches full meal details for a given category.
  * STEP 1: filter.php?c=<category> endpoint returns lightweight meal summaries.
  * STEP 2: lookup.php?i=<id> endpoint returns details for each meal.
  * category: The category name (e.g., "Seafood").
  * Return: Full meal objects.
  */
function fetchRecipesByCategory(category) {
  const url = `${API_BASE_URL}/filter.php?c=${encodeURIComponent(category)}`;
  return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API request failed with ${response.status}`);
        } else {
          return response.json();
        }
      })
      .then((data) => {
        const summaries = data.meals || [];
        if (summaries.length === 0) {
          // This basically means there is no data found at all
          return [];
        }

        // Fetch full meal details for every meal ID parallely
        const detailPromises = summaries.map((summary) => {
          const lookupUrl = `${API_BASE_URL}/lookup.php?i=${summary.idMeal}`;
          return fetch(lookupUrl)
              .then((result) => result.json())
              .then((detail) => (detail.meals ? detail.meals[0] : null));
        });

        return Promise.all(detailPromises).then((meals) => {
            // Any null entries from the lookups must be removed
            return meals.filter((meal) => meal !== null);
        });
      });
}

/**
  * Saves a recipe as a plan inside the localStorage (CREATE operation).
  * Duplicates is prevented by idMeal checking.
  * meal: The meal object returned from the API.
  */
function savePlan(meal) {
  const plans = loadPlans();
  const exists = plans.some((plan) => plan.id === meal.idMeal);
  if (exists) {
    // The recipe is already saved inside the localStorage
    showFeedback(searchFeedback, 'This recipe is already in your plans.');
    return;
  }

  const newPlan = {
    id: meal.idMeal,
    strMeal: meal.strMeal,
    strMealThumb: meal.strMealThumb,
    note: '',
    plannedDate: ''
  };

  plans.push(newPlan);
  savePlans(plans);
  showFeedback(searchFeedback, `"${meal.strMeal}" added to your plans.`, true);
}

/**
  * Extracts a clean ingredient list from TheMealDB JSON.
  * The API returns up to 20 ingredients and its measure in separate
  * fields.
  * meal: The meal object returned by the API.
  * Return: An array of extracted ingredients and measurement.
  */
function extractIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredientName = meal[`strIngredient${i}`];
    const ingredientMeasurement = meal[`strMeasure${i}`];

    // Skip null entries
    if (ingredientName && ingredientName.trim() !== '') {
      ingredients.push({
        ingredientName: ingredientName.trim(),
        ingredientMeasurement: (ingredientMeasurement || '').trim(),
      });
    }
  }

  return ingredients;
}

/**
  * Parses the leading numeric value from a measurement string.
  * Example: 200g -> 200, 1 1/2 cups -> 1.5, to taste -> null.
  * Yes, the measurement string returned by the API exactly like above.
  * ingredientMeasurement: The ingredient measurement string.
  * Return: The parsed number or null if it is not parseable.
  */
function parseMeasurementNumber(ingredientMeasurement) {
  if (!ingredientMeasurement)
    return null;

  // Handles fractions like 1 1/2
  const fractionMatch = ingredientMeasurement.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1], 10) +
        parseInt(fractionMatch[2], 10) / parseInt(fractionMatch[3], 10);
  }

  const match = ingredientMeasurement.match(/^(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
  * Scales an ingredient measure by a factor, preserving the unit text.
  * ingredientMeasurement: The original measurement (e.g., "200g").
  * factor: The scaling factor (e.g., 0.5 for half scaling).
  * Return: The scaled measurement string.
  */
function scaleMeasurement(ingredientMeasurement, factor) {
  const number = parseMeasurementNumber(ingredientMeasurement);
  if (number === null) {
    // Not parseable, just return as it is
    return ingredientMeasurement;
  }

  const unit = ingredientMeasurement.replace(
    /^(\d+\s+\d+\/\d+|\d+(\.\d+)?)/,
    ''
  ).trim();
  const scaled = number * factor;

  // Format to 2 decimal places, we don't want those stupid trailing zeros
  const formatted = parseFloat(scaled.toFixed(2));
  return unit ? `${formatted} ${unit}` : `${formatted}`;
}

/**
  * Builds a DOM element that will displays the recipe instructions.
  * The API returns instructions as a single big chunk of string with \r\n line
  * breaks (the Windows CRLF). As most recipes are step by step, we render it as
  * an <ol> (ordered list) if there are multiple lines, otherwise we simply
  * render it as a <p> (paragraph) instead.
  * instructions: The raw strInstructions string returned from the API.
  * Return: A DOM element ready to be append.
  */
function buildCookingInstructionsElement(instructions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'recipe-card__instructions';

  const heading = document.createElement('h4');
  heading.className = 'recipe-card__instructions-title';
  heading.textContent = 'Instructions';
  wrapper.appendChild(heading);

  if (!instructions || instructions.trim() === '') {
    // This one recipe an anomaly because the API have no instructions for it
    const empty = document.createElement('p');
    empty.textContent = 'No instructions found unfortunately T-T';
    wrapper.appendChild(empty);
    return wrapper;
  }

  // Just so you know, the recipes' instruction line endings are nightmares to
  // handle. But anyway, I need to split them up into different individual
  // lines and I need to be really careful, because I found out that the API
  // uses \r\n (Windows CRLF) for newlines. Let's replace it to Unix line ending
  // first (the \n character) before split them up into individual lines.
  // Elite ball knowledge huh? :D
  const lines = instructions
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

  if (lines.length === 0) {
    // Another anomaly, the string is not empty but every line is just
    // whitespaces.
    const empty = document.createElement('p');
    empty.textContent = 'No instructions found unfortunately T-T';
    wrapper.appendChild(empty);
    return wrapper;
  }

  if (lines.length > 1) {
    // Alright, we have multiple lines here and they're all ordered...
    const list = document.createElement('ol');
    list.className = 'recipe-card__steps';
    lines.forEach((line) => {
      // We wrap each line inside <li></li> tags
      const item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    });

    wrapper.appendChild(list);
  } else {
    // Right, another anomaly. A single paragraph instruction only...
    const paragraph = document.createElement('p');
    paragraph.textContent = lines[0];
    wrapper.appendChild(paragraph);
  }

  return wrapper;
}

/**
  * Renders a single recipe card into the specified container.
  * meal: The meal object returned by the API.
  * container: The parent element for the recipe card to be injected into.
  */
function renderRecipeCard(meal, container) {
  const card = document.createElement('article');
  card.className = 'recipe-card';
  card.dataset.mealId = meal.idMeal;

  const title = document.createElement('h3');
  title.className = 'recipe-card__title';
  title.textContent = meal.strMeal;

  const image = document.createElement('img');
  image.className = 'recipe-card__image';
  image.src = meal.strMealThumb;
  image.alt = meal.strMeal;

  const meta = document.createElement('p');
  meta.className = 'recipe-card__meta';

  // meal.strArea field may be null, thus a checking is needed
  if (meal.strArea && meal.strArea.trim() !== '') {
    meta.textContent = `${meal.strCategory} | ${meal.strArea}`;
  } else {
    meta.textContent = `${meal.strCategory}`;
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
      showFeedback(searchFeedback, 'Please enter a valid serving number.');
      return;
    }

    clearFeedback(searchFeedback);
    // Fun fact, by default the API measurements are based on 4 servings
    // So yeah...
    const factor = servings / 4;
    renderIngredients(factor);
  });

  const cookingInstructions = buildCookingInstructionsElement(
      meal.strInstructions
  );

  // Save as plan button
  const saveButton = document.createElement('button');
  saveButton.className = 'btn btn--primary';
  saveButton.textContent = 'Save to Plan';
  saveButton.addEventListener('click', () => {
    savePlan(meal);
  });

  card.append(
      title,
      image,
      meta,
      servingsLabel,
      ingredientList,
      cookingInstructions,
      saveButton
  );

  container.appendChild(card);
}

/**
  * Displays an array of meals in the recipe display area.
  * meals: The array of meals to display.
  */
function displayRecipes(meals) {
  recipeDisplay.textContent = '';
  if (meals.length === 0) {
    showFeedback(searchFeedback, 'No recipes found. Try another keyword.');
    return;
  }

  clearFeedback(searchFeedback);
  meals.forEach((meal) => renderRecipeCard(meal, recipeDisplay));
}

/**
  * Handles the search bar submission.
  * event: The submit event.
  */
function handleSearchSubmit(event) {
  event.preventDefault();
  const keyword = searchInput.value.trim();
  if (keyword === '') {
    showFeedback(searchFeedback, 'Please enter a dish name.');
    return;
  }

  clearFeedback(searchFeedback);
  showFeedback(searchFeedback, 'Searching...', true);
  fetchRecipes(keyword)
      .then((meals) => {
        displayRecipes(meals);
      })
      .catch((error) => {
        showFeedback(
            searchFeedback,
            `Error: ${error.message}. Please try again.`
        );
        recipeDisplay.textContent = '';
      });
}

/**
  * Provides suggestion logic based on the selected category.
  * category: The selected category value.
  */
function handleCategorySuggestion(category) {
  clearFeedback(suggestionFeedback);
  if (category === '') {
    return;
  }

  let suggestion = '';
  if (category === 'Beef') {
    suggestion = 'Beef is rich in iron. Try a slow-cooked stew for tenderness!';
  } else if (category === 'Chicken') {
    suggestion = 'Chicken pairs well with rice. Try a one-pot chicken rice!';
  } else if (category === 'Dessert') {
    suggestion = 'Desserts are best kept under 30 minutes. Try a no-bake ' +
        'option!';
  } else if (category === 'Lamb') {
    suggestion = 'Lamb works well with herbs. Try a rosemary lamb roast!';
  } else if (category === 'Miscellaneous') {
    suggestion = 'This is a mixed category. Try a surprise recipe search!';
  } else if (category === 'Pasta') {
    suggestion = 'Pasta loves garlic and olive oil. Try a simple aglio e olio!';
  } else if (category === 'Seafood') {
    suggestion = 'Seafood is rich in omega-3. Try a light grilled fish recipe!';
  } else if (category === 'Side') {
    suggestion = 'Sides balance a meal. Try a fresh garden salad today!';
  } else if (category === 'Starter') {
    suggestion = 'Starters set the tone. Try a warm soup or bruschetta!';
  } else if (category === 'Vegan') {
    suggestion = 'Vegan meals thrive on legumes. Try a chickpea curry!';
  } else if (category === 'Vegetarian') {
    suggestion = 'Vegetarian meals work well with lentils. Try a lentil curry!';
  } else if (category === 'Breakfast') {
    suggestion = 'Breakfast fuels your day. Try oats with fresh fruit!';
  } else if (category === 'Goat') {
    suggestion = 'Goat meat is lean. Try a slow-cooked goat curry!';
  } else {
    suggestion = 'No suggestion available for this category.';
  }

  showFeedback(suggestionFeedback, suggestion, true);
  searchInput.value = category;
  fetchRecipesByCategory(category)
      .then((meals) => {
        displayRecipes(meals);
      })
      .catch((error) => {
        showFeedback(
            searchFeedback,
            `Error: ${error.message}. Please try again.`
        );
      });
}

// Event listeners to handle all of these DOMs and events
searchForm.addEventListener('submit', handleSearchSubmit);
categorySelect.addEventListener('change', (event) => {
  handleCategorySuggestion(event.target.value);
});
