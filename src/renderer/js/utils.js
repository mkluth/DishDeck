/**
  * The localStorage key used for saving meal plans.
  * I intentionally exported this so that both search.js and plans.js uses the
  * same read/write key. Munch munch.
  */
export const LOCAL_STORAGE_KEY = 'dishDeckPlans';

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
