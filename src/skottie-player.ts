/**
 * skottie-player.ts
 */

import {LitElement, html, customElement, property, css} from 'lit-element';

@customElement('skottie-player')
export class SkottiePlayer extends LitElement {
  static get styles() {
    return css`
    :host {
      display: block;
      border: solid 1px gray;
      padding: 16px;
      max-width: 100%;
      font-family: sans-serif;
    }
  `;
  }

  constructor() {
    super();
  }

  render(){
    return html`
      <h1>${this.title}</h1>
      `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
