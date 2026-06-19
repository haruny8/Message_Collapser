/**
 * Message Collapser — Wand Panel Edition
 * Opens via the ✨ Extensions wand menu as a floating panel.
 * Does NOT appear in the Extensions settings drawer.
 */

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME        = 'Message_Collapser';
const PANEL_ID        = 'mc_floating_panel';
const WAND_BTN_ID     = 'mc_wand_btn';
const CHEVRON_CLASS   = 'mc-chevron';

// ─── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { enabled: true };

function getSettings() {
    extension_settings[EXT_NAME] ??= structuredClone(DEFAULT_SETTINGS);
    return extension_settings[EXT_NAME];
}

// ─── Collapse / Expand core ───────────────────────────────────────────────────

function collapseMessage($mes) {
    $mes.find('.mes_text').addClass('mc-collapsed');
    $mes.find(`.${CHEVRON_CLASS}`).removeClass('fa-chevron-down').addClass('fa-chevron-right');
    $mes.attr('data-mc-collapsed', 'true');
}

function expandMessage($mes) {
    $mes.find('.mes_text').removeClass('mc-collapsed');
    $mes.find(`.${CHEVRON_CLASS}`).removeClass('fa-chevron-right').addClass('fa-chevron-down');
    $mes.removeAttr('data-mc-collapsed');
}

function toggleMessage($mes) {
    if ($mes.attr('data-mc-collapsed') === 'true') {
        expandMessage($mes);
    } else {
        collapseMessage($mes);
    }
}

// Global actions
function collapseAll()    { $('#chat .mes').each((_, el) => collapseMessage($(el))); }
function expandAll()      { $('#chat .mes').each((_, el) => expandMessage($(el))); }
function collapseHidden() { $('#chat .mes[is_system="true"]').each((_, el) => collapseMessage($(el))); }
function expandHidden()   { $('#chat .mes[is_system="true"]').each((_, el) => expandMessage($(el))); }

// ─── Per-message chevron button ───────────────────────────────────────────────

function addChevronToMessage($mes) {
    if ($mes.find(`.${CHEVRON_CLASS}`).length) return; // already added

    const $btn = $(`<i class="fa-solid fa-chevron-down ${CHEVRON_CLASS}" title="Collapse / Expand message"></i>`);
    $btn.on('click', (e) => {
        e.stopPropagation();
        toggleMessage($mes);
    });
    // Prepend into the mes_block so it floats left of the text
    $mes.find('.mes_block').prepend($btn);

    // Restore previous collapsed state if it was set before a re-render
    if ($mes.attr('data-mc-collapsed') === 'true') {
        $mes.find('.mes_text').addClass('mc-collapsed');
        $btn.removeClass('fa-chevron-down').addClass('fa-chevron-right');
    }
}

function removeChevronFromMessage($mes) {
    $mes.find(`.${CHEVRON_CLASS}`).remove();
    expandMessage($mes); // always expand when disabling
}

function addChevronToAll() {
    $('#chat .mes').each((_, el) => addChevronToMessage($(el)));
}

function removeChevronFromAll() {
    $('#chat .mes').each((_, el) => removeChevronFromMessage($(el)));
}

// ─── Observe new messages being added to the chat ────────────────────────────

let _observer = null;

function startObserver() {
    if (_observer) return;
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;

    _observer = new MutationObserver((mutations) => {
        if (!getSettings().enabled) return;
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.classList.contains('mes')) {
                    addChevronToMessage($(node));
                }
            }
        }
    });
    _observer.observe(chatEl, { childList: true });
}

function stopObserver() {
    _observer?.disconnect();
    _observer = null;
}

// ─── Floating panel ───────────────────────────────────────────────────────────

function buildPanel() {
    if ($(`#${PANEL_ID}`).length) return; // already exists

    const html = `
<div id="${PANEL_ID}" class="mc-panel" style="display:none;">
  <div class="mc-panel-header">
    <span><i class="fa-solid fa-compress-alt"></i> Message Collapser</span>
    <button class="mc-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
  </div>
  <div class="mc-panel-body">
    <label class="mc-toggle-row">
      <input type="checkbox" id="mc_enabled_toggle">
      <span>Enable Message Collapser</span>
    </label>
    <hr class="mc-sep">
    <div class="mc-btn-grid">
      <button id="mc_collapse_all"    class="mc-action-btn"><i class="fa-solid fa-angles-up"></i> Collapse All</button>
      <button id="mc_expand_all"      class="mc-action-btn"><i class="fa-solid fa-angles-down"></i> Expand All</button>
      <button id="mc_collapse_hidden" class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye-slash"></i> Collapse Hidden</button>
      <button id="mc_expand_hidden"   class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye"></i> Expand Hidden</button>
    </div>
  </div>
</div>`;

    $('body').append(html);

    const $panel = $(`#${PANEL_ID}`);

    // Sync toggle state
    $('#mc_enabled_toggle').prop('checked', getSettings().enabled);

    // Event wiring
    $('#mc_enabled_toggle').on('change', function () {
        getSettings().enabled = this.checked;
        saveSettingsDebounced();
        if (this.checked) {
            addChevronToAll();
            startObserver();
        } else {
            removeChevronFromAll();
            stopObserver();
        }
    });

    $('#mc_collapse_all').on('click',    () => { if (getSettings().enabled) collapseAll(); });
    $('#mc_expand_all').on('click',      () => { if (getSettings().enabled) expandAll(); });
    $('#mc_collapse_hidden').on('click', () => { if (getSettings().enabled) collapseHidden(); });
    $('#mc_expand_hidden').on('click',   () => { if (getSettings().enabled) expandHidden(); });

    $panel.find('.mc-close-btn').on('click', hidePanel);

    // Drag support
    makeDraggable($panel[0], $panel.find('.mc-panel-header')[0]);
}

