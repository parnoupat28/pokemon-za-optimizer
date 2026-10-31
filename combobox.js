// Editable listbox: filtering is a draft; only choosing a result changes the battle.
export function createPokemonCombobox({root, input, toggle, list, status, options, initialId, onSelect}) {
 const label = p => p.name + (p.form ? ' · ' + p.form : '');
 const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
 const byId = new Map(options.map(p => [p.id, p]));
 let selected = byId.get(initialId) || null, matches = [], active = -1;
 input.disabled = toggle.disabled = false;
 input.value = selected ? label(selected) : '';
 function highlight(index, scroll=false) {
  active = index;
  [...list.querySelectorAll('[role=option]')].forEach((row,i) => row.setAttribute('aria-selected', String(i === index)));
  const row = list.children[index];
  if(row) {
   input.setAttribute('aria-activedescendant', row.id);
   if(scroll)row.scrollIntoView({block:'nearest'});
  } else input.removeAttribute('aria-activedescendant');
 }
 function open(query='') {
  matches = options.filter(p => fold(label(p)).includes(fold(query)));
  list.replaceChildren();
  const fragment = document.createDocumentFragment();
  for(const p of matches) {
   const row = document.createElement('div');
   row.id = `${input.id}-option-${p.id}`;
   row.setAttribute('role','option');
   row.dataset.value = p.id;
   row.textContent = label(p);
   fragment.append(row);
  }
  list.append(fragment);
  if(!matches.length) {
   const empty = document.createElement('div');
   empty.className = 'combobox-empty'; empty.textContent = 'No Pokémon found. Try another name or form.';
   list.append(empty);
  }
  list.hidden = false;
  input.setAttribute('aria-expanded','true');
  toggle.setAttribute('aria-expanded','true');
  status.textContent = matches.length ? `${matches.length} Pokémon found. Choose a result to change the selection.` : 'No Pokémon found.';
  highlight(-1);
 }
 function close() {
  list.hidden = true;
  input.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');
  input.value = selected ? label(selected) : '';
  status.textContent = selected ? `${label(selected)} selected.` : 'Choose a Pokémon.';
 }
 function choose(p) {
  const changed = selected?.id !== p.id;
  selected = p;
  input.dataset.value = p.id;
  close();
  // Re-selecting the same Pokémon should preserve edited battle stats.
  if(changed)onSelect(p);
 }
 input.dataset.value = selected?.id || '';
 input.addEventListener('focus', () => {input.select();open();});
 input.addEventListener('input', () => open(input.value));
 toggle.addEventListener('mousedown', e => e.preventDefault());
 toggle.addEventListener('click', () => {
  const wasOpen = !list.hidden;
  input.focus({preventScroll:true});
  if(wasOpen)close(); else open();
 });
 input.addEventListener('keydown', e => {
  if(e.isComposing)return;
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp') {
   e.preventDefault();
   if(list.hidden)open();
   if(matches.length)highlight(e.key === 'ArrowDown' ? (active+1)%matches.length : (active<0?matches.length-1:(active-1+matches.length)%matches.length),true);
  } else if(e.key === 'Enter' && !list.hidden) {
   e.preventDefault();
   if(active>=0 && matches[active])choose(matches[active]);
   else {
    const exact = matches.find(p => fold(label(p))===fold(input.value));
    if(exact)choose(exact);else if(matches.length===1)choose(matches[0]);
   }
  } else if(e.key === 'Escape') {e.preventDefault();close();}
  else if(e.key === 'Tab')close();
 });
 list.addEventListener('mousedown', e => {if(e.target.closest('[data-value]'))e.preventDefault();});
 list.addEventListener('click', e => {
  const row = e.target.closest('[data-value]');
  if(row && byId.has(row.dataset.value))choose(byId.get(row.dataset.value));
 });
 root.addEventListener('focusout', () => queueMicrotask(() => {if(!root.contains(document.activeElement))close();}));
 document.addEventListener('pointerdown', e => {if(!root.contains(e.target))close();});
 close();
 onSelect(selected);
}
