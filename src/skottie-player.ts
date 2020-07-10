/**
 * skottie-player.ts
 */

import {LitElement, html, customElement, property, css} from 'lit-element';
const LottieModule = (window as any).lottie;
import * as lottie from 'lottie-web/build/player/lottie_light';  // Using light version for lighter bundle
type LottiePlayerRoot = typeof lottie.default;
const lottiePlayer = LottieModule as any as LottiePlayerRoot;
console.log(lottie);  
console.log(lottiePlayer);

interface layer {
  ty?: Number,
  ks?: any, // transform object
  ao?: Number,
  bm?: Number,
  ddd?: Number,
  ind?: Number,
  cl?: String,
  ln?: String,
  ip?: Number,
  op?: Number,
  st?: Number,
  nm?: String,
  hasMask?: Number,
  masksProperties?: Array<any>,
  ef?: Array<any>, // effects
  sr?: Number,
  parent?: Number,
  shapes?: Array<any>, // shapes
  sc?: String,
  sh?: Number,
  sw?: Number,
  refID?: String,
  tm?: any, // time remapping
  t?: any // text
};

interface lottieFile {
  ip?: Number,
  op?: Number,
  fr?: Number,
  w?: number,
  h?: number,
  ddd?: Number,
  v?: String,
  nm?: String,
  layers?: Array<layer>,
  assets?: Array<any>,
  chars?: Array<any>
};

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
  title = '';

  /**
   * The content of the json file.
   */
  @property({type: Object})
  content:lottieFile = {};

  /**
   * The URL/path to the json file.
   */
  @property({type: String})
  fileURL = '../samples/animations/gear.json';

  /**
   * The width of the animation.
   */
  @property({type: Number})
  width = 0;

  /**
   * The height of the animation.
   */
  @property({type: Number})
  height = 0;

  constructor() {
    super();
    this.title = 'Select a file';
  }

  render(){
    return html`
      <h1>${this.title}</h1>

      <div style='width:${this.width}px;height:${this.height}px' id='player' class='lottie' data-anim-loop='true'></div>

      <input type="file" id="input" accept=".json" @change="${this._handleFileUpload}">
      `;
  }

  setContent(newContent: Object): void {
    this.content = newContent;
    if(this.content.w) {
      this.width = this.content.w;
    }
    if(this.content.h) {
      this.height = this.content.h;
    } 
  }

  // updates lottie player with uploaded animation
  updatePlayer(): void {
    let player = this.shadowRoot?.getElementById("player");

    if(player) {
      let animData = {
        container: player,
        loop: true,
        autoplay: true,
        rendererSettings: {
            progressiveLoad:true,
            preserveAspectRatio: 'xMidYMid meet',
            imagePreserveAspectRatio: 'xMidYMid meet',
            filterSize: {
                width: '300%',
                height: '300%',
                x: '-100%',
                y: '-100%',
            }
        },
        path: this.fileURL
      };
      
      const animation = lottiePlayer.loadAnimation(animData);
      animation.play();
    }
  }

  _handleFileUpload(): void {
    let fileInput = this.shadowRoot?.getElementById("input");
    if(fileInput) {
      let files = (fileInput as HTMLInputElement).files;
      if(files) {
        let file = files[0];
        let reader = new FileReader();
        let player = this;

        this.title = file.name;
        this.fileURL = window.URL.createObjectURL(file);

        reader.readAsText(file);
        reader.onload = function() {
          player.setContent(JSON.parse((reader.result as string)));
          lottiePlayer.destroy();
          player.updatePlayer();
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