function showPanel() {
    buildPanel();
    $(`#${PANEL_ID}`).fadeIn(150);
}

function hidePanel() {
    $(`#${PANEL_ID}`).fadeOut(150);
}

function togglePanel() {
    if ($(`#${PANEL_ID}`).is(':visible')) {
        hidePanel();
    } else {
        showPanel();
    }
}

// ─── Draggable helper ─────────────────────────────────────────────────────────

function makeDraggable(panel, handle) {
    let startX, startY, origLeft, origTop;

    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return; // don't drag on close btn
        e.preventDefault();
        const rect = panel.getBoundingClientRect();
        startX   = e.clientX;
        startY   = e.clientY;
        origLeft = rect.left;
        origTop  = rect.top;

        // Switch to fixed position coordinates
        panel.style.left   = origLeft + 'px';
        panel.style.top    = origTop  + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = 'auto';

        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = (origLeft + dx) + 'px';
        panel.style.top  = (origTop  + dy) + 'px';
    });
}

// ─── Wand menu button ─────────────────────────────────────────────────────────

function addWandButton() {
    if ($(`#${WAND_BTN_ID}`).length) return;

    const $btn = $(`
      <div id="${WAND_BTN_ID}" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Message Collapser">
        <i class="fa-solid fa-compress-alt fa-fw"></i>
        <span>Message Collapser</span>
      </div>
    `);

    $btn.on('click', () => {
        togglePanel();
        // Close the wand dropdown
        $('#extensionsMenuButton').trigger('click');
    });

    // ST appends extension items inside #extensionsMenu
    $('#extensionsMenu').append($btn);
}

// ─── Slash commands ───────────────────────────────────────────────────────────

function registerSlashCommands() {
    // Lazy-import SlashCommandParser so we don't break if it's absent
    import('../../../../slash-commands/SlashCommandParser.js').then(({ SlashCommandParser }) => {
        import('../../../../slash-commands/SlashCommand.js').then(({ SlashCommand, ARGUMENT_TYPE, SlashCommandArgument }) => {
            SlashCommandParser.addCommandObject(SlashCommand.fromProps({
                name: 'fold',
                helpString: 'Collapse or expand chat messages. Usage: /fold up | down | up all | down all',
                unnamedArgumentList: [
                    SlashCommandArgument.fromProps({ description: 'action', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
                ],
                callback: (_, args) => {
                    const action = (args || '').trim().toLowerCase();
                    if (!getSettings().enabled) return 'Message Collapser is disabled.';
                    switch (action) {
                        case 'up':        collapseHidden(); break;
                        case 'down':      expandHidden();   break;
                        case 'up all':    collapseAll();    break;
                        case 'down all':  expandAll();      break;
                        default: return `Unknown fold action: "${action}". Use: up | down | up all | down all`;
                    }
                    return '';
                },
            }));
        });
    }).catch(() => { /* older ST without slash command module — silently skip */ });
}

// ─── Re-apply chevrons when chat changes (character switch, new chat load) ───

function onChatChanged() {
    if (getSettings().enabled) {
        // Small delay to let ST finish rendering the new chat
        setTimeout(addChevronToAll, 300);
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

jQuery(async () => {
    // Ensure settings are initialised
    getSettings();

    // Add item to wand (magic wand / extensions) menu
    addWandButton();

    // Build the panel DOM (hidden) eagerly so it's ready
    buildPanel();

    // Set up per-message chevrons if enabled
    if (getSettings().enabled) {
        addChevronToAll();
        startObserver();
    }

    // Listen for ST events that signal a new chat is loaded
    $(document).on('chatLoaded', onChatChanged);
    // Also hook the event ST fires when characters are selected
    $(document).on('characterSelected', onChatChanged);

    // Register /fold slash commands
    registerSlashCommands();

    console.log(`[${EXT_NAME}] Loaded — open via ✨ Extensions wand menu`);
});
