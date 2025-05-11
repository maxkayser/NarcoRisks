/*!
 * NarcoRisks.js 
 * Interactive Risk Disclosure for Anesthesia Procedures
 * 
 * Author: Max Kayser
 * GitHub: https://github.com/maxkayser/NarcoRisks
 * Version: 1.0
 */

const risksUrl = 'https://raw.githubusercontent.com/maxkayser/NarkoSafe/main/data/risks.json';

let allRisks = [];

/**
 * Copies the generated summary text to the clipboard.
 */
function copyToClipboard() {
  const summary = document.getElementById("summaryText");
  summary.select();
  summary.setSelectionRange(0, 99999);
  document.execCommand("copy");
  alert("Text copied to clipboard.");
}

/**
 * Loads risk data from the external JSON file.
 * Parses and renders categories, subgroups, and checkboxes dynamically.
 */
async function loadRisks() {
  try {
    const response = await fetch(risksUrl);
    const data = await response.json();

    currentLang = document.getElementById('language').value || "de";
    translations = data.translations || {};
    applyTranslations(currentLang);
    
    textblocks = data.textblocks || {};
    console.log('[loadRisks] Loaded textblocks:', textblocks);

    renderTextblockToggles();
    renderStaticTextblockCheckboxes();

    const rawRoot = data.risks.children[0];
    allRisks = Object.entries(rawRoot)
      .filter(([k, v]) => typeof v === 'object' && v.label)
      .map(([key, value]) => ({
        key,
        label: value.label,
        entries: [
          ...Object.entries(value).filter(([k]) => k === 'common'),
          ...Object.entries(value).filter(([k]) => k !== 'label' && k !== 'common')
        ]
      }));

    const defaults = data.defaults || {};
    renderRiskGroups(defaults);
    
    if (data.procedures) {
      renderProcedureSelectors(data.procedures);
    }

    if (data.presets) {
      renderPresetOptionSelectors(data.presets);
    }

  } catch (error) {
    document.getElementById('risksOutput').innerText = 'Error loading risk data.';
    console.error(error);
  }
}

/**
 * Ensures all "common" checkboxes in a group are checked if not already.
 */
function activateCommonItems(groupKey, entriesContainer) {
  const commonItems = entriesContainer.querySelectorAll(`input[value^="${groupKey}.common."]`);
  const anyChecked = Array.from(commonItems).some(cb => cb.checked);
  if (!anyChecked) {
    commonItems.forEach(cb => cb.checked = true);
  }

  const commonGroupCheckbox = entriesContainer.querySelector(`input[type="checkbox"][value="${groupKey}.common"]`);
  if (commonGroupCheckbox && !commonGroupCheckbox.checked) {
    commonGroupCheckbox.checked = true;
  }
}

/**
 * Deactivates "common" checkboxes if no specific risks in the group are checked.
 */
function deactivateCommonIfUnused(groupKey, entriesContainer) {
  const nonCommon = entriesContainer.querySelectorAll(`input[value^="${groupKey}."]:not([value^="${groupKey}.common"])`);
  const anyChecked = Array.from(nonCommon).some(cb => cb.checked);
  if (!anyChecked) {
    const commonBox = entriesContainer.querySelector(`input[type="checkbox"][value="${groupKey}.common"]`);
    if (commonBox) commonBox.checked = false;
    const commonItems = entriesContainer.querySelectorAll(`input[value^="${groupKey}.common."]`);
    commonItems.forEach(cb => cb.checked = false);
  }
}

/**
 * Renders all risk groups, subgroups, and leaf checkboxes dynamically from loaded JSON.
 */
