/**
 * skottie-player.ts
 */

import {LitElement, html, customElement, property, css} from 'lit-element';
const LottieModule = (window as any).lottie;
import * as lottie from 'lottie-web/build/player/lottie_light';
type LottiePlayerRoot = typeof lottie.default;
const lottiePlayer = (LottieModule as any) as LottiePlayerRoot;
console.log(lottie);
console.log(lottiePlayer);

/**
 * Layer types:
 * 0 - Precomp
 * 1 - Solid
 * 2 - Image
 * 3 - Null
 * 4 - Shape
 * 5 - Text
 */
interface Layer {
  ty?: number; // layer type
  ks?: any; // transform object
  ao?: number; // auto-orient boolean
  bm?: number; // blend mode type
  ddd?: number; // 3d layer boolean
  ind?: number; // layer index
  cl?: string; // html class
  ln?: string; // html id
  ip?: number; // in point
  op?: number; // out point
  st?: number; // start time
  nm?: string; // name
  hasMask?: number; // has mask boolean
  masksProperties?: Array<any>; // mask properties
  ef?: Array<any>; // effects
  sr?: number; // stretch
  parent?: number; // parent layer index
  shapes?: Array<any>; // shapes
  sc?: string; // color of solid
  sh?: number; // height of solid
  sw?: number; // width of solid
  refID?: string; // reference ID
  tm?: any; // time remapping
  t?: any; // text
}

interface LottieFile {
  ip?: number; // in point
  op?: number; // out point
  fr?: number; // frame rate
  w?: number; // width
  h?: number; // height
  ddd?: number; // 3d layer boolean
  v?: string; // bodymovin version
  nm?: string; // name
  layers?: Array<Layer>; // layers array
  assets?: Array<any>; // assets array
  chars?: Array<any>; // characters array
}

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

  /**
   * The title of the json file. This is displayed above the animation.
   */
  @property({type: String})
  title = 'Select a file';

  /**
   * The content of the json file.
   */
  @property({type: Object})
  content: LottieFile = {};

  /**
   * The URL to the json file. Set after the file is uploaded.
   */
  @property({type: String})
  fileUrl = '';

  /**
   * The width of the composition.
   */
  @property({type: Number})
  width = 0;

  /**
   * The height of the composition.
   */
  @property({type: Number})
  height = 0;

  render() {
    return html`
      <h1>${this.title}</h1>

      <div
        style="width:${this.width}px;height:${this.height}px"
        id="player"
        class="lottie"
        data-anim-loop="true"
      ></div>

      <input
        type="file"
        id="input"
        accept=".json"
        @change="${this.handleFileUpload}"
      />
    `;
  }

  /**
   * Sets content object as well as width and height.
   */ 
  setContent(newContent: any): void {
    this.content = newContent;
    if (this.content.w) {
      this.width = this.content.w;
    }
    if (this.content.h) {
      this.height = this.content.h;
    }
  }

  /**
   * Updates lottie player to play the uploaded json file.
   */
  updatePlayer(): void {
    const player = this.shadowRoot?.getElementById('player');

    if (player) {
      const animData: lottie.AnimationConfigWithPath = {
        container: player,
        loop: true,
        autoplay: true,
        rendererSettings: {
          progressiveLoad: true,
          preserveAspectRatio: 'xMidYMid meet',
          imagePreserveAspectRatio: 'xMidYMid meet',
          filterSize: {
            width: '300%',
            height: '300%',
            x: '-100%',
            y: '-100%',
          },
        },
        path: this.fileUrl,
      };

      const animation = lottiePlayer.loadAnimation(animData);
      animation.play();
    }
  }

  /**
   * Handles json file upload. Updates content and player.
   */
  handleFileUpload(): void {
    const fileInput = this.shadowRoot?.getElementById('input');
    if (fileInput) {
      const files = (fileInput as HTMLInputElement).files;
      if (files) {
        const file = files[0];
        const reader = new FileReader();

        this.title = file.name;
        this.fileUrl = window.URL.createObjectURL(file);

        reader.readAsText(file);
        reader.onload = () => {
          this.setContent(JSON.parse(reader.result as string));
          lottiePlayer.destroy();
          this.updatePlayer();
        };
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
