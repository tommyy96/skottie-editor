import {SkottiePlayer} from '../skottie-player.js';
import {fixture, html} from '@open-wc/testing';

const assert = chai.assert;

suite('skottie-player', () => {
  test('is defined', () => {
    const el = document.createElement('skottie-player');
    assert.instanceOf(el, SkottiePlayer);
  });

  test('renders with default values', async () => {
    const el = await fixture(html`<skottie-player></skottie-player>`);
    assert.shadowDom.equal(
      el,
      `
      <h1>Hello, World!</h1>
      <button part="button">Click Count: 0</button>
      <slot></slot>
    `
    );
  });

  test('renders with a set name', async () => {
    const el = await fixture(html`<skottie-player name="Test"></skottie-player>`);
    assert.shadowDom.equal(
      el,
      `
      <h1>Hello, Test!</h1>
      <button part="button">Click Count: 0</button>
      <slot></slot>
    `
    );
  });

  test('handles a click', async () => {
    const el = (await fixture(html`<skottie-player></skottie-player>`)) as SkottiePlayer;
    const button = el.shadowRoot!.querySelector('button')!;
    button.click();
    await el.updateComplete;
    assert.shadowDom.equal(
      el,
      `
      <h1>Hello, World!</h1>
      <button part="button">Click Count: 1</button>
      <slot></slot>
    `
    );
  });
});