function renderRiskGroups(defaults = {}) {
  const lang = document.getElementById('language').value || 'de';
  const output = document.getElementById('risksOutput');
  output.innerHTML = '';

  for (const group of allRisks) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'category toggle';
    groupDiv.textContent = group.label?.[lang] || group.key;
    output.appendChild(groupDiv);

    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'subcategory checkbox-grid';
    entriesContainer.classList.add('hidden');
    output.appendChild(entriesContainer);

    if (allRisks.indexOf(group) === 0) {
      entriesContainer.classList.remove('hidden');
      groupDiv.classList.add('expanded');
    }

    groupDiv.addEventListener('click', () => {
      entriesContainer.classList.toggle('hidden');
      groupDiv.classList.toggle('expanded');
    });

    for (const [subKey, subValue] of group.entries) {
      const sublabel = subValue.label?.[lang] || subKey;

      if (typeof subValue === 'object' && subValue.label && Object.values(subValue).some(val => val.label)) {
        // Subgroup with nested risks
        const subgroupWrapper = document.createElement('div');
        subgroupWrapper.className = 'subcategory';

        const subgroupHeader = document.createElement('div');
        subgroupHeader.className = 'subgroup-toggle';

        const subgroupCheckbox = document.createElement('input');
        subgroupCheckbox.type = 'checkbox';
        subgroupCheckbox.value = `${group.key}.${subKey}`;
        subgroupCheckbox.style.marginRight = '0.5rem';

        subgroupCheckbox.addEventListener('change', () => {
          const checked = subgroupCheckbox.checked;
          const subInputs = subgroupContainer.querySelectorAll('input[type=checkbox]');
          subInputs.forEach(cb => cb.checked = checked);
          checked && subKey !== 'common'
            ? activateCommonItems(group.key, entriesContainer)
            : deactivateCommonIfUnused(group.key, entriesContainer);
          generateSummary();
        });

        subgroupHeader.appendChild(subgroupCheckbox);
        subgroupHeader.appendChild(document.createTextNode(sublabel));

        const subgroupContainer = document.createElement('div');
        subgroupContainer.className = 'checkbox-grid hidden';

        subgroupHeader.addEventListener('click', (e) => {
          if (e.target.tagName.toLowerCase() !== 'input') {
            const allSubgroups = document.querySelectorAll('.subgroup-toggle + .checkbox-grid');
            const allHeaders = document.querySelectorAll('.subgroup-toggle');

            const isOpen = !subgroupContainer.classList.contains('hidden');
            allSubgroups.forEach(sg => sg.classList.add('hidden'));
            allHeaders.forEach(h => h.classList.remove('expanded'));

            if (!isOpen) {
              subgroupContainer.classList.remove('hidden');
              subgroupHeader.classList.add('expanded');
            }
          }
        });

        // Leaf checkboxes
        for (const [leafKey, leafValue] of Object.entries(subValue)) {
          if (leafKey === 'label') continue;
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'riskSubgroups';
          checkbox.value = `${group.key}.${subKey}.${leafKey}`;
          const pathLeaf = `risks.${group.key}.${subKey}.${leafKey}`;
          const groupPath = `risks.${group.key}`;
          if (defaults[pathLeaf] || defaults[groupPath]) {
            checkbox.checked = true;
            if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
          }
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + (leafValue.label?.[lang] || leafKey)));
          subgroupContainer.appendChild(label);
        }

        const pathSub = `risks.${group.key}.${subKey}`;
        if (defaults[pathSub]) {
          subgroupCheckbox.checked = true;
          const leafCheckboxes = subgroupContainer.querySelectorAll('input[type=checkbox]');
          leafCheckboxes.forEach(cb => cb.checked = true);
          if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
        }

        subgroupWrapper.appendChild(subgroupHeader);
        subgroupWrapper.appendChild(subgroupContainer);
        entriesContainer.appendChild(subgroupWrapper);

      } else {
        // Flat risks
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'riskSubgroups';
        checkbox.value = `${group.key}.${subKey}`;
        const path = `risks.${group.key}.${subKey}`;
        const groupPath = `risks.${group.key}`;
        if (defaults[path] || defaults[groupPath]) {
          checkbox.checked = true;
          if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
        }
        checkbox.addEventListener('change', (e) => {
          e.target.checked && subKey !== 'common'
            ? activateCommonItems(group.key, entriesContainer)
            : deactivateCommonIfUnused(group.key, entriesContainer);
          generateSummary();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + sublabel));
        entriesContainer.appendChild(label);
      }
    }
  }

  generateSummary();
}

