import { svgs } from '../../assets/icons/svg/svg.js';

/**
 * Creates a reusable Custom Dropdown
 * @param {Array} options - Array of objects { value, label }
 * @param {String} selectedValue - Default selected value
 * @param {Function} onChange - Callback (value) => {}
 * @returns {HTMLElement} The dropdown container
 */
export function createCustomSelect(options, selectedValue, onChange) {
  const container = document.createElement('div');
  container.className = 'custom-select-container'; 

  // Find initial label
  const initialOption = options.find(o => o.value === selectedValue) || options[0];
  let currentValue = initialOption.value;

  // Create Trigger (The visible box)
  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.innerHTML = `
    <span class="selected-text">${initialOption.label}</span>
    <span class="arrow-icon" style="opacity: 0.7;">${svgs.arrowDown}</span>
  `;

  //Create Options List (Hidden)
  const optionsList = document.createElement('div');
  optionsList.className = 'custom-select-options';

  // Helper to render options
  function renderOptions() {
    optionsList.innerHTML = '';
    options.forEach(opt => {
      const optEl = document.createElement('div');
      optEl.className = `custom-option ${opt.value === currentValue ? 'selected' : ''}`;
      optEl.textContent = opt.label;
      
      optEl.onclick = (e) => {
        e.stopPropagation(); // Stop click from closing immediately
        currentValue = opt.value;
        trigger.querySelector('.selected-text').textContent = opt.label;
        
        // Update selection styles
        container.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
        optEl.classList.add('selected');

        // Close dropdown
        optionsList.classList.remove('open');
        trigger.classList.remove('active');
        
        // Trigger callback
        if(onChange) onChange(currentValue);
      };
      
      optionsList.appendChild(optEl);
    });
  }

  renderOptions();

  // Toggle Logic
  trigger.onclick = (e) => {
    e.stopPropagation();
    // Close other dropdowns if any
    document.querySelectorAll('.custom-select-options.open').forEach(el => {
      if(el !== optionsList) el.classList.remove('open');
    });

    optionsList.classList.toggle('open');
    trigger.classList.toggle('active');
  };

  // Click Outside to Close
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      optionsList.classList.remove('open');
      trigger.classList.remove('active');
    }
  });

  container.appendChild(trigger);
  container.appendChild(optionsList);

  // Getter method to retrieve value easily later
  container.getValue = () => currentValue;

  return container;
}