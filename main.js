/**
* Message Collapser — Wand Panel Edition
* Opens via the Extensions wand menu as a floating panel.
* Does NOT appear in the Extensions settings drawer.
*
* Collapse logic matches the original creator's approach:
* operates directly on DOM.mes elements.
*/

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';

const EXT_NAME = 'Message_Collapser';
const PANEL_ID = 'mc_floating_panel';
const WAND_BTN_ID = 'mc_wand_btn';
const CHEVRON_CLASS = 'mc-chevron';

// ─── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { enabled: true };

function getSettings() {
extension_settings[EXT_NAME]??= structuredClone(DEFAULT_SETTINGS);
return extension_settings[EXT_NAME];
}

// ─── Collapse / Expand core ───────────────────────────────────────────────────

function collapseMessage($mes) {
$mes.find('.mes_text').addClass('mc-collapsed');
$mes.find('.' + CHEVRON_CLASS).removeClass('fa-chevron-down').addClass('fa-chevron-right');
$mes.attr('data-mc-collapsed', 'true');
}

function expandMessage($mes) {
$mes.find('.mes_text').removeClass('mc-collapsed');
$mes.find('.' + CHEVRON_CLASS).removeClass('fa-chevron-right').addClass('fa-chevron-down');
$mes.removeAttr('data-mc-collapsed');
}

function toggleMessage($mes) {
if ($mes.attr('data-mc-collapsed') === 'true') {
expandMessage($mes);
} else {
collapseMessage($mes);
}
}

// ─── Global actions ───────────────────────────────────────────────────────────
// These match the original creator's approach: operate on all DOM.mes elements

function collapseAll() {
let count = 0;
$('#chat.mes').each(function () { collapseMessage($(this)); count++; });
if (count > 0) toastr.success(count + (count === 1? ' message collapsed.': ' messages collapsed.'));
else toastr.info('All messages already collapsed or no messages to collapse.');
}

function expandAll() {
let count = 0;
$('#chat.mes').each(function () { expandMessage($(this)); count++; });
if (count > 0) toastr.success(count + (count === 1? ' message expanded.': ' messages expanded.'));
else toastr.info('All messages already expanded or no messages to expand.');
}

function collapseHidden() {
let count = 0;
$('#chat.mes[is_system="true"]').each(function () { collapseMessage($(this)); count++; });
if (count > 0) toastr.success(count + (count === 1? " 'hidden' message collapsed.": " 'hidden' messages collapsed."));
else toastr.info("No 'hidden' messages found to collapse.");
}

function expandHidden() {
let count = 0;
$('#chat.mes[is_system="true"]').each(function () { expandMessage($(this)); count++; });
if (count > 0) toastr.success(count + (count === 1? " 'hidden' message expanded.": " 'hidden' messages expanded."));
else toastr.info("No 'hidden' messages found to expand.");
}

// ─── Collapsed state persistence ──────────────────────────────────────────────

const COLLAPSE_STORAGE_KEY = 'mc_collapsed_ids';

function saveCollapsedState() {
var ids = [];
$('#chat.mes').each(function () {
if ($(this).attr('data-mc-collapsed') === 'true') {
ids.push($(this).attr('mesid'));
}
});
try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(ids)); } catch (e) {}
}

function restoreCollapsedState() {
try {
var raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
if (!raw) return;
var ids = JSON.parse(raw);
if (!Array.isArray(ids)) return;
for (var i = 0; i < ids.length; i++) {
var $mes = $('.mes[mesid="' + ids[i] + '"]');
if ($mes.length) collapseMessage($mes);
}
} catch (e) {}
}

// ─── Per-message chevron button ───────────────────────────────────────────────

function addChevronToMessage($mes) {
if ($mes.find('.' + CHEVRON_CLASS).length) return;

var $btn = $('<i class="fa-solid fa-chevron-down ' + CHEVRON_CLASS +
'" title="Collapse / Expand message"></i>');
$btn.on('click', function (e) {
e.stopPropagation();
toggleMessage($mes);
saveCollapsedState();
});
$mes.find('.mes_block').prepend($btn);

// Restore previous collapsed state if set before a re-render
if ($mes.attr('data-mc-collapsed') === 'true') {
$mes.find('.mes_text').addClass('mc-collapsed');
$btn.removeClass('fa-chevron-down').addClass('fa-chevron-right');
}
}

function removeChevronFromMessage($mes) {
$mes.find('.' + CHEVRON_CLASS).remove();
expandMessage($mes);
}

function addChevronToAll() {
$('#chat.mes').each(function () { addChevronToMessage($(this)); });
}

function removeChevronFromAll() {
$('#chat.mes').each(function () { removeChevronFromMessage($(this)); });
localStorage.removeItem(COLLAPSE_STORAGE_KEY);
}

// ─── Observe new messages being added to the chat ────────────────────────────

var _observer = null;

function startObserver() {
if (_observer) return;
var chatEl = document.getElementById('chat');
if (!chatEl) return;
_observer = new MutationObserver(function (mutations) {
if (!getSettings().enabled) return;
for (var m = 0; m < mutations.length; m++) {
for (var n = 0; n < mutations[m].addedNodes.length; n++) {
var node = mutations[m].addedNodes[n];
if (node.nodeType === 1 && node.classList.contains('mes')) {
addChevronToMessage($(node));
}
}
}
});
_observer.observe(chatEl, { childList: true });
}