function renderProcedureSelectors(procedures) {
  const lang = currentLang;
  const deptSelect = document.getElementById("departmentSelect");
  const procSelect = document.getElementById("procedureSelect");

  // Reset
  deptSelect.innerHTML = '<option value="">– bitte wählen –</option>';
  procSelect.innerHTML = '<option value="">– bitte wählen –</option>';
  procSelect.disabled = true;

  // Fachbereiche befüllen
  Object.entries(procedures).forEach(([deptKey, deptVal]) => {
    const opt = document.createElement("option");
    opt.value = deptKey;
    opt.textContent = deptVal.label?.[lang] || deptVal.label?.["en"] || deptKey;
    deptSelect.appendChild(opt);
  });

  deptSelect.addEventListener("change", () => {
    const selectedDept = procedures[deptSelect.value];
    procSelect.innerHTML = '<option value="">– bitte wählen –</option>';
    procSelect.disabled = !selectedDept;

    if (selectedDept) {
      Object.entries(selectedDept).forEach(([procKey, procVal]) => {
        if (procKey === "label") return;
        const opt = document.createElement("option");
        opt.value = `${deptSelect.value}.${procKey}`;
        opt.textContent = procVal.label?.[lang] || procVal.label?.["en"] || procKey;
        procSelect.appendChild(opt);
      });
    }
  });

  procSelect.addEventListener("change", () => {
    // Zurücksetzen
    //resetInputs();
    

    const [deptKey, procKey] = procSelect.value.split(".");
    const selected = procedures?.[deptKey]?.[procKey];
    if (!selected || !selected.risks) return;

    // Risiken aktivieren
    selected.risks.forEach(path => {
      const checkbox = document.querySelector(`input[value="${path}"]`);
      if (checkbox) checkbox.checked = true;
    });

    generateSummary();
  });
}

function renderPresetOptionSelectors(presets = {}) {
  const lang = document.getElementById('language').value || 'de';
  const container = document.getElementById("presetOptionsContainer"); 
  container.innerHTML = '';

  Object.entries(presets).forEach(([key, config]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preset-group';

    const label = document.createElement('label');
    label.textContent = config.label?.[lang] || key;
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.id = `preset_${key}`;
    select.innerHTML = `<option value="">–</option>`;

    Object.entries(config.options).forEach(([optKey, optVal]) => {
      const option = document.createElement('option');
      option.value = optKey;
      option.textContent = optVal.label?.[lang] || optKey;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      // Zuvor aktivierte Risiken deaktivieren
      document.querySelectorAll('input[name="riskSubgroups"]').forEach(cb => {
        const path = cb.value;
        const allRisksPaths = Object.values(presets).flatMap(p =>
          Object.values(p.options).flatMap(o => o.associated_risks || [])
        );
        if (allRisksPaths.includes(path)) {
          cb.checked = false;
        }
      });

      // Neue aktivieren
      const selectedValue = select.value;
      const selectedOption = config.options[selectedValue];
      if (selectedOption?.associated_risks) {
        selectedOption.associated_risks.forEach(path => {
          const cb = document.querySelector(`input[value="${path}"]`);
          if (cb) cb.checked = true;
        });
      }

      generateSummary();
    });

    wrapper.appendChild(select);
    container.appendChild(wrapper);
  });
}


/**
 * Generates the risk summary output in structured form.
 */
function generateSummary() {
  const lang = document.getElementById('language').value || 'de';
  const selectedKeys = Array.from(document.querySelectorAll('input[name="riskSubgroups"]:checked')).map(el => el.value);
  const grouped = {};

  for (const path of selectedKeys) {
    const keys = path.split('.');
    const group = allRisks.find(g => g.key === keys[0]);
    if (!group) continue;
    const groupLabel = group.label?.[lang] || keys[0];
    let subgroupLabel = '';
    let riskLabel = '';

    if (keys.length === 2) {
      const entry = group.entries.find(([k]) => k === keys[1]);
      subgroupLabel = entry?.[1]?.label?.[lang] || keys[1];
      riskLabel = subgroupLabel;
    } else if (keys.length === 3) {
      const entry = group.entries.find(([k]) => k === keys[1]);
      subgroupLabel = entry?.[1]?.label?.[lang] || keys[1];
      const child = entry?.[1]?.[keys[2]];
      riskLabel = child?.label?.[lang] || keys[2];
    }

    grouped[groupLabel] ??= {};
    grouped[groupLabel][subgroupLabel] ??= [];
    grouped[groupLabel][subgroupLabel].push(riskLabel);
  }

  const intro = textblocks?.intro?.[lang] || '';
  const closing = textblocks?.closing?.[lang] || '';
  const additional = document.getElementById('additionalText')?.value || '';
  const selectedTextblocks = Array.from(document.querySelectorAll('input[name="textblock"]:checked')).map(cb => cb.value);

  let result = intro ? intro + '\n\n' : '';

  for (const [groupLabel, subgroups] of Object.entries(grouped)) {
    result += `${groupLabel}\n`;
    for (const [subLabel, risks] of Object.entries(subgroups)) {
      result += `${subLabel}: ${risks.join(', ')}\n`;
    }
    result += '\n';
  }

  for (const key of selectedTextblocks) {
    const text = textblocks?.[key]?.[lang];
    if (text) result += `\n${text}\n`;
  }

  if (additional.trim()) result += `\n${additional}\n`;
  if (closing.trim()) result += `\n${closing}`;

  document.getElementById('summaryText').value = result.trim();
}

