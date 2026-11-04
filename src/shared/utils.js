/**
  * The localStorage key used for saving meal plans.
  * I intentionally exported this so that both search.js and plans.js uses the
  * same read/write key. Munch munch.
  */
export const LOCAL_STORAGE_KEY = 'easyCookPlans';

/**
  * Clears any feedback messages in the given element.
  * Feedback is used as a way to tell the user if an operation successful or
  * not.
  * element: The feedback element to clear.
  */
export function clearFeedback(element) {
  element.textContent = '';
  // Remove feedback--success CSS styling
  element.classList.remove('feedback--success');
}

/**
  * Displays a feedback message with an optional success style.
  * element: The feedback element to update.
  * message: The message to show.
  * isSuccess: Flag to indicate whether the message symbolizes a success. Setted
  * to false by default.
  */
export function showFeedback(element, message, isSuccess = false) {
  element.textContent = message;
  if (isSuccess) {
    // Add feedback--success CSS styling
    element.classList.add('feedback--success');
  } else {
    // Remove feedback--success CSS styling
    element.classList.remove('feedback--success');
  }
}

/**
  * Reads the plans array stored inside the localStorage (READ operation).
  * Returns an empty array if nothing is stored or the JSON is corrupted.
  * Return: The stored plans.
  */
export function loadPlans() {
  const rawLocalData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!rawLocalData) {
    // The localStorage is empty so just return a empty list
    // Nyam Nyam
    return [];
  }

  try {
    const parsed = JSON.parse(rawLocalData);
    if (Array.isArray(parsed)) {
      return parsed;
    } else {
      return [];
    }
  } catch (error) {
    // Hohoho the JSON is corrupted!
    return [];
  }
}

/**
  * Writes the plans array to localStorage as a JSON (WRITE operation).
  * plans: The plans array to save.
  */
export function savePlans(plans) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plans));
}

/**
  * Extracts a clean ingredient list from TheMealDB JSON.
  * The API returns up to 20 ingredients and its measure in separate
  * fields.
  * meal: The meal object returned by the API.
  * Return: An array of extracted ingredients and measurement.
  */
export function extractIngredients(meal) {
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
export function parseMeasurementNumber(ingredientMeasurement) {
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
export function scaleMeasurement(ingredientMeasurement, factor) {
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
  * Return: A DOM element ready to be appended.
  */
export function buildCookingInstructionsElement(instructions) {
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
