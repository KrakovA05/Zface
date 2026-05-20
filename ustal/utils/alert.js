let _show = null;

export function _registerAlert(fn) {
  _show = fn;
}

export function showAlert(title, message, buttons) {
  if (_show) {
    _show({ title, message: message || '', buttons: buttons || [{ text: 'OK' }] });
  }
}