/**
 * Renders checkboxes for static textblock insertions (e.g. "online consent").
 */
function renderTextblockToggles() {
  const container = document.getElementById('textblockToggles');
  //const container = document.getElementById('ContextRisksContainer');
  if (!container || !textblocks) return;
  const lang = document.getElementById('language').value || 'de';
  container.innerHTML = '';
  Object.keys(textblocks).forEach(key => {
    if (key === 'intro' || key === 'closing') return;
    const label = textblocks[key]?.label?.[lang] || key;
    const wrapper = document.createElement('label');
    wrapper.style.display = 'block';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'textblock';
    checkbox.value = key;
    checkbox.addEventListener('change', generateSummary);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(' ' + label));
    container.appendChild(wrapper);
  });
}

/**
 * Renders static checkboxes for predefined text blocks (non-dynamic).
 */
function renderStaticTextblockCheckboxes() {
  const lang = document.getElementById('language').value || 'de';
  const container = document.getElementById('staticTextblockCheckboxes');
  container.innerHTML = '';
  const blocks = [];
  blocks.forEach(item => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'block';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'textblock';
    checkbox.value = item.key;
    checkbox.addEventListener('change', generateSummary);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(' ' + (item.label[lang] || item.key)));
    container.appendChild(wrapper);
  });
}

// Event bindings
document.getElementById('language').addEventListener('change', () => {
  currentLang = document.getElementById('language').value;
  applyTranslations(currentLang); // 🟢 WICHTIG: hinzufügen!
  renderRiskGroups();
  renderTextblockToggles();
});

document.getElementById('additionalText').addEventListener('input', generateSummary);

let currentLang = "de";  // Default
let translations = {};   // wird aus data.translations geladen

function getText(path, lang = "de") {
  const parts = path.split(".");
  let node = translations;
  for (const p of parts) {
    if (node && p in node) node = node[p];
    else return "";
  }
  if (typeof node === "string") return node;
  return node[lang] || node["de"] || Object.values(node)[0];
}

function resetInputs() {
  // Alle Checkboxen deaktivieren
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Alle Textareas leeren (außer wenn readonly wie summary)
  document.querySelectorAll('textarea:not([readonly])').forEach(ta => {
    ta.value = '';
  });

  // Alle Selects außer Sprache zurücksetzen
  document.querySelectorAll('select').forEach(select => {
    if (select.id !== 'language') {
      select.selectedIndex = 0;
    }
  });

  // Neurendern der Zusammenfassung
  generateSummary();
}

document.getElementById('resetButton').addEventListener('click', () => {
  resetInputs();
});


function applyTranslations(lang) {
  console.log("[applyTranslations] Lang:", lang);
  console.log("[applyTranslations] Translations:", translations);

  // Textinhalt ersetzen
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const text = getText(key, lang);
    if (text) {
      el.textContent = text;
    } else {
      console.warn(`[i18n] Kein Text gefunden für data-i18n="${key}" und Sprache "${lang}"`);
    }
  });

  // Attribute ersetzen
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    const attrMap = el.getAttribute("data-i18n-attr").split(",");
    attrMap.forEach(pair => {
      const [attr, key] = pair.split(":");
      const text = getText(key, lang);
      if (text) {
        el.setAttribute(attr, text);
      } else {
        console.warn(`[i18n] Kein Attribut-Text gefunden für ${attr}:${key} und Sprache "${lang}"`);
      }
    });
  });
}

window.onload = loadRisks;
