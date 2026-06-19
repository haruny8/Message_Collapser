/
* Message Collapser — Wand Panel Edition
* Opens via the Extensions wand menu as a floating panel.
* v2 - Forces all messages into the DOM before collapsing,
* so the "Msg to Load" limit does not restrict collapsing.
*/

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';

const EXT_NAME = 'Message_Collapser';
const PANEL_ID = 'mc_floating_panel';
const WAND_BTN_ID = 'mc_wand_btn';
const CHEVRON_CLASS = 'mc-chevron';

// --- Default settings ---
const DEFAULT_SETTINGS = { enabled: true };

function getSettings() {
extension_settings[EXT_NAME]??= structuredClone(DEFAULT_SETTINGS);
return extension_settings[EXT_NAME];
}

// --- Helper: get full chat data ---
function getChat() {
return getContext().chat || [];
}

// --- Collapse / Expand core ---

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

/
* Force-render ALL messages into the DOM by scrolling to the top.
* SillyTavern lazily loads messages based on "Msg to Load".
* Scrolling to the top triggers its sentinel-based lazy loader,
* which progressively loads all messages into the DOM.
*/
async function forceRenderAllMessages() {
const chatContainer = document.getElementById('chat');
if (!chatContainer) return;

const chat = getChat();
const totalMessages = chat.length;
if (!totalMessages) return;

const renderedCount = chatContainer.querySelectorAll('.mes').length;
if (renderedCount >= totalMessages) return; // already all loaded

// Remember where we were so we can scroll back
const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;

let lastRendered = renderedCount;
let stableCount = 0;

// Scroll to top to trigger lazy loading
chatContainer.scrollTop = 0;
await new Promise(r => setTimeout(r, 250));

// Look for the sentinel element SillyTavern uses to load more messages
const sentinel = chatContainer.querySelector('.more_messages,.load-more-messages, #load-more-messages');
if (sentinel) {
// Repeatedly trigger the sentinel until all messages are loaded
while (stableCount < 5) {
sentinel.scrollIntoView();
await new Promise(r => setTimeout(r, 200));
const now = chatContainer.querySelectorAll('.mes').length;
if (now === lastRendered) {
stableCount++;
} else {
stableCount = 0;
lastRendered = now;
}
if (now >= totalMessages) break;
}
} else {
// No sentinel found - try brute force scroll up in increments
const step = 300;
while (stableCount < 5 && chatContainer.scrollTop > 0) {
chatContainer.scrollTop = Math.max(0, chatContainer.scrollTop - step);
await new Promise(r => setTimeout(r, 150));
const now = chatContainer.querySelectorAll('.mes').length;
if (now === lastRendered) {
stableCount++;
} else {
stableCount = 0;
lastRendered = now;
}
if (now >= totalMessages) break;
}
}

// Scroll back to where the user was
if (wasAtBottom) {
chatContainer.scrollTop = chatContainer.scrollHeight;
}
await new Promise(r => setTimeout(r, 200));
}

// --- Global actions ---

function collapseAll() {
let count = 0;
$('#chat.mes').each((_, el) => { collapseMessage($(el)); count++; });
if (count > 0) toastr.success(`${count} message${count!== 1? 's': ''} collapsed.`);
}

function expandAll() {
let count = 0;
$('#chat.mes').each((_, el) => { expandMessage($(el)); count++; });
if (count > 0) toastr.success(`${count} message${count!== 1? 's': ''} expanded.`);
}

function collapseHidden() {
let count = 0;
const chat = getChat();
for (let i = 0; i < chat.length; i++) {
if (chat[i].is_system) {
const $mes = $(`.mes[mesid="${i}"]`);
if ($mes.length) { collapseMessage($mes); count++; }
}
}
if (count > 0) {
toastr.success(`${count} hidden message${count!== 1? 's': ''} collapsed.`);
} else {
toastr.info('No hidden messages found to collapse.');
}
}

function expandHidden() {
let count = 0;
const chat = getChat();
for (let i = 0; i < chat.length; i++) {
if (chat[i].is_system) {
const $mes = $(`.mes[mesid="${i}"]`);
if ($mes.length) { expandMessage($mes); count++; }
}
}
if (count > 0) {
toastr.success(`${count} hidden message${count!== 1? 's': ''} expanded.`);
} else {
toastr.info('No hidden messages found to expand.');
}
}

// --- Collapsed state persistence ---

const COLLAPSE_STORAGE_KEY = 'mc_collapsed_ids';

function saveCollapsedState() {
const ids = [];
$('#chat.mes').each((_, el) => {
const $el = $(el);
if ($el.attr('data-mc-collapsed') === 'true') {
ids.push($el.attr('mesid'));
}
});
try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(ids)); } catch (e) { /* ignore */ }
}

function restoreCollapsedState() {
try {
const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
if (!raw) return;
const ids = JSON.parse(raw);
if (!Array.isArray(ids)) return;
for (const id of ids) {
const $mes = $(`.mes[mesid="${id}"]`);
if ($mes.length) collapseMessage($mes);
}
} catch (e) { /* ignore */ }
}

// --- Per-message chevron button ---