function stopObserver() {
if (_observer) { _observer.disconnect(); _observer = null; }
}

// ─── Floating panel ───────────────────────────────────────────────────────────

function buildPanel() {
if ($('#' + PANEL_ID).length) return;

$('body').append(
'<div id="' + PANEL_ID + '" class="mc-panel" style="display:none;">' +
' <div class="mc-panel-header">' +
' <span><i class="fa-solid fa-compress-alt"></i> Message Collapser</span>' +
' <button class="mc-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
' </div>' +
' <div class="mc-panel-body">' +
' <label class="mc-toggle-row">' +
' <input type="checkbox" id="mc_enabled_toggle">' +
' <span>Enable Message Collapser</span>' +
' </label>' +
' <hr class="mc-sep">' +
' <div class="mc-btn-grid">' +
' <button id="mc_collapse_all" class="mc-action-btn"><i class="fa-solid fa-angles-up"></i> Collapse All</button>' +
' <button id="mc_expand_all" class="mc-action-btn"><i class="fa-solid fa-angles-down"></i> Expand All</button>' +
' <button id="mc_collapse_hidden" class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye-slash"></i> Collapse Hidden</button>' +
' <button id="mc_expand_hidden" class="mc-action-btn mc-btn-dim"><i class="fa-solid fa-eye"></i> Expand Hidden</button>' +
' </div>' +
' </div>' +
'</div>'
);

var $panel = $('#' + PANEL_ID);

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

$('#mc_collapse_all').on('click', function () {
if (!getSettings().enabled) return;
collapseAll();
});
$('#mc_expand_all').on('click', function () {
if (!getSettings().enabled) return;
expandAll();
});
$('#mc_collapse_hidden').on('click', function () {
if (!getSettings().enabled) return;
collapseHidden();
});
$('#mc_expand_hidden').on('click', function () {
if (!getSettings().enabled) return;
expandHidden();
});

$panel.find('.mc-close-btn').on('click', hidePanel);
makeDraggable($panel[0], $panel.find('.mc-panel-header')[0]);
}

function showPanel() { buildPanel(); $('#' + PANEL_ID).fadeIn(150); }
function hidePanel() { $('#' + PANEL_ID).fadeOut(150); }
function togglePanel() {
if ($('#' + PANEL_ID).is(':visible')) hidePanel(); else showPanel();
}

// ─── Draggable helper ─────────────────────────────────────────────────────────

function makeDraggable(panel, handle) {
var startX, startY, origLeft, origTop;

handle.addEventListener('pointerdown', function (e) {
if (e.target.closest('button')) return;
e.preventDefault();
var rect = panel.getBoundingClientRect();
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

handle.addEventListener('pointermove', function (e) {
if (!handle.hasPointerCapture(e.pointerId)) return;
var dx = e.clientX - startX;
var dy = e.clientY - startY;
var maxLeft = window.innerWidth - panel.offsetWidth;
var maxTop = window.innerHeight - panel.offsetHeight;
panel.style.left = Math.max(0, Math.min(origLeft + dx, maxLeft)) + 'px';
panel.style.top = Math.max(0, Math.min(origTop + dy, maxTop)) + 'px';
});
}

// ─── Wand menu button ─────────────────────────────────────────────────────────

function addWandButton() {
if ($('#' + WAND_BTN_ID).length) return;

var $btn = $(
'<div id="' + WAND_BTN_ID + '" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Message Collapser">' +
' <i class="fa-solid fa-compress-alt fa-fw"></i>' +
' <span>Message Collapser</span>' +
'</div>'
);

$btn.on('click', function () {
togglePanel();
$('#extensionsMenuButton').trigger('click');
});

$('#extensionsMenu').append($btn);
}

// ─── Slash commands ───────────────────────────────────────────────────────────

function registerSlashCommands() {
import('../../../../slash-commands/SlashCommandParser.js').then(function (mod1) {
import('../../../../slash-commands/SlashCommand.js').then(function (mod2) {
var SlashCommandParser = mod1.SlashCommandParser;
var SlashCommand = mod2.SlashCommand;
var ARGUMENT_TYPE = mod2.ARGUMENT_TYPE;
var SlashCommandArgument = mod2.SlashCommandArgument;

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
name: 'fold',
helpString: 'Collapse or expand chat messages. Usage: /fold up | down | up all | down all',
unnamedArgumentList: [
SlashCommandArgument.fromProps({
description: 'action',
typeList: [ARGUMENT_TYPE.STRING],
isRequired: true,
}),
],
callback: function (_, args) {
var action = (args || '').trim().toLowerCase();
if (!getSettings().enabled) return 'Message Collapser is disabled.';
switch (action) {
case 'up': collapseHidden(); break;
case 'down': expandHidden(); break;
case 'up all': collapseAll(); break;
case 'down all': expandAll(); break;
default: return 'Unknown fold action: "' + action + '". Use: up | down | up all | down all';
}
return '';
},
}));
});
}).catch(function () {});
}

// ─── Re-apply chevrons when chat changes ──────────────────────────────────────

function onChatChanged() {
if (getSettings().enabled) {
setTimeout(function () {
addChevronToAll();
restoreCollapsedState();
}, 300);
}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

jQuery(function () {
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

console.log('[' + EXT_NAME + '] Loaded — open via Extensions wand menu');
});
