import { execFileSync } from 'child_process';
import path from 'path';
import test from 'tape';
import {
  getZoomActionFromKeyboardEvent,
  KeyboardShortcutInput,
} from '../src/utils/platform';

/**
 * Checkpoint 5 native-desktop UX coverage. Keyboard inputs and static policy
 * checks are synthetic; no packaged app was launched and no e2e UI test ran.
 */

const nativeUXPolicyScript = path.resolve('scripts/checkNativeUXPolicy.mjs');

function zoomAction(overrides: Partial<KeyboardShortcutInput> = {}) {
  return getZoomActionFromKeyboardEvent({
    type: 'keyDown',
    key: '',
    code: '',
    control: false,
    meta: false,
    shift: false,
    alt: false,
    ...overrides,
  });
}

test('native zoom shortcuts recognize keyboard and numpad variants', (t) => {
  t.equal(
    zoomAction({ control: true, key: '+' }),
    'zoomIn',
    'Ctrl plus zooms in'
  );
  t.equal(
    zoomAction({ control: true, key: '=' }),
    'zoomIn',
    'Ctrl equals zooms in'
  );
  t.equal(
    zoomAction({ control: true, shift: true, key: '=' }),
    'zoomIn',
    'Ctrl Shift equals zooms in'
  );
  t.equal(zoomAction({ meta: true, key: '+' }), 'zoomIn', 'Cmd plus zooms in');
  t.equal(
    zoomAction({ control: true, key: 'Add', code: 'NumpadAdd' }),
    'zoomIn',
    'numpad add zooms in'
  );
  t.equal(
    zoomAction({ control: true, key: '-' }),
    'zoomOut',
    'Ctrl minus zooms out'
  );
  t.equal(
    zoomAction({ control: true, shift: true, key: '_' }),
    'zoomOut',
    'Ctrl underscore zooms out'
  );
  t.equal(
    zoomAction({ control: true, key: 'Subtract', code: 'NumpadSubtract' }),
    'zoomOut',
    'numpad subtract zooms out'
  );
  t.equal(
    zoomAction({ control: true, key: '0' }),
    'resetZoom',
    'Ctrl zero resets zoom'
  );
  t.equal(
    zoomAction({ meta: true, key: '0', code: 'Numpad0' }),
    'resetZoom',
    'numpad zero resets zoom'
  );
  t.end();
});

test('native zoom helper ignores unrelated or unsafe key events', (t) => {
  t.equal(zoomAction({ key: '+' }), null, 'unmodified plus is ignored');
  t.equal(
    zoomAction({ control: true, key: '+', type: 'keyUp' }),
    null,
    'key-up events are ignored'
  );
  t.equal(
    zoomAction({ control: true, alt: true, key: '+' }),
    null,
    'Alt combinations are ignored'
  );
  t.equal(
    zoomAction({ control: true, key: 'a' }),
    null,
    'unrelated keys are ignored'
  );
  t.equal(
    zoomAction({ control: true, shift: true, key: '0' }),
    null,
    'Ctrl Shift zero is not a reset shortcut'
  );
  t.end();
});

test('minimal native UX policy gate passes', (t) => {
  const output = execFileSync(process.execPath, [nativeUXPolicyScript], {
    encoding: 'utf8',
  });
  t.ok(output.includes('passed'), 'native UX policy script passes');
  t.end();
});