function addChevronToMessage($mes) {
if ($mes.find(`.${CHEVRON_CLASS}`).length) return;

const $btn = $(`<i class="fa-solid fa-chevron-down ${CHEVRON_CLASS}" title="Collapse / Expand message"></i>`);
$btn.on('click', (e) => {
e.stopPropagation();
toggleMessage($mes);
saveCollapsedState();
});
$mes.find('.mes_block').prepend($btn);

// Restore previous collapsed state
if ($mes.attr('data-mc-collapsed') === 'true') {
$mes.find('.mes_text').addClass('mc-collapsed');
$btn.removeClass('fa-chevron-down').addClass('fa-chevron-right');
}
}

function removeChevronFromMessage($mes) {
$mes.find(`.${CHEVRON_CLASS}`).remove();
expandMessage($mes);
}

function addChevronToAll() {
$('#chat.mes').each((_, el) => addChevronToMessage($(el)));
}

function removeChevronFromAll() {
$('#chat.mes').each((_, el) => removeChevronFromMessage($(el)));
localStorage.removeItem(COLLAPSE_STORAGE_KEY);
}

// --- Mutation observer for new messages ---

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

// --- Floating panel ---

function buildPanel() {
if ($(`#${PANEL_ID}`).length) return;

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
<button id="mc_collapse_all" class="mc-action-btn"><i class="fa-solid fa-angles-up"></i> Collapse All</button>
<button id="mc_expand_all" class="mc-action-btn"><i class="fa-solid fa-angles-down"></i> Expand All</button>
<button id="mc_collapse_hidden" class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye-slash"></i> Collapse Hidden</button>
<button id="mc_expand_hidden" class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye"></i> Expand Hidden</button>
</div>
</div>
</div>`;

$('body').append(html);

const $panel = $(`#${PANEL_ID}`);
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

$('#mc_collapse_all').on('click', async () => {
if (!getSettings().enabled) return;
await forceRenderAllMessages();
collapseAll();
});
$('#mc_expand_all').on('click', async () => {
if (!getSettings().enabled) return;
await forceRenderAllMessages();
expandAll();
});
$('#mc_collapse_hidden').on('click', async () => {
if (!getSettings().enabled) return;
await forceRenderAllMessages();
collapseHidden();
});
$('#mc_expand_hidden').on('click', async () => {
if (!getSettings().enabled) return;
await forceRenderAllMessages();
expandHidden();
});

$panel.find('.mc-close-btn').on('click', hidePanel);
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
if ($(`#${PANEL_ID}`).is(':visible')) hidePanel();
else showPanel();
}

// --- Draggable helper ---

function makeDraggable(panel, handle) {
let startX, startY, origLeft, origTop;
handle.addEventListener('pointerdown', (e) => {
if (e.target.closest('button')) return;
e.preventDefault();
const rect = panel.getBoundingClientRect();
startX = e.clientX;
startY = e.clientY;
origLeft = rect.left;
origTop = rect.top;
panel.style.left = origLeft + 'px';
panel.style.top = origTop + 'px';
panel.style.right = 'auto';
panel.style.bottom = 'auto';
handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', (e) => {
if (!handle.hasPointerCapture(e.pointerId)) return;
const dx = e.clientX - startX;
const dy = e.clientY - startY;
const maxLeft = window.innerWidth - panel.offsetWidth;
const maxTop = window.innerHeight - panel.offsetHeight;
panel.style.left = Math.max(0, Math.min(origLeft + dx, maxLeft)) + 'px';
panel.style.top = Math.max(0, Math.min(origTop + dy, maxTop)) + 'px';
});
}

// --- Wand menu button ---

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
$('#extensionsMenuButton').trigger('click');
});
$('#extensionsMenu').append($btn);
}

// --- Slash commands ---

function registerSlashCommands() {
import('../../../../slash-commands/SlashCommandParser.js').then(({ SlashCommandParser }) => {
import('../../../../slash-commands/SlashCommand.js').then(({ SlashCommand, ARGUMENT_TYPE, SlashCommandArgument }) => {
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
name: 'fold',
helpString: 'Collapse or expand chat messages. Usage: /fold up | down | up all | down all',
unnamedArgumentList: [
SlashCommandArgument.fromProps({ description: 'action', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
],
callback: async (_, args) => {
const action = (args || '').trim().toLowerCase();
if (!getSettings().enabled) return 'Message Collapser is disabled.';
switch (action) {
case 'up': await forceRenderAllMessages(); collapseHidden(); break;
case 'down': await forceRenderAllMessages(); expandHidden(); break;
case 'up all': await forceRenderAllMessages(); collapseAll(); break;
case 'down all': await forceRenderAllMessages(); expandAll(); break;
default: return `Unknown fold action: "${action}". Use: up | down | up all | down all`;
}
return '';
},
}));
});
}).catch(() => { /* older ST - silently skip */ });
}

// --- Re-apply chevrons when chat changes ---

function onChatChanged() {
if (getSettings().enabled) {
setTimeout(() => {
addChevronToAll();
restoreCollapsedState();
}, 300);
}
}

// --- Init ---

jQuery(async () => {
getSettings();
addWandButton();
buildPanel();

if (getSettings().enabled) {
addChevronToAll();
startObserver();
}

$(document).on('chatLoaded', onChatChanged);
$(document).on('characterSelected', onChatChanged);

registerSlashCommands();

console.log(`[${EXT_NAME}] Loaded — open via Extensions wand menu`);
});
