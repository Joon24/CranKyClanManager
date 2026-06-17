import {
  NOTICE_CONFIRM_BUTTON_ID,
  NOTICE_EDIT_BUTTON_ID,
  NOTICE_EDIT_MODAL_PREFIX,
  NOTICE_EDIT_SELECT_PREFIX,
} from './content.js';

export function isNoticeConfirmButton(customId: string) {
  return customId === NOTICE_CONFIRM_BUTTON_ID;
}

export function isNoticeEditButton(customId: string) {
  return customId === NOTICE_EDIT_BUTTON_ID;
}

export function isNoticeEditSelect(customId: string) {
  return customId.startsWith(NOTICE_EDIT_SELECT_PREFIX);
}

export function isNoticeEditModal(customId: string) {
  return customId.startsWith(NOTICE_EDIT_MODAL_PREFIX);
}

export {
  NOTICE_CONFIRM_BUTTON_ID,
  NOTICE_EDIT_BUTTON_ID,
  NOTICE_EDIT_SELECT_PREFIX,
  NOTICE_EDIT_MODAL_PREFIX,
} from './content.js';
