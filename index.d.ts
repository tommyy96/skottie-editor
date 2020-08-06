import { CSSResult, LitElement, TemplateResult } from 'lit-element';
/**
 * Application entry element. Handles routing through the other components.
 */
export declare class AppElement extends LitElement {
    randomString: string;
    /** Check if the json editor has been created. */
    private jsonEditorCreated;
    static get styles(): CSSResult;
    /**
     * Implement `render` to define a template for your element.
     */
    render(): TemplateResult;
    updated(): void;
}
//# sourceMappingURL=index.d.ts.map